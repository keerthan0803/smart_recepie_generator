document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const showPasswordCheckbox = document.getElementById('showPassword');
    const resetBtn = document.querySelector('.sign-in-btn');

    // Get token and email from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) {
        alert('Invalid password reset link. Please request a new one.');
        window.location.href = '/signin';
        return;
    }

    // Show/Hide password functionality
    showPasswordCheckbox.addEventListener('change', function() {
        const inputType = this.checked ? 'text' : 'password';
        newPasswordInput.type = inputType;
        confirmPasswordInput.type = inputType;
    });

    function showError(input, message) {
        input.style.borderColor = '#e53e3e';
        input.style.backgroundColor = '#fed7d7';
        
        const existingError = input.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
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
    newPasswordInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            showError(this, 'Password is required');
        } else if (this.value.length < 8) {
            showError(this, 'Password must be at least 8 characters');
        } else {
            clearError(this);
        }
    });

    confirmPasswordInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            showError(this, 'Please confirm your password');
        } else if (this.value !== newPasswordInput.value) {
            showError(this, 'Passwords do not match');
        } else {
            clearError(this);
        }
    });

    // Clear errors on input
    newPasswordInput.addEventListener('input', function() {
        if (this.parentNode.querySelector('.error-message')) {
            clearError(this);
        }
    });

    confirmPasswordInput.addEventListener('input', function() {
        if (this.parentNode.querySelector('.error-message')) {
            clearError(this);
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        let isValid = true;

        // Validate new password
        if (!newPasswordInput.value.trim()) {
            showError(newPasswordInput, 'Password is required');
            isValid = false;
        } else if (newPasswordInput.value.length < 8) {
            showError(newPasswordInput, 'Password must be at least 8 characters');
            isValid = false;
        }

        // Validate confirm password
        if (!confirmPasswordInput.value.trim()) {
            showError(confirmPasswordInput, 'Please confirm your password');
            isValid = false;
        } else if (confirmPasswordInput.value !== newPasswordInput.value) {
            showError(confirmPasswordInput, 'Passwords do not match');
            isValid = false;
        }

        if (isValid) {
            const originalText = resetBtn.textContent;
            resetBtn.textContent = 'Resetting Password...';
            resetBtn.disabled = true;

            try {
                const response = await fetch('/api/customer/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        email: email,
                        newPassword: newPasswordInput.value
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    alert('✅ ' + result.message);
                    window.location.href = '/signin';
                } else {
                    alert('❌ ' + (result.message || 'Error resetting password. Please try again.'));
                    resetBtn.textContent = originalText;
                    resetBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error resetting password. Please check your connection and try again.');
                resetBtn.textContent = originalText;
                resetBtn.disabled = false;
            }
        }
    });
});
