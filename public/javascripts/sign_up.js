document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const showPasswordCheckbox = document.getElementById('showPassword');
    
    // Show/Hide passwords functionality
    showPasswordCheckbox.addEventListener('change', function() {
        const inputType = this.checked ? 'text' : 'password';
        passwordInput.type = inputType;
        confirmPasswordInput.type = inputType;
    });
    
    // Real-time validation
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
    
    // Password confirmation validation
    confirmPasswordInput.addEventListener('input', function() {
        validatePasswordMatch();
    });
    
    passwordInput.addEventListener('input', function() {
        if (confirmPasswordInput.value) {
            validatePasswordMatch();
        }
    });
    
    function validateField(field) {
        const errorDiv = document.getElementById(field.id + 'Error');
        let isValid = true;
        let errorMessage = '';
        
        // Clear previous styles
        field.classList.remove('error');
        errorDiv.style.display = 'none';
        
        // Required field validation
        if (!field.value.trim()) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        
        // Specific validations
        switch (field.type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (field.value && !emailRegex.test(field.value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
                
            case 'password':
                if (field.value && field.value.length < 8) {
                    isValid = false;
                    errorMessage = 'Password must be at least 8 characters long';
                }
                break;
        }
        
        if (!isValid) {
            field.classList.add('error');
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
        
        return isValid;
    }
    
    function validatePasswordMatch() {
        const errorDiv = document.getElementById('confirmPasswordError');
        const isMatch = passwordInput.value === confirmPasswordInput.value;
        
        confirmPasswordInput.classList.remove('error');
        errorDiv.style.display = 'none';
        
        if (confirmPasswordInput.value && !isMatch) {
            confirmPasswordInput.classList.add('error');
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
        }
        
        return isMatch;
    }
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        let isFormValid = true;
        
        // Validate all fields
        inputs.forEach(input => {
            if (!validateField(input)) {
                isFormValid = false;
            }
        });
        
        // Validate skill level
        const skillLevel = document.getElementById('skillLevel');
        if (!skillLevel.value) {
            isFormValid = false;
            const errorDiv = document.getElementById('skillLevelError');
            errorDiv.textContent = 'Please select your cooking skill level';
            errorDiv.style.display = 'block';
        }
        
        // Validate password match
        if (!validatePasswordMatch()) {
            isFormValid = false;
        }
        
        if (isFormValid) {
            // Show loading state
            const submitBtn = document.querySelector('.sign-up-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating Your Profile...';
            submitBtn.disabled = true;
            
            // Prepare data for API
            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                skillLevel: skillLevel.value
            };
            
            try {
                // Send data to backend API
                const response = await fetch('/api/customer/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Show success message
                    const successMsg = document.getElementById('successMessage');
                    successMsg.textContent = 'Account created successfully! Please check your email to verify your account before signing in.';
                    successMsg.style.display = 'block';

                    setTimeout(() => {
                        alert('We sent you a verification email. Please verify and then sign in. ✉️');
                        // Redirect to sign in
                        window.location.href = '/signin';
                    }, 1500);
                } else {
                    // Show error message
                    alert(result.message || 'Error creating account. Please try again.');
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error creating account. Please check your connection and try again.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    });
    
    // Social login handlers
    document.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const provider = this.textContent.trim();
            alert(`${provider} signup coming soon! (This is a demo)`);
        });
    });
});

// Add error styling
const style = document.createElement('style');
style.textContent = `
    .form-group input.error,
    .form-group select.error {
        border-color: #e53e3e;
        background-color: #fed7d7;
    }
`;
document.head.appendChild(style);
