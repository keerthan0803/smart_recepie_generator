document.addEventListener('DOMContentLoaded', async function() {
    // Get customerId from URL query parameter first, then fall back to localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlCustomerId = urlParams.get('customerId');
    const customerId = urlCustomerId || localStorage.getItem('customerId');
    const customerName = localStorage.getItem('customerName');
    
    if (!customerId) {
        alert('Please sign in to view your profile');
        window.location.href = '/signin';
        return;
    }

    // Update localStorage with customerId from URL if it came from URL
    if (urlCustomerId && !localStorage.getItem('customerId')) {
        localStorage.setItem('customerId', urlCustomerId);
    }

    // Elements
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editProfileForm = document.getElementById('editProfileForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const avatarInitials = document.getElementById('avatarInitials');

    // Load profile data
    await loadProfile();

    // Edit profile button
    editProfileBtn.addEventListener('click', function() {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
        populateEditForm();
    });

    // Cancel edit button
    cancelEditBtn.addEventListener('click', function() {
        editMode.style.display = 'none';
        viewMode.style.display = 'block';
    });

    // Submit edit form
    editProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveProfile();
    });

    // Logout button
    logoutBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            window.location.href = '/signin';
        }
    });

    // Load profile data
    async function loadProfile() {
        try {
            const response = await fetch(`/api/customer/${customerId}`);
            const result = await response.json();

            if (response.ok && result.success) {
                const customer = result.customer;
                
                // Update avatar
                const initials = (customer.firstName[0] + customer.lastName[0]).toUpperCase();
                avatarInitials.textContent = initials;

                // Update view mode
                document.getElementById('viewFirstName').textContent = customer.firstName;
                document.getElementById('viewLastName').textContent = customer.lastName;
                document.getElementById('viewEmail').textContent = customer.email;
                document.getElementById('viewPhone').textContent = customer.phoneNumber || 'Not provided';
                document.getElementById('viewAge').textContent = customer.age || 'Not provided';
                document.getElementById('viewSkillLevel').textContent = capitalizeFirst(customer.skillLevel);

                // Dietary preferences
                const dietaryPrefsContainer = document.getElementById('viewDietaryPrefs');
                if (customer.dietaryPreferences && customer.dietaryPreferences.length > 0) {
                    dietaryPrefsContainer.innerHTML = customer.dietaryPreferences
                        .map(pref => `<span class="preference-tag">${capitalizeFirst(pref)}</span>`)
                        .join('');
                } else {
                    dietaryPrefsContainer.innerHTML = '<div class="empty-state">No dietary preferences set</div>';
                }

                // Allergies
                const allergiesContainer = document.getElementById('viewAllergies');
                if (customer.allergies && customer.allergies.length > 0) {
                    allergiesContainer.innerHTML = customer.allergies
                        .map(allergy => `<span class="preference-tag">${capitalizeFirst(allergy)}</span>`)
                        .join('');
                } else {
                    allergiesContainer.innerHTML = '<div class="empty-state">No allergies specified</div>';
                }

                // Account info
                document.getElementById('viewMemberSince').textContent = new Date(customer.createdAt).toLocaleDateString();
                document.getElementById('viewLastLogin').textContent = new Date(customer.lastLogin).toLocaleDateString();
                
                const emailVerifiedBadge = document.getElementById('viewEmailVerified');
                if (customer.isEmailVerified) {
                    emailVerifiedBadge.innerHTML = '<span class="status-badge verified">✓ Verified</span>';
                } else {
                    emailVerifiedBadge.innerHTML = '<span class="status-badge" style="background:#fed7d7;color:#742a2a;">✗ Not Verified</span>';
                }

                // Stats
                document.getElementById('creditsCount').textContent = customer.credits || 0;
                document.getElementById('chatCount').textContent = customer.chatSessions?.length || 0;
                document.getElementById('recipesCount').textContent = customer.savedRecipes?.length || 0;

                // Store customer data for edit form
                window.customerData = customer;

            } else {
                alert('Error loading profile');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile. Please try again.');
        }
    }

    // Populate edit form with current data
    function populateEditForm() {
        const customer = window.customerData;
        
        document.getElementById('editFirstName').value = customer.firstName;
        document.getElementById('editLastName').value = customer.lastName;
        document.getElementById('editPhone').value = customer.phoneNumber || '';
        document.getElementById('editAge').value = customer.age || '';
        document.getElementById('editSkillLevel').value = customer.skillLevel;

        // Dietary preferences checkboxes
        const dietaryCheckboxes = document.querySelectorAll('input[name="dietaryPreferences"]');
        dietaryCheckboxes.forEach(checkbox => {
            checkbox.checked = customer.dietaryPreferences?.includes(checkbox.value) || false;
        });

        // Allergies
        document.getElementById('editAllergies').value = customer.allergies?.join(', ') || '';
    }

    // Save profile changes
    async function saveProfile() {
        try {
            const formData = new FormData(editProfileForm);
            
            // Get dietary preferences
            const dietaryPreferences = [];
            document.querySelectorAll('input[name="dietaryPreferences"]:checked').forEach(cb => {
                dietaryPreferences.push(cb.value);
            });

            // Parse allergies
            const allergiesText = formData.get('allergies');
            const allergies = allergiesText ? 
                allergiesText.split(',').map(a => a.trim()).filter(a => a.length > 0) : 
                [];

            const updateData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                phoneNumber: formData.get('phoneNumber'),
                age: parseInt(formData.get('age')) || null,
                skillLevel: formData.get('skillLevel'),
                dietaryPreferences: dietaryPreferences,
                allergies: allergies
            };

            const response = await fetch(`/api/customer/${customerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert('✅ Profile updated successfully!');
                
                // Update localStorage
                localStorage.setItem('customerName', updateData.firstName);
                
                // Reload profile
                await loadProfile();
                
                // Switch back to view mode
                editMode.style.display = 'none';
                viewMode.style.display = 'block';
            } else {
                alert('❌ ' + (result.message || 'Error updating profile'));
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Error saving profile. Please try again.');
        }
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
    }
});
