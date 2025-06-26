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
        this.profileModal = document.getElementById('profile-modal');
        
        // Buttons and triggers
        this.loginBtn = document.getElementById('login-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.profileBtn = document.getElementById('profile-btn');
        
        // User greeting elements
        this.userGreeting = document.getElementById('user-greeting');
        this.userName = document.getElementById('user-name');
        
        this.closeLoginModal = document.getElementById('close-login-modal');
        this.closeRegisterModal = document.getElementById('close-register-modal');
        this.closeForgotPasswordModal = document.getElementById('close-forgot-password-modal');
        this.closeProfileModal = document.getElementById('close-profile-modal');
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
        this.rememberMeCheckbox = document.getElementById('remember-me');
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
        this.forgotPasswordErrorDiv = document.getElementById('forgot-password-error');
        
        // Password toggle buttons
        this.toggleLoginPasswordBtn = document.getElementById('toggle-login-password');
        this.toggleRegisterPasswordBtn = document.getElementById('toggle-register-password');
        this.toggleRegisterPasswordConfirmBtn = document.getElementById('toggle-register-password-confirm');
        this.toggleDeletePasswordBtn = document.getElementById('toggle-delete-password');
        
        // Password strength indicator
        this.passwordStrengthIndicator = document.getElementById('password-strength-indicator');
        
        // Profile modal elements
        this.profileFirstNameInput = document.getElementById('profile-first-name');
        this.profileLastNameInput = document.getElementById('profile-last-name');
        this.deletePasswordInput = document.getElementById('delete-password');
        this.updateProfileSubmitBtn = document.getElementById('update-profile-submit');
        this.deleteAccountSubmitBtn = document.getElementById('delete-account-submit');
        this.profileErrorDiv = document.getElementById('profile-error');
    }

    setupEventListeners() {
        // Modal navigation
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        if (this.profileBtn) {
            this.profileBtn.addEventListener('click', () => this.showProfileModal());
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
        
        if (this.closeProfileModal) {
            this.closeProfileModal.addEventListener('click', () => this.hideProfileModal());
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
        
        // Profile form submissions
        this.setupProfileFormSubmissions();
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
        this.hideProfileModal();
    }
    
    showProfileModal() {
        // Pre-populate with current user info
        const userInfo = window.authAPI.getUserInfo();
        if (userInfo) {
            if (this.profileFirstNameInput) {
                this.profileFirstNameInput.value = userInfo.firstName || '';
            }
            if (this.profileLastNameInput) {
                this.profileLastNameInput.value = userInfo.lastName || '';
            }
        }
        this.profileModal.style.display = 'block';
    }

    hideProfileModal() {
        this.profileModal.style.display = 'none';
        this.clearError(this.profileErrorDiv);
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
        
        // Delete password toggle
        if (this.toggleDeletePasswordBtn && this.deletePasswordInput) {
            this.toggleDeletePasswordBtn.addEventListener('click', () => {
                this.togglePasswordVisibility(this.deletePasswordInput, this.toggleDeletePasswordBtn);
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

        // Forgot password form submission
        if (this.forgotSubmitBtn) {
            this.forgotSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleForgotPassword();
            });
        }
    }

    async handleLogin() {
        const email = this.loginEmailInput.value.trim();
        const password = this.loginPasswordInput.value.trim();
        const rememberMe = this.rememberMeCheckbox ? this.rememberMeCheckbox.checked : false;

        if (!email || !password) {
            this.showError(this.loginErrorDiv, 'Please fill in all fields');
            return;
        }

        this.showLoading(this.loginSubmitBtn, 'Logging in...');
        this.clearError(this.loginErrorDiv);

        try {
            const result = await window.authAPI.login(email, password, rememberMe);
            console.log('Login successful:', result.user_email, rememberMe ? '(30 days)' : '(regular session)');
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

    async handleForgotPassword() {
        const email = this.forgotEmailInput.value.trim();

        if (!email) {
            this.showError(this.forgotPasswordErrorDiv, 'Please enter your email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError(this.forgotPasswordErrorDiv, 'Please enter a valid email address');
            return;
        }

        this.showLoading(this.forgotSubmitBtn, 'Sending...');
        this.clearError(this.forgotPasswordErrorDiv);

        try {
            const result = await window.authAPI.forgotPassword(email);
            console.log('Password reset request successful:', result.message);
            
            // Show success message and hide the modal
            this.showSuccess(this.forgotPasswordErrorDiv, 'Password reset instructions have been sent to your email.');
            
            // Clear the form
            this.forgotEmailInput.value = '';
            
            // Hide modal after short delay to show success message
            setTimeout(() => {
                this.hideForgotPasswordModal();
                this.clearError(this.forgotPasswordErrorDiv);
            }, 2000);
            
        } catch (error) {
            this.showError(this.forgotPasswordErrorDiv, error.message);
        } finally {
            this.hideLoading(this.forgotSubmitBtn, 'Send Reset Link');
        }
    }

    showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'auth-error';
            errorDiv.style.display = 'block';
        }
    }

    showSuccess(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'auth-success';
            errorDiv.style.display = 'block';
        }
    }

    clearError(errorDiv) {
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.className = '';
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
            // Hide login icon, show logout and profile icons
            if (this.loginBtn) {
                this.loginBtn.style.display = 'none';
            }
            if (this.logoutBtn) {
                this.logoutBtn.style.display = 'flex';
            }
            if (this.profileBtn) {
                this.profileBtn.style.display = 'flex';
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
            // Show login icon, hide logout and profile icons
            if (this.loginBtn) {
                this.loginBtn.style.display = 'flex';
            }
            if (this.logoutBtn) {
                this.logoutBtn.style.display = 'none';
            }
            if (this.profileBtn) {
                this.profileBtn.style.display = 'none';
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
            
            // Start a new session to clear previous chat history
            if (window.app && window.app.handleNewSession) {
                window.app.handleNewSession();
                console.log('New session started after logout');
            }
            
            // Also explicitly clear lookup service data
            if (window.lookupService && window.lookupService.handleNewSession) {
                window.lookupService.handleNewSession();
                console.log('Lookup service cleared after logout');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            // Still update UI state even if logout request fails
            this.updateAuthState(false);
            
            // Still start new session even if logout request failed
            if (window.app && window.app.handleNewSession) {
                window.app.handleNewSession();
                console.log('New session started after logout (despite logout error)');
            }
            
            // Also explicitly clear lookup service data even if logout failed
            if (window.lookupService && window.lookupService.handleNewSession) {
                window.lookupService.handleNewSession();
                console.log('Lookup service cleared after logout (despite logout error)');
            }
        }
    }


    checkAuthState() {
        const isLoggedIn = window.authAPI.isLoggedIn();
        this.updateAuthState(isLoggedIn);
    }
    
    // Profile form submissions
    setupProfileFormSubmissions() {
        // Update profile form submission
        if (this.updateProfileSubmitBtn) {
            this.updateProfileSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleUpdateProfile();
            });
        }

        // Delete account form submission
        if (this.deleteAccountSubmitBtn) {
            this.deleteAccountSubmitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleDeleteAccount();
            });
        }
    }
    
    async handleUpdateProfile() {
        const firstName = this.profileFirstNameInput.value.trim();
        const lastName = this.profileLastNameInput.value.trim();

        if (!firstName || !lastName) {
            this.showError(this.profileErrorDiv, 'Please fill in both first and last name');
            return;
        }

        this.showLoading(this.updateProfileSubmitBtn, 'Updating...');
        this.clearError(this.profileErrorDiv);

        try {
            const result = await window.authAPI.updateProfile(firstName, lastName);
            console.log('Profile updated successfully:', result.message);
            
            // Show success message
            this.showSuccess(this.profileErrorDiv, 'Profile updated successfully!');
            
            // Update the UI display name
            this.updateAuthState(true);
            
            // Hide modal after short delay to show success message
            setTimeout(() => {
                this.hideProfileModal();
            }, 1500);
            
        } catch (error) {
            this.showError(this.profileErrorDiv, error.message);
        } finally {
            this.hideLoading(this.updateProfileSubmitBtn, 'Update Profile');
        }
    }
    
    async handleDeleteAccount() {
        const password = this.deletePasswordInput.value.trim();

        if (!password) {
            this.showError(this.profileErrorDiv, 'Please enter your password to confirm account deletion');
            return;
        }

        // Show confirmation dialog
        const confirmDelete = confirm(
            '⚠️ Are you absolutely sure you want to delete your account?\n\n' +
            'This action cannot be undone and all your data will be permanently deleted.\n\n' +
            'Click OK to proceed with account deletion, or Cancel to keep your account.'
        );

        if (!confirmDelete) {
            return;
        }

        this.showLoading(this.deleteAccountSubmitBtn, 'Deleting Account...');
        this.clearError(this.profileErrorDiv);

        try {
            const result = await window.authAPI.deleteAccount(password);
            console.log('Account deleted successfully:', result.message);
            
            // Show success message briefly
            this.showSuccess(this.profileErrorDiv, 'Account deleted successfully. You will be logged out.');
            
            // Hide modal and update auth state after short delay
            setTimeout(() => {
                this.hideProfileModal();
                this.updateAuthState(false);
                // Clear the form
                this.deletePasswordInput.value = '';
            }, 2000);
            
        } catch (error) {
            this.showError(this.profileErrorDiv, error.message);
        } finally {
            this.hideLoading(this.deleteAccountSubmitBtn, 'Delete Account');
        }
    }
}

// Initialize AuthUI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});