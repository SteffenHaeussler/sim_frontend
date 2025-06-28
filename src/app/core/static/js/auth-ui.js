// A helper to convert kebab-case (like 'login-btn') to camelCase (like 'loginBtn')
const toCamelCase = str => str.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// A utility to query elements, reducing verbosity
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

class AuthUI {
    constructor() {
        this.elements = {};
        this._initializeElements();
        this._setupEventListeners();
        this.checkAuthState();
    }

    /**
     * Finds all elements with an ID and stores them in this.elements in camelCase.
     */
    _initializeElements() {
        $$('[id]').forEach(el => {
            this.elements[toCamelCase(el.id)] = el;
        });
        
        // Group modals for easier management
        this.modals = [this.elements.loginModal, this.elements.registerModal, this.elements.forgotPasswordModal];
    }

    /**
     * Centralized event listener setup.
     */
    _setupEventListeners() {
        const listeners = {
            // Modal Triggers & Navigation
            'loginBtn': () => this._toggleModal(this.elements.loginModal, true),
            'logoutBtn': () => this.handleLogout(),
            'registerLink': () => this._switchModal(this.elements.loginModal, this.elements.registerModal),
            'loginLink': () => this._switchModal(this.elements.registerModal, this.elements.loginModal),
            'backToLoginLink': () => this._switchModal(this.elements.forgotPasswordModal, this.elements.loginModal),
            'forgotPasswordLink': () => this._handleForgotPasswordLink(),

            // Modal Close Buttons
            'closeLoginModal': () => this._toggleModal(this.elements.loginModal, false),
            'closeRegisterModal': () => this._toggleModal(this.elements.registerModal, false),
            'closeForgotPasswordModal': () => this._toggleModal(this.elements.forgotPasswordModal, false),

            // Form Submissions
            'loginSubmit': e => this.handleLogin(e),
            'registerSubmit': e => this.handleRegister(e),
            'forgotSubmit': e => this.handleForgotPassword(e),

            // Other Functionality
            'generatePasswordBtn': () => this.generatePassword(),
            'toggleLoginPassword': () => this._togglePasswordVisibility(this.elements.loginPassword, this.elements.toggleLoginPassword),
            'toggleRegisterPassword': () => this._togglePasswordVisibility(this.elements.registerPassword, this.elements.toggleRegisterPassword),
            'toggleRegisterPasswordConfirm': () => this._togglePasswordVisibility(this.elements.registerPasswordConfirm, this.elements.toggleRegisterPasswordConfirm),
        };

        // Attach click listeners from the config object
        for (const [elementKey, handler] of Object.entries(listeners)) {
            if (this.elements[elementKey]) {
                this.elements[elementKey].addEventListener('click', handler.bind(this));
            }
        }

        // Setup input-based validation
        this._setupFormValidationListeners();

        // Listen for Escape key to close any open modal
        document.addEventListener('keydown', e => e.key === 'Escape' && this.hideAllModals());
    }

    // --- Modal Management ---
    _toggleModal(modal, show) {
        if (modal) modal.style.display = show ? 'block' : 'none';
    }

    _switchModal(fromModal, toModal) {
        this._toggleModal(fromModal, false);
        this._toggleModal(toModal, true);
    }

    hideAllModals() {
        this.modals.forEach(modal => this._toggleModal(modal, false));
    }

    showLoginModal(message = null) {
        // Show the login modal
        this._toggleModal(this.elements.loginModal, true);
        
        // If a custom message is provided, show it in the error div
        if (message && this.elements.loginError) {
            this._showError(this.elements.loginError, message, 'auth-info');
        } else if (this.elements.loginError) {
            // Clear any existing error
            this._clearError(this.elements.loginError);
        }
        
        // Focus on the email input for better UX
        if (this.elements.loginEmail) {
            setTimeout(() => this.elements.loginEmail.focus(), 100);
        }
    }

    _handleForgotPasswordLink() {
        const { loginEmail, forgotEmail } = this.elements;
        if (loginEmail.value && forgotEmail) {
            forgotEmail.value = loginEmail.value;
            // A tiny delay ensures the field is visible before validation runs
            setTimeout(() => this._validateForm(this.elements.forgotPasswordForm), 10);
        }
        this._switchModal(this.elements.loginModal, this.elements.forgotPasswordModal);
    }

