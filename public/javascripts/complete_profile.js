document.addEventListener('DOMContentLoaded', () => {
  const customerId = new URLSearchParams(window.location.search).get('customerId') || 
                     localStorage.getItem('customerId');
  
  if (!customerId) {
    window.location.href = '/signin';
    return;
  }

  const form = document.getElementById('completeProfileForm');
  const skipBtn = document.getElementById('skipBtn');

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phoneNumber = document.getElementById('phoneNumber')?.value?.trim();
    const age = document.getElementById('age')?.value;
    const skillLevel = document.getElementById('skillLevel')?.value;
    const allergies = document.getElementById('allergies')?.value?.trim();
    
    // Get dietary preferences
    const dietaryCheckboxes = document.querySelectorAll('input[name="dietaryPreferences"]:checked');
    const dietaryPreferences = Array.from(dietaryCheckboxes).map(cb => cb.value);

    try {
      const response = await fetch(`/api/customer/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber || null,
          age: age ? parseInt(age) : null,
          skillLevel: skillLevel || 'beginner',
          dietaryPreferences,
          allergies: allergies || null,
          profileCompleted: true
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Profile completed successfully!');
        window.location.href = `/profile?customerId=${customerId}`;
      } else {
        alert('Error: ' + (data.message || 'Failed to update profile'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  });

  // Handle skip button
  skipBtn.addEventListener('click', () => {
    window.location.href = `/profile?customerId=${customerId}`;
  });
});
