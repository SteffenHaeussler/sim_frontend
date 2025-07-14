class AuthManager {
  constructor() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isAuthenticated = false;

    this.initializeElements();
    this.setupEventListeners();
    this.loadStoredTokens();
    this.updateUI();
  }

  initializeElements() {
    this.loginForm = document.getElementById("login-form");
    this.userInfo = document.getElementById("user-info");
    this.loginEmail = document.getElementById("login-email");
    this.loginPassword = document.getElementById("login-password");
    this.loginBtn = document.getElementById("login-btn");
    this.logoutBtn = document.getElementById("logout-btn");
    this.loginError = document.getElementById("login-error");
    this.userName = document.getElementById("user-name");
    this.userRole = document.getElementById("user-role");
    this.userOrg = document.getElementById("user-org");
  }

  setupEventListeners() {
    this.loginBtn.addEventListener("click", () => this.handleLogin());
    this.logoutBtn.addEventListener("click", () => this.handleLogout());

    // Allow Enter key to submit login form
    this.loginEmail.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin();
    });
    this.loginPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin();
    });
  }

  async handleLogin() {
    const email = this.loginEmail.value.trim();
    const password = this.loginPassword.value;

    if (!email || !password) {
      this.showError("Please enter both email and password");
      return;
    }

    this.setLoading(true);
    this.clearError();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
          remember_me: document.getElementById("remember-me")?.checked || false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // Store tokens and user data (adapt to backend response structure)
      this.accessToken = data.access_token;
      this.refreshToken = null; // Backend doesn't use refresh tokens yet
      this.user = {
        email: data.user_email,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name:
          `${data.first_name} ${data.last_name}`.trim() || data.user_email,
        is_active: data.is_active,
      };
      this.isAuthenticated = true;

      // Calculate token expiry
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      // Store in localStorage
      this.storeTokens();

      // Update UI
      this.updateUI();

      // Clear form
      this.loginEmail.value = "";
      this.loginPassword.value = "";

      // Notify app of auth change
      if (window.app) {
        window.app.updateAuthStatus();
      }

      console.log("Login successful:", this.user.email);
    } catch (error) {
      console.error("Login error:", error);
      this.showError(error.message);
    } finally {
      this.setLoading(false);
    }
  }

  async handleLogout() {
    try {
      // Call logout endpoint if we have a token
      if (this.accessToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout API error:", error);
    }

    // Clear local state regardless of API call result
    this.clearTokens();
    this.updateUI();

    // Notify app of auth change
    if (window.app) {
      window.app.updateAuthStatus();
    }

    console.log("Logged out successfully");
  }

  storeTokens() {
    if (this.accessToken) {
      localStorage.setItem("auth_access_token", this.accessToken);
      localStorage.setItem("auth_token_expiry", this.tokenExpiry.toString());
      localStorage.setItem("auth_user", JSON.stringify(this.user));
    }
  }

  loadStoredTokens() {
    const accessToken = localStorage.getItem("auth_access_token");
    const tokenExpiry = localStorage.getItem("auth_token_expiry");
    const userData = localStorage.getItem("auth_user");

    if (accessToken && tokenExpiry && userData) {
      this.accessToken = accessToken;
      this.tokenExpiry = parseInt(tokenExpiry);
      this.user = JSON.parse(userData);

      // Check if token is still valid
      if (Date.now() < this.tokenExpiry) {
        this.isAuthenticated = true;
        console.log("Restored authentication for:", this.user.email);
      } else {
        console.log("Stored token expired, clearing...");
        this.clearTokens();
      }
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.user = null;
    this.isAuthenticated = false;

    localStorage.removeItem("auth_access_token");
    localStorage.removeItem("auth_token_expiry");
    localStorage.removeItem("auth_user");
  }

  updateUI() {
    if (this.isAuthenticated && this.user) {
      // Show user info, hide login form
      if (this.loginForm) this.loginForm.style.display = "none";
      if (this.userInfo) this.userInfo.style.display = "block";

      // Update user details
      if (this.userName)
        this.userName.textContent = this.user.full_name || this.user.email;
      if (this.userRole)
        this.userRole.textContent = this.user.is_active
          ? "Active User"
          : "Inactive User";
      if (this.userOrg) this.userOrg.textContent = "Organisation Member";
    } else {
      // Show login form, hide user info
      if (this.loginForm) this.loginForm.style.display = "block";
      if (this.userInfo) this.userInfo.style.display = "none";
    }
  }

  setLoading(loading) {
    this.loginBtn.disabled = loading;
    this.loginBtn.textContent = loading ? "Logging in..." : "Login";
  }

  showError(message) {
    this.loginError.textContent = message;
  }

  clearError() {
    this.loginError.textContent = "";
  }

  // Get auth headers for API requests
  getAuthHeaders() {
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      };
    }
    return {
      "Content-Type": "application/json",
    };
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return (
      this.isAuthenticated && this.accessToken && Date.now() < this.tokenExpiry
    );
  }

  // Get current user info
  getCurrentUser() {
    return this.user;
  }

  // Check if token needs refresh (expires within 5 minutes)
  needsTokenRefresh() {
    if (!this.tokenExpiry) return false;
    return Date.now() > this.tokenExpiry - 5 * 60 * 1000; // 5 minutes before expiry
  }

  // Check if token needs refresh - for future implementation
  async refreshAccessToken() {
    // Backend doesn't support refresh tokens yet
    // For now, just clear tokens and require re-login
    console.log("Token expired, please log in again");
    this.clearTokens();
    this.updateUI();
    return false;
  }

  // Make authenticated API request with automatic token refresh
  async authenticatedFetch(url, options = {}) {
    // Check if we need to refresh token
    if (this.needsTokenRefresh()) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        throw new Error("Authentication required");
      }
    }

    // Add auth headers
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }
}
