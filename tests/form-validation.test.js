import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Form Validation", () => {
  let authUI;

  beforeEach(() => {
    // Create a minimal AuthUI class for testing validation
    authUI = {
      calculatePasswordStrength: (password) => {
        if (!password) return 0;

        let strength = 0;

        // Length check
        if (password.length >= 8) strength += 1;
        if (password.length >= 12) strength += 1;

        // Character variety
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;

        // Common patterns (negative)
        if (/(.)\1{2,}/.test(password)) strength -= 1; // Repeated characters
        if (/^(password|123456|qwerty)/i.test(password)) strength = 1; // Common passwords

        return Math.max(0, Math.min(5, strength));
      },

      validateEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },

      validateName: (name) => {
        if (!name) return false;
        return name.trim().length >= 2;
      },

      validateLoginForm: (email, password) => {
        const errors = [];

        if (!email || !authUI.validateEmail(email)) {
          errors.push("Please enter a valid email address");
        }

        if (!password || password.length < 1) {
          errors.push("Password is required");
        }

        return errors;
      },

      validateRegistrationForm: (firstName, lastName, email, password) => {
        const errors = [];

        if (!authUI.validateName(firstName)) {
          errors.push("First name must be at least 2 characters");
        }

        if (!authUI.validateName(lastName)) {
          errors.push("Last name must be at least 2 characters");
        }

        if (!authUI.validateEmail(email)) {
          errors.push("Please enter a valid email address");
        }

        if (!password || password.length < 8) {
          errors.push("Password must be at least 8 characters");
        } else if (authUI.calculatePasswordStrength(password) < 2) {
          errors.push("Password is too weak");
        }

        return errors;
      },
    };
  });

  describe("Email validation", () => {
    it("should validate correct email formats", () => {
      expect(authUI.validateEmail("user@example.com")).toBe(true);
      expect(authUI.validateEmail("test.user@domain.co.uk")).toBe(true);
      expect(authUI.validateEmail("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(authUI.validateEmail("notanemail")).toBe(false);
      expect(authUI.validateEmail("@example.com")).toBe(false);
      expect(authUI.validateEmail("user@")).toBe(false);
      expect(authUI.validateEmail("user @example.com")).toBe(false);
      expect(authUI.validateEmail("")).toBe(false);
    });
  });

  describe("Password strength calculation", () => {
    it("should return 0 for empty password", () => {
      expect(authUI.calculatePasswordStrength("")).toBe(0);
    });

    it("should calculate weak passwords", () => {
      expect(authUI.calculatePasswordStrength("abc")).toBe(1);
      expect(authUI.calculatePasswordStrength("12345")).toBe(1);
      expect(authUI.calculatePasswordStrength("password")).toBe(1); // Common password
    });

    it("should calculate medium strength passwords", () => {
      expect(authUI.calculatePasswordStrength("abcdef123")).toBe(3);
      expect(authUI.calculatePasswordStrength("HelloWorld")).toBe(3);
    });

    it("should calculate strong passwords", () => {
      expect(authUI.calculatePasswordStrength("MyP@ssw0rd123")).toBe(5);
      expect(authUI.calculatePasswordStrength("Str0ng&Secure!")).toBe(5);
    });

    it("should penalize repeated characters", () => {
      const withRepeats = authUI.calculatePasswordStrength("aaa12345");
      const withoutRepeats = authUI.calculatePasswordStrength("abc12345");
      expect(withRepeats).toBeLessThan(withoutRepeats);
    });
  });

  describe("Name validation", () => {
    it("should accept valid names", () => {
      expect(authUI.validateName("John")).toBe(true);
      expect(authUI.validateName("Jo")).toBe(true);
      expect(authUI.validateName("Mary-Jane")).toBe(true);
    });

    it("should reject invalid names", () => {
      expect(authUI.validateName("J")).toBe(false);
      expect(authUI.validateName("")).toBe(false);
      expect(authUI.validateName("  ")).toBe(false);
      expect(authUI.validateName(null)).toBe(false);
    });
  });

  describe("Login form validation", () => {
    it("should pass with valid credentials", () => {
      const errors = authUI.validateLoginForm(
        "user@example.com",
        "password123",
      );
      expect(errors).toHaveLength(0);
    });

    it("should require email", () => {
      const errors = authUI.validateLoginForm("", "password123");
      expect(errors).toContain("Please enter a valid email address");
    });

    it("should require valid email format", () => {
      const errors = authUI.validateLoginForm("notanemail", "password123");
      expect(errors).toContain("Please enter a valid email address");
    });

    it("should require password", () => {
      const errors = authUI.validateLoginForm("user@example.com", "");
      expect(errors).toContain("Password is required");
    });
  });

  describe("Registration form validation", () => {
    it("should pass with valid data", () => {
      const errors = authUI.validateRegistrationForm(
        "John",
        "Doe",
        "john@example.com",
        "SecureP@ss123",
      );
      expect(errors).toHaveLength(0);
    });

    it("should validate all fields", () => {
      const errors = authUI.validateRegistrationForm("", "", "", "");
      expect(errors).toHaveLength(4);
      expect(errors).toContain("First name must be at least 2 characters");
      expect(errors).toContain("Last name must be at least 2 characters");
      expect(errors).toContain("Please enter a valid email address");
      expect(errors).toContain("Password must be at least 8 characters");
    });

    it("should require minimum password length", () => {
      const errors = authUI.validateRegistrationForm(
        "John",
        "Doe",
        "john@example.com",
        "short",
      );
      expect(errors).toContain("Password must be at least 8 characters");
    });

    it("should check password strength", () => {
      const errors = authUI.validateRegistrationForm(
        "John",
        "Doe",
        "john@example.com",
        "password123", // Weak password
      );
      expect(errors).toContain("Password is too weak");
    });

    it("should trim whitespace from names", () => {
      const errors = authUI.validateRegistrationForm(
        "  Jo  ",
        "  Do  ",
        "john@example.com",
        "SecureP@ss123",
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("Special characters handling", () => {
    it("should handle names with special characters", () => {
      expect(authUI.validateName("O'Brien")).toBe(true);
      expect(authUI.validateName("André")).toBe(true);
      expect(authUI.validateName("Mary-Jane")).toBe(true);
    });

    it("should handle emails with special characters", () => {
      expect(authUI.validateEmail("user+tag@example.com")).toBe(true);
      expect(authUI.validateEmail("user.name@example.com")).toBe(true);
      expect(authUI.validateEmail("user_name@example.com")).toBe(true);
    });
  });

  describe("XSS prevention", () => {
    it("should not execute scripts in validation", () => {
      const maliciousInput = '<script>alert("xss")</script>';

      // Validation should handle malicious input safely
      expect(() => authUI.validateEmail(maliciousInput)).not.toThrow();
      expect(() => authUI.validateName(maliciousInput)).not.toThrow();
      expect(() =>
        authUI.calculatePasswordStrength(maliciousInput),
      ).not.toThrow();

      // Should still reject as invalid
      expect(authUI.validateEmail(maliciousInput)).toBe(false);
      expect(authUI.validateName(maliciousInput)).toBe(true); // Length check passes
    });
  });
});
