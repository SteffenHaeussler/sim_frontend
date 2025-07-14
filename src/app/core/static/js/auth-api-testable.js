// Testable version of AuthAPI with proper exports
export class AuthAPI {
  constructor() {
    this.baseUrl = "/auth";
  }

  async login(email, password, rememberMe = false) {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          remember_me: rememberMe,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      this.storeToken(
        data.access_token,
        data.expires_in,
        data.refresh_token,
        data.refresh_token_expires_in,
      );
      this.storeUserInfo(data.user_email, data.first_name, data.last_name);
      return data;
    } catch (error) {
      throw error;
    }
  }

  storeToken(accessToken, expiresIn, refreshToken, refreshTokenExpiresIn) {
    localStorage.setItem("auth_token", accessToken);
    if (expiresIn) {
      const expirationTime = Date.now() + expiresIn * 1000;
      localStorage.setItem("auth_token_expiry", expirationTime.toString());
    }

    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
      if (refreshTokenExpiresIn) {
        const refreshExpirationTime = Date.now() + refreshTokenExpiresIn * 1000;
        localStorage.setItem(
          "refresh_token_expiry",
          refreshExpirationTime.toString(),
        );
      }
    }
  }

  storeUserInfo(email, firstName, lastName) {
    localStorage.setItem("user_email", email);
    localStorage.setItem("user_first_name", firstName || "");
    localStorage.setItem("user_last_name", lastName || "");
  }
}

// For backward compatibility, attach to window if in browser
if (typeof window !== "undefined") {
  window.AuthAPI = AuthAPI;
}
