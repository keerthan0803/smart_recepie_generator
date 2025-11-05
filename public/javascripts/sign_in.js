document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signinForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const showPasswordCheckbox = document.getElementById('showPassword');
    const signinBtn = document.querySelector('.sign-in-btn');

    // Show/Hide password functionality
    showPasswordCheckbox.addEventListener('change', function() {
        passwordInput.type = this.checked ? 'text' : 'password';
    });

    // Form validation
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(input, message) {
        input.style.borderColor = '#e53e3e';
        input.style.backgroundColor = '#fed7d7';
        
        // Remove existing error message
        const existingError = input.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.color = '#e53e3e';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '5px';
        input.parentNode.appendChild(errorDiv);
    }

    function clearError(input) {
        input.style.borderColor = '#e5e7eb';
        input.style.backgroundColor = '#fafafa';
        
        const errorMessage = input.parentNode.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }

    // Real-time validation
    emailInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            showError(this, 'Email is required');
        } else if (!validateEmail(this.value)) {
            showError(this, 'Please enter a valid email address');
        } else {
            clearError(this);
        }
    });

    passwordInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            showError(this, 'Password is required');
        } else {
            clearError(this);
        }
    });

    // Clear errors on input
    emailInput.addEventListener('input', function() {
        if (this.parentNode.querySelector('.error-message')) {
            clearError(this);
        }
    });

    passwordInput.addEventListener('input', function() {
        if (this.parentNode.querySelector('.error-message')) {
            clearError(this);
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        let isValid = true;

        // Validate email
        if (!emailInput.value.trim()) {
            showError(emailInput, 'Email is required');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            showError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        // Validate password
        if (!passwordInput.value.trim()) {
            showError(passwordInput, 'Password is required');
            isValid = false;
        }

        if (isValid) {
            // Show loading state
            const originalText = signinBtn.textContent;
            signinBtn.textContent = 'Signing In...';
            signinBtn.disabled = true;

            // Prepare login data
            const loginData = {
                email: emailInput.value,
                password: passwordInput.value
            };

            try {
                // Send login request to backend API
                console.log('Attempting login with:', { email: loginData.email });
                const response = await fetch('/api/customer/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(loginData)
                });

                console.log('Response status:', response.status);
                const result = await response.json();
                console.log('Response data:', result);

                if (response.ok && result.success) {
                    // Store customer info in localStorage
                    localStorage.setItem('customerId', result.customer.id);
                    localStorage.setItem('customerName', result.customer.firstName);
                    localStorage.setItem('customerEmail', result.customer.email);
                    localStorage.setItem('customerCredits', String(result.customer.credits ?? 0));
                    
                    // Show success message
                    alert(`Welcome back, ${result.customer.firstName}! 🍳`);
                    
                    // Redirect to home or dashboard
                    window.location.href = '/';
                } else {
                    // If not verified, offer to resend verification email
                    if (response.status === 403 && (result.message || '').toLowerCase().includes('verify')) {
                        const wantsResend = confirm('Your email is not verified. Would you like us to resend the verification email?');
                        if (wantsResend) {
                            try {
                                const resendRes = await fetch('/api/customer/resend-verification', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: emailInput.value })
                                });
                                const resendJson = await resendRes.json();
                                if (resendRes.ok && resendJson.success) {
                                    alert('Verification email sent. Please check your inbox. ✉️');
                                } else {
                                    alert(resendJson.message || 'Could not send verification email.');
                                }
                            } catch (e) {
                                console.error('Resend verification error:', e);
                                alert('Network error sending verification email.');
                            }
                        }
                    } else {
                        // Show generic error
                        alert(result.message || 'Invalid email or password. Please try again.');
                    }
                    signinBtn.textContent = originalText;
                    signinBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error signing in. Please check your connection and try again.');
                signinBtn.textContent = originalText;
                signinBtn.disabled = false;
            }
        }
    });

    // Social login handlers
    document.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const provider = this.textContent.trim();
            alert(`${provider} sign in coming soon! (This is a demo)`);
        });
    });

    // Forgot password handler
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Forgot password feature coming soon! 🔐');
        });
    }
});