    // --- Form Validation & State ---
    _setupFormValidationListeners() {
        // Use a map to associate forms with their validation logic
        const formsToValidate = [
            { form: this.elements.loginForm, validator: this._isLoginFormValid },
            { form: this.elements.registerForm, validator: this._isRegisterFormValid },
            { form: this.elements.forgotPasswordForm, validator: this._isForgotFormValid },
        ];

        formsToValidate.forEach(({ form, validator }) => {
            if (form) {
                form.addEventListener('input', () => this._validateForm(form, validator));
                this._validateForm(form, validator); // Initial check
            }
        });

        // Specific real-time feedback listeners
        if (this.elements.registerPasswordConfirm) {
            this.elements.registerPasswordConfirm.addEventListener('input', () => this._validatePasswordMatch());
        }
        if (this.elements.registerPassword) {
            this.elements.registerPassword.addEventListener('input', () => this.updatePasswordStrength());
        }
    }

    _validateForm(form, validator) {
        if (!form) return;
        const submitBtn = form.querySelector('button[type="submit"]');
        const isValid = validator.call(this);
        if (submitBtn) {
            submitBtn.disabled = !isValid;
            submitBtn.classList.toggle('disabled', !isValid);
        }
    }

    _isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    _isLoginFormValid() {
        const { loginEmail, loginPassword } = this.elements;
        return this._isValidEmail(loginEmail.value) && loginPassword.value;
    }

    _isRegisterFormValid() {
        const { registerFirstName, registerLastName, registerEmail, registerPassword, registerPasswordConfirm } = this.elements;
        return (
            registerFirstName.value && registerLastName.value &&
            this._isValidEmail(registerEmail.value) &&
            registerPassword.value &&
            registerPassword.value === registerPasswordConfirm.value
        );
    }

    _isForgotFormValid() {
        return this._isValidEmail(this.elements.forgotEmail.value);
    }

    _validatePasswordMatch() {
        const { registerPassword, registerPasswordConfirm, passwordMatchFeedback } = this.elements;
        if (!passwordMatchFeedback || !registerPasswordConfirm.value) {
            if (passwordMatchFeedback) passwordMatchFeedback.textContent = '';
            return;
        }
        const isMatch = registerPassword.value === registerPasswordConfirm.value;
        passwordMatchFeedback.textContent = isMatch ? '✓ Passwords match' : '✗ Passwords do not match';
        passwordMatchFeedback.className = `validation-message ${isMatch ? 'success' : 'error'}`;
    }

    // --- API & Form Submission ---
    async _handleApiCall(options) {
        const { button, errorDiv, apiCall, onSuccess, loadingText, buttonText } = options;

        this._setLoadingState(button, true, loadingText);
        this._clearError(errorDiv);

        try {
            const result = await apiCall();
            if (onSuccess) onSuccess(result);
        } catch (error) {
            this._showError(errorDiv, error.message || 'An unexpected error occurred.');
        } finally {
            this._setLoadingState(button, false, buttonText);
        }
    }

    handleLogin(e) {
        e.preventDefault();
        const { loginEmail, loginPassword, rememberMe, loginSubmit, loginError } = this.elements;
        this._handleApiCall({
            button: loginSubmit,
            errorDiv: loginError,
            apiCall: () => window.authAPI.login(loginEmail.value, loginPassword.value, rememberMe.checked),
            onSuccess: () => {
                this.hideAllModals();
                this.updateAuthState(true);
            },
            loadingText: 'Logging in...',
            buttonText: 'Login',
        });
    }

    handleRegister(e) {
        e.preventDefault();
        const { registerFirstName, registerLastName, registerEmail, registerPassword, registerSubmit, registerError } = this.elements;
        this._handleApiCall({
            button: registerSubmit,
            errorDiv: registerError,
            apiCall: () => window.authAPI.register(registerFirstName.value, registerLastName.value, registerEmail.value, registerPassword.value),
            onSuccess: () => {
                this.hideAllModals();
                this.updateAuthState(true);
            },
            loadingText: 'Registering...',
            buttonText: 'Register',
        });
    }

    handleForgotPassword(e) {
        e.preventDefault();
        const { forgotEmail, forgotSubmit, forgotPasswordError } = this.elements;
        this._handleApiCall({
            button: forgotSubmit,
            errorDiv: forgotPasswordError,
            apiCall: () => window.authAPI.forgotPassword(forgotEmail.value),
            onSuccess: (result) => {
                this._showError(forgotPasswordError, result.message, 'auth-success');
                forgotEmail.value = '';
                setTimeout(() => this.hideAllModals(), 2000);
            },
            loadingText: 'Sending...',
            buttonText: 'Send Reset Link',
        });
    }

    async handleLogout() {
        try {
            await window.authAPI.logout();
            console.log('Logout successful');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            this.updateAuthState(false);
            if (window.app?.handleNewSession) window.app.handleNewSession();
            window.location.href = '/';
        }
    }

    // --- UI State & Helpers ---
    _setLoadingState(button, isLoading, text) {
        if (!button) return;
        button.disabled = isLoading;
        button.textContent = text;
    }

    _showError(errorDiv, message, className = 'auth-error') {
        if (!errorDiv) return;
        errorDiv.textContent = message;
        errorDiv.className = className;
        errorDiv.style.display = 'block';
    }

    _clearError(errorDiv) {
        if (errorDiv) errorDiv.style.display = 'none';
    }

    _togglePasswordVisibility(input, button) {
        const eyeIcon = button.querySelector('.eye-icon');
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        eyeIcon.src = `/static/icons/${isHidden ? 'eye-off' : 'eye'}.svg`;
        eyeIcon.alt = `${isHidden ? 'Hide' : 'Show'} password`;
    }

    updatePasswordStrength() {
        const password = this.elements.registerPassword.value;
        const strength = this.calculatePasswordStrength(password);

        if (!this.elements.passwordStrengthIndicator) return;
        const strengthFill = this.elements.passwordStrengthIndicator.querySelector('.strength-fill');
        const strengthText = this.elements.passwordStrengthIndicator.querySelector('.strength-text');

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

        this.elements.registerPassword.value = shuffledPassword;
        this.elements.registerPassword.type = 'text'; // Show password briefly

        // Hide password after 2 seconds
        setTimeout(() => {
            this.elements.registerPassword.type = 'password';
        }, 2000);

        // Validate password match, form completeness, and strength after generation
        setTimeout(() => {
            this._validatePasswordMatch();
            this._validateForm(this.elements.registerForm, this._isRegisterFormValid);
            this.updatePasswordStrength();
        }, 10);
    }


    updateAuthState(isLoggedIn) {
        const { loginBtn, logoutBtn, userGreeting, userName } = this.elements;
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'flex';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
        if (window.profileManager) window.profileManager.updateVisibility(isLoggedIn);

        if (isLoggedIn && userGreeting) {
            const userInfo = window.authAPI.getUserInfo();
            if (userInfo?.email) {
                const name = (userInfo.firstName || userInfo.email.split('@')[0]);
                userName.textContent = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                userGreeting.style.display = 'block';
            }
        } else if (userGreeting) {
            userGreeting.style.display = 'none';
        }
    }

    calculatePasswordStrength(password) {
        if (!password) return 'weak';
        
        let score = 0;
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety checks
        if (/[a-z]/.test(password)) score++; // lowercase
        if (/[A-Z]/.test(password)) score++; // uppercase
        if (/[0-9]/.test(password)) score++; // numbers
        if (/[^a-zA-Z0-9]/.test(password)) score++; // special chars
        
        // Return strength based on score
        if (score <= 2) return 'weak';
        if (score <= 4) return 'medium';
        return 'strong';
    }

    checkAuthState() {
        setTimeout(() => {
            const isLoggedIn = window.authAPI?.isLoggedIn();
            this.updateAuthState(isLoggedIn);
        }, 50);
    }
}

// Initialize AuthUI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});
