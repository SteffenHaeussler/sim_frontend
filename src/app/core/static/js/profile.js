// Profile Settings Management
class ProfileManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Modal and buttons
        this.profileModal = document.getElementById('profile-modal');
        this.profileBtn = document.getElementById('profile-btn');
        this.closeProfileModal = document.getElementById('close-profile-modal');
        
        // Form elements
        this.profileFirstNameInput = document.getElementById('profile-first-name');
        this.profileLastNameInput = document.getElementById('profile-last-name');
        this.deletePasswordInput = document.getElementById('delete-password');
        this.updateProfileSubmitBtn = document.getElementById('update-profile-submit');
        this.deleteAccountSubmitBtn = document.getElementById('delete-account-submit');
        this.profileErrorDiv = document.getElementById('profile-error');
        
        // Password toggle
        this.toggleDeletePasswordBtn = document.getElementById('toggle-delete-password');
    }

    setupEventListeners() {
        if (this.profileBtn) {
            this.profileBtn.addEventListener('click', () => this.showProfileModal());
        }
        
        if (this.closeProfileModal) {
            this.closeProfileModal.addEventListener('click', () => this.hideProfileModal());
        }
        
        // Click outside modal to close
        if (this.profileModal) {
            this.profileModal.addEventListener('click', (e) => {
                if (e.target === this.profileModal) {
                    this.hideProfileModal();
                }
            });
        }
        
        // Password toggle functionality
        if (this.toggleDeletePasswordBtn && this.deletePasswordInput) {
            this.toggleDeletePasswordBtn.addEventListener('click', () => {
                this.togglePasswordVisibility(this.deletePasswordInput, this.toggleDeletePasswordBtn);
            });
        }
        
        // Form submissions
        this.setupFormSubmissions();
    }

    setupFormSubmissions() {
        const submissions = [
            { btn: this.updateProfileSubmitBtn, handler: this.handleUpdateProfile },
            { btn: this.deleteAccountSubmitBtn, handler: this.handleDeleteAccount }
        ];
        
        submissions.forEach(({ btn, handler }) => {
            if (btn) btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await handler.call(this);
            });
        });
    }

    showProfileModal() {
        const userInfo = window.authAPI.getUserInfo();
        const fields = [
            { input: this.profileFirstNameInput, value: userInfo?.firstName },
            { input: this.profileLastNameInput, value: userInfo?.lastName }
        ];
        
        fields.forEach(({ input, value }) => {
            if (input) input.value = value || '';
        });
        
        this.profileModal.style.display = 'block';
    }

    hideProfileModal() {
        this.profileModal.style.display = 'none';
        this.clearError(this.profileErrorDiv);
    }

    togglePasswordVisibility(inputField, toggleButton) {
        const eyeIcon = toggleButton.querySelector('.eye-icon');
        
        if (inputField.type === 'password') {
            inputField.type = 'text';
            eyeIcon.src = '/static/icons/eye-off.svg';
            eyeIcon.alt = 'Hide password';
        } else {
            inputField.type = 'password';
            eyeIcon.src = '/static/icons/eye.svg';
            eyeIcon.alt = 'Show password';
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
            
            this.showSuccess(this.profileErrorDiv, 'Profile updated successfully!');
            
            // Update the UI display name
            if (window.authUI) window.authUI.updateAuthState(true);
            
            setTimeout(() => this.hideProfileModal(), 1500);
            
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

        const confirmDelete = confirm(
            '⚠️ Are you absolutely sure you want to delete your account?\n\n' +
            'This action cannot be undone and all your data will be permanently deleted.\n\n' +
            'Click OK to proceed with account deletion, or Cancel to keep your account.'
        );

        if (!confirmDelete) return;

        this.showLoading(this.deleteAccountSubmitBtn, 'Deleting Account...');
        this.clearError(this.profileErrorDiv);

        try {
            const result = await window.authAPI.deleteAccount(password);
            console.log('Account deleted successfully:', result.message);
            
            this.showSuccess(this.profileErrorDiv, 'Account deleted successfully. You will be logged out.');
            
            setTimeout(() => {
                this.hideProfileModal();
                if (window.authUI) window.authUI.updateAuthState(false);
                this.deletePasswordInput.value = '';
            }, 2000);
            
        } catch (error) {
            this.showError(this.profileErrorDiv, error.message);
        } finally {
            this.hideLoading(this.deleteAccountSubmitBtn, 'Delete Account');
        }
    }

    // Utility methods
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

    // Method to show/hide profile button based on auth state
    updateVisibility(isLoggedIn) {
        if (this.profileBtn) {
            this.profileBtn.style.display = isLoggedIn ? 'flex' : 'none';
        }
    }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileManager = new ProfileManager();
});