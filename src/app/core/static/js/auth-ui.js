// Authentication UI Management
class AuthUI {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.checkAuthState();
    }

    initializeElements() {
        // Modals
        this.loginModal = document.getElementById('login-modal');
        this.registerModal = document.getElementById('register-modal');
        this.forgotPasswordModal = document.getElementById('forgot-password-modal');
        
        // Buttons and triggers
        this.loginBtn = document.getElementById('login-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        
        // User greeting elements
        this.userGreeting = document.getElementById('user-greeting');
        this.userName = document.getElementById('user-name');
        
        this.closeLoginModal = document.getElementById('close-login-modal');
        this.closeRegisterModal = document.getElementById('close-register-modal');
        this.closeForgotPasswordModal = document.getElementById('close-forgot-password-modal');
        this.registerLink = document.getElementById('register-link');
        this.loginLink = document.getElementById('login-link');
        this.forgotPasswordLink = document.getElementById('forgot-password-link');
        this.backToLoginLink = document.getElementById('back-to-login-link');
        this.generatePasswordBtn = document.getElementById('generate-password-btn');
        
        // Form inputs
        this.registerPasswordInput = document.getElementById('register-password');
        this.registerPasswordConfirmInput = document.getElementById('register-password-confirm');
        this.passwordMatchFeedback = document.getElementById('password-match-feedback');
        this.loginEmailInput = document.getElementById('login-email');
        this.loginPasswordInput = document.getElementById('login-password');
        this.forgotEmailInput = document.getElementById('forgot-email');
        this.registerFirstNameInput = document.getElementById('register-first-name');
        this.registerLastNameInput = document.getElementById('register-last-name');
        this.registerEmailInput = document.getElementById('register-email');
        
        // Email validation feedback elements
        this.loginEmailFeedback = document.getElementById('login-email-feedback');
        this.registerEmailFeedback = document.getElementById('register-email-feedback');
        this.forgotEmailFeedback = document.getElementById('forgot-email-feedback');
        
        // Submit buttons
        this.loginSubmitBtn = document.getElementById('login-submit');
        this.registerSubmitBtn = document.getElementById('register-submit');
        this.forgotSubmitBtn = document.getElementById('forgot-submit');
        
        // Error display elements
        this.loginErrorDiv = document.getElementById('login-error');
        this.registerErrorDiv = document.getElementById('register-error');
        
        // Password toggle buttons
        this.toggleLoginPasswordBtn = document.getElementById('toggle-login-password');
        this.toggleRegisterPasswordBtn = document.getElementById('toggle-register-password');
        this.toggleRegisterPasswordConfirmBtn = document.getElementById('toggle-register-password-confirm');
        
        // Password strength indicator
        this.passwordStrengthIndicator = document.getElementById('password-strength-indicator');
    }

    setupEventListeners() {
        // Modal navigation
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        if (this.registerLink) {
            this.registerLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideLoginModal();
                this.showRegisterModal();
            });
        }
        
        if (this.loginLink) {
            this.loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideRegisterModal();
                this.showLoginModal();
            });
        }
        
        if (this.forgotPasswordLink) {
            this.forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Copy email from login field if it exists
                if (this.loginEmailInput.value && this.forgotEmailInput) {
                    this.forgotEmailInput.value = this.loginEmailInput.value;
                    // Trigger validation after pre-filling email
                    setTimeout(() => {
                        this.validateEmailField(this.forgotEmailInput, this.forgotEmailFeedback);
                        this.validateForgotPasswordForm();
                    }, 10);
                }
                this.hideLoginModal();
                this.showForgotPasswordModal();
            });
        }
        
        if (this.backToLoginLink) {
            this.backToLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideForgotPasswordModal();
                this.showLoginModal();
            });
        }
        
        // Close modal buttons
        if (this.closeLoginModal) {
            this.closeLoginModal.addEventListener('click', () => this.hideLoginModal());
        }
        
        if (this.closeRegisterModal) {
            this.closeRegisterModal.addEventListener('click', () => this.hideRegisterModal());
        }
        
        if (this.closeForgotPasswordModal) {
            this.closeForgotPasswordModal.addEventListener('click', () => this.hideForgotPasswordModal());
        }
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
        
        // Password generation
        if (this.generatePasswordBtn && this.registerPasswordInput) {
            this.generatePasswordBtn.addEventListener('click', () => this.generatePassword());
        }
        
        // Password validation
        this.setupPasswordValidation();
        
        // Form completeness validation
        this.setupFormValidation();
        
        // Email format validation
        this.setupEmailValidation();
        
        // Password toggle functionality
        this.setupPasswordToggle();
        
        // Password strength indicator
        this.setupPasswordStrength();
        
        // Form submissions
        this.setupFormSubmissions();
    }

    // Modal show/hide methods
    showLoginModal() {
        this.loginModal.style.display = 'block';
    }

    hideLoginModal() {
        this.loginModal.style.display = 'none';
    }

    showRegisterModal() {
        this.registerModal.style.display = 'block';
    }

    hideRegisterModal() {
        this.registerModal.style.display = 'none';
    }

    showForgotPasswordModal() {
        this.forgotPasswordModal.style.display = 'block';
    }

    hideForgotPasswordModal() {
        this.forgotPasswordModal.style.display = 'none';
    }

    hideAllModals() {
        this.hideLoginModal();
        this.hideRegisterModal();
        this.hideForgotPasswordModal();
    }

    // Password generation
    generatePassword() {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        
        // Ensure at least one character from each type
        const lowercase = "abcdefghijklmnopqrstuvwxyz";
        const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        const symbols = "!@#$%^&*";
        
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // Shuffle the password
        const shuffledPassword = password.split('').sort(() => Math.random() - 0.5).join('');
        
        this.registerPasswordInput.value = shuffledPassword;
        this.registerPasswordInput.type = 'text'; // Show password briefly
        
        // Hide password after 2 seconds
        setTimeout(() => {
            this.registerPasswordInput.type = 'password';
        }, 2000);
        
        // Validate password match, form completeness, and strength after generation
        setTimeout(() => {
            this.validatePasswordMatch();
            this.validateRegisterForm();
            this.updatePasswordStrength();
        }, 10);
    }

    // Password validation
    setupPasswordValidation() {
        if (this.registerPasswordInput && this.registerPasswordConfirmInput) {
            this.registerPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
            this.registerPasswordConfirmInput.addEventListener('input', () => this.validatePasswordMatch());
        }
    }

    validatePasswordMatch() {
        if (!this.registerPasswordInput || !this.registerPasswordConfirmInput || !this.passwordMatchFeedback) return;
        
        const password = this.registerPasswordInput.value;
        const confirmPassword = this.registerPasswordConfirmInput.value;
        
        // Clear feedback if confirm field is empty
        if (!confirmPassword) {
            this.passwordMatchFeedback.textContent = '';
            this.passwordMatchFeedback.className = 'validation-message';
            return;
        }
        
        // Check if passwords match
        if (password === confirmPassword) {
            this.passwordMatchFeedback.textContent = '✓ Passwords match';
            this.passwordMatchFeedback.className = 'validation-message success';
        } else {
            this.passwordMatchFeedback.textContent = '✗ Passwords do not match';
            this.passwordMatchFeedback.className = 'validation-message error';
        }
    }

    // Form completeness validation
    setupFormValidation() {
        // Login form validation
        if (this.loginEmailInput && this.loginPasswordInput && this.loginSubmitBtn) {
            this.loginEmailInput.addEventListener('input', () => this.validateLoginForm());
            this.loginPasswordInput.addEventListener('input', () => this.validateLoginForm());
            this.validateLoginForm(); // Initial check
        }

        // Register form validation
        if (this.registerFirstNameInput && this.registerLastNameInput && this.registerEmailInput && 
            this.registerPasswordInput && this.registerPasswordConfirmInput && this.registerSubmitBtn) {
            this.registerFirstNameInput.addEventListener('input', () => this.validateRegisterForm());
            this.registerLastNameInput.addEventListener('input', () => this.validateRegisterForm());
            this.registerEmailInput.addEventListener('input', () => this.validateRegisterForm());
            this.registerPasswordInput.addEventListener('input', () => this.validateRegisterForm());
            this.registerPasswordConfirmInput.addEventListener('input', () => this.validateRegisterForm());
            this.validateRegisterForm(); // Initial check
        }

        // Forgot password form validation
        if (this.forgotEmailInput && this.forgotSubmitBtn) {
            this.forgotEmailInput.addEventListener('input', () => this.validateForgotPasswordForm());
            this.validateForgotPasswordForm(); // Initial check
        }
    }

    validateLoginForm() {
        const email = this.loginEmailInput.value.trim();
        const password = this.loginPasswordInput.value.trim();
        
        const emailValid = email && this.isValidEmail(email);
        const isValid = emailValid && password;
        
        this.loginSubmitBtn.disabled = !isValid;
        this.updateButtonState(this.loginSubmitBtn, isValid, 'Login');
        
        return isValid;
    }

    validateRegisterForm() {
        const firstName = this.registerFirstNameInput.value.trim();
        const lastName = this.registerLastNameInput.value.trim();
        const email = this.registerEmailInput.value.trim();
        const password = this.registerPasswordInput.value.trim();
        const confirmPassword = this.registerPasswordConfirmInput.value.trim();
        
        const fieldsComplete = firstName && lastName && email && password && confirmPassword;
        const emailValid = email && this.isValidEmail(email);
        const passwordsMatch = password === confirmPassword;
        
        const isValid = fieldsComplete && emailValid && passwordsMatch;
        
        this.registerSubmitBtn.disabled = !isValid;
        this.updateButtonState(this.registerSubmitBtn, isValid, 'Register');
        
        return isValid;
    }

    validateForgotPasswordForm() {
        const email = this.forgotEmailInput.value.trim();
        
        const isValid = email && this.isValidEmail(email);
        
        this.forgotSubmitBtn.disabled = !isValid;
        this.updateButtonState(this.forgotSubmitBtn, isValid, 'Send Reset Link');
        
        return isValid;
    }

    // Email format validation
    setupEmailValidation() {
        // Login email validation
        if (this.loginEmailInput && this.loginEmailFeedback) {
            this.loginEmailInput.addEventListener('input', () => {
                this.validateEmailField(this.loginEmailInput, this.loginEmailFeedback);
                this.validateLoginForm(); // Update form completeness
            });
            this.loginEmailInput.addEventListener('blur', () => {
                this.validateEmailField(this.loginEmailInput, this.loginEmailFeedback);
            });
        }

        // Register email validation
        if (this.registerEmailInput && this.registerEmailFeedback) {
            this.registerEmailInput.addEventListener('input', () => {
                this.validateEmailField(this.registerEmailInput, this.registerEmailFeedback);
                this.validateRegisterForm(); // Update form completeness
            });
            this.registerEmailInput.addEventListener('blur', () => {
                this.validateEmailField(this.registerEmailInput, this.registerEmailFeedback);
            });
        }

        // Forgot password email validation
        if (this.forgotEmailInput && this.forgotEmailFeedback) {
            this.forgotEmailInput.addEventListener('input', () => {
                this.validateEmailField(this.forgotEmailInput, this.forgotEmailFeedback);
                this.validateForgotPasswordForm(); // Update form completeness
            });
            this.forgotEmailInput.addEventListener('blur', () => {
                this.validateEmailField(this.forgotEmailInput, this.forgotEmailFeedback);
            });
        }
    }

    validateEmailField(emailInput, feedbackElement) {
        const email = emailInput.value.trim();
        
        // Clear feedback if field is empty
        if (!email) {
            feedbackElement.textContent = '';
            feedbackElement.className = 'validation-message';
            return false;
        }
        
        // Check email format
        if (this.isValidEmail(email)) {
            // Valid email - clear any error message
            feedbackElement.textContent = '';
            feedbackElement.className = 'validation-message';
            return true;
        } else {
            // Invalid email - show error message
            feedbackElement.textContent = '✗ Invalid email format';
            feedbackElement.className = 'validation-message error';
            return false;
        }
    }

    updateButtonState(button, isValid, text) {
        if (isValid) {
            button.classList.remove('disabled');
            button.textContent = text;
        } else {
            button.classList.add('disabled');
            button.textContent = text;
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Password toggle functionality
    setupPasswordToggle() {
        // Login password toggle
        if (this.toggleLoginPasswordBtn && this.loginPasswordInput) {
            this.toggleLoginPasswordBtn.addEventListener('click', () => {
                this.togglePasswordVisibility(this.loginPasswordInput, this.toggleLoginPasswordBtn);
            });
        }

        // Register password toggle
        if (this.toggleRegisterPasswordBtn && this.registerPasswordInput) {
            this.toggleRegisterPasswordBtn.addEventListener('click', () => {
                this.togglePasswordVisibility(this.registerPasswordInput, this.toggleRegisterPasswordBtn);
            });
        }

        // Register password confirm toggle
        if (this.toggleRegisterPasswordConfirmBtn && this.registerPasswordConfirmInput) {
            this.toggleRegisterPasswordConfirmBtn.addEventListener('click', () => {
                this.togglePasswordVisibility(this.registerPasswordConfirmInput, this.toggleRegisterPasswordConfirmBtn);
            });
        }
    }

    togglePasswordVisibility(inputField, toggleButton) {
        const eyeIcon = toggleButton.querySelector('.eye-icon');
        
        if (inputField.type === 'password') {
            // Show password
            inputField.type = 'text';
            eyeIcon.src = '/static/icons/eye-off.svg';
            eyeIcon.alt = 'Hide password';
        } else {
            // Hide password
            inputField.type = 'password';
            eyeIcon.src = '/static/icons/eye.svg';
            eyeIcon.alt = 'Show password';
        }
    }

    // Password strength functionality
    setupPasswordStrength() {
        if (this.registerPasswordInput && this.passwordStrengthIndicator) {
            this.registerPasswordInput.addEventListener('input', () => {
                this.updatePasswordStrength();
            });
        }
    }

    updatePasswordStrength() {
        const password = this.registerPasswordInput.value;
        const strength = this.calculatePasswordStrength(password);
        
        const strengthFill = this.passwordStrengthIndicator.querySelector('.strength-fill');
        const strengthText = this.passwordStrengthIndicator.querySelector('.strength-text');
        
        // Clear previous classes
        strengthFill.className = 'strength-fill';
        strengthText.className = 'strength-text';
        
        if (!password) {
            // Empty password - hide indicator
            strengthText.textContent = '';
            return;
        }
        
        // Apply strength styling and text
        switch (strength) {
            case 'weak':
                strengthFill.classList.add('weak');
                strengthText.classList.add('weak');
                strengthText.textContent = 'Weak password';
                break;
            case 'medium':
                strengthFill.classList.add('medium');
                strengthText.classList.add('medium');
                strengthText.textContent = 'Medium strength';
                break;
            case 'strong':
                strengthFill.classList.add('strong');
                strengthText.classList.add('strong');
                strengthText.textContent = 'Strong password';
                break;
        }
    }

    calculatePasswordStrength(password) {
        if (!password) return 'weak';
        
        const length = password.length;
        const uniqueChars = new Set(password).size;
        
        // Your specified criteria: 12+ chars and 9+ different characters = strong
        if (length >= 12 && uniqueChars >= 9) {
            return 'strong';
        }
        
        // Medium criteria: reasonable length and variety
        if (length >= 8 && uniqueChars >= 6) {
            return 'medium';
        }
        
        // Everything else is weak
        return 'weak';
    }

    // Form submissions
    setupFormSubmissions() {
        // Login form submission
        if (this.loginSubmitBtn) {
            this.loginSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // Register form submission
        if (this.registerSubmitBtn) {
            this.registerSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleRegister();
            });
        }
    }

    async handleLogin() {
        const email = this.loginEmailInput.value.trim();
        const password = this.loginPasswordInput.value.trim();

        if (!email || !password) {
            this.showError(this.loginErrorDiv, 'Please fill in all fields');
            return;
        }

        this.showLoading(this.loginSubmitBtn, 'Logging in...');
        this.clearError(this.loginErrorDiv);

        try {
            const result = await window.authAPI.login(email, password);
            console.log('Login successful:', result.user_email);
            this.hideLoginModal();
            this.updateAuthState(true);
        } catch (error) {
            this.showError(this.loginErrorDiv, error.message);
        } finally {
            this.hideLoading(this.loginSubmitBtn, 'Login');
        }
    }

    async handleRegister() {
        const firstName = this.registerFirstNameInput.value.trim();
        const lastName = this.registerLastNameInput.value.trim();
        const email = this.registerEmailInput.value.trim();
        const password = this.registerPasswordInput.value.trim();
        const confirmPassword = this.registerPasswordConfirmInput.value.trim();

        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            this.showError(this.registerErrorDiv, 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError(this.registerErrorDiv, 'Passwords do not match');
            return;
        }

        this.showLoading(this.registerSubmitBtn, 'Registering...');
        this.clearError(this.registerErrorDiv);

        try {
            const result = await window.authAPI.register(firstName, lastName, email, password);
            console.log('Registration successful:', result.user_email);
            this.hideRegisterModal();
            this.updateAuthState(true);
        } catch (error) {
            // Show generic error message for registration failures
            this.showError(this.registerErrorDiv, 'Registration failed. Please check your information and try again.');
        } finally {
            this.hideLoading(this.registerSubmitBtn, 'Register');
        }
    }

    showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    clearError(errorDiv) {
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
    }

    showLoading(button, text) {
        button.disabled = true;
        button.textContent = text;
    }

    hideLoading(button, text) {
        button.disabled = false;
        button.textContent = text;
    }

    updateAuthState(isLoggedIn) {
        if (isLoggedIn) {
            // Hide login icon, show logout icon
            if (this.loginBtn) {
                this.loginBtn.style.display = 'none';
            }
            if (this.logoutBtn) {
                this.logoutBtn.style.display = 'flex';
            }
            
            // Show user greeting
            if (this.userGreeting && this.userName) {
                const userInfo = window.authAPI.getUserInfo();
                if (userInfo && userInfo.email) {
                    // Use first name if available, otherwise fall back to email username
                    let displayName;
                    if (userInfo.firstName && userInfo.firstName.trim()) {
                        displayName = userInfo.firstName.trim();
                    } else {
                        displayName = userInfo.email.split('@')[0];
                    }
                    const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
                    this.userName.textContent = capitalizedName;
                    this.userGreeting.style.display = 'block';
                }
            }
        } else {
            // Show login icon, hide logout icon
            if (this.loginBtn) {
                this.loginBtn.style.display = 'flex';
            }
            if (this.logoutBtn) {
                this.logoutBtn.style.display = 'none';
            }
            
            // Hide user greeting
            if (this.userGreeting) {
                this.userGreeting.style.display = 'none';
            }
        }
    }

    async handleLogout() {
        try {
            await window.authAPI.logout();
            console.log('Logout successful');
            this.updateAuthState(false);
        } catch (error) {
            console.error('Logout failed:', error);
            // Still update UI state even if logout request fails
            this.updateAuthState(false);
        }
    }


    checkAuthState() {
        const isLoggedIn = window.authAPI.isLoggedIn();
        this.updateAuthState(isLoggedIn);
    }
}

// Initialize AuthUI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});