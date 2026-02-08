import argon2 from "argon2";
import type { Logger } from "pino";
import { AuthRepository } from "@/infrastructure/repositories/auth.repository.js";

/**
 * DTOs for Auth Service
 */
export interface LoginDTO {
  username: string;
  password: string;
}

export interface AuthStatusDTO {
  authenticated: boolean;
  userId: string | null;
}

/**
 * Auth Service (Clean Architecture)
 * Business logic for authentication
 * Handles password verification and user validation
 */
export class AuthService {
  private authRepository: AuthRepository;
  private logger: Logger;

  constructor({ authRepository, logger }: { authRepository: AuthRepository; logger: Logger }) {
    this.authRepository = authRepository;
    this.logger = logger;
  }

  /**
   * Authenticate user with username and password
   * Business logic: Password verification using Argon2
   */
  async login(dto: LoginDTO): Promise<{ success: boolean; userId?: string }> {
    this.logger.info({ username: dto.username }, "Login attempt");

    // Find user
    const user = await this.authRepository.findByUsername(dto.username);

    if (!user) {
      this.logger.warn({ username: dto.username }, "User not found");
      throw new Error("Invalid username or password");
    }

    // Business logic: Verify password using Argon2
    const isValidPassword = await argon2.verify(user.passwordHash, dto.password);

    if (!isValidPassword) {
      this.logger.warn({ username: dto.username }, "Invalid password");
      throw new Error("Invalid username or password");
    }

    this.logger.info({ username: dto.username, userId: user.id }, "Login successful");

    return {
      success: true,
      userId: user.id,
    };
  }

  /**
   * Get user by ID (for session validation)
   */
  async getUserById(userId: string) {
    return await this.authRepository.findById(userId);
  }

  /**
   * Change username for a user
   * Business logic: Validate new username is not taken and meets requirements
   */
  async changeUsername(userId: string, newUsername: string, currentPassword: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.info({ userId, newUsername }, "Username change requested");

    // Business rule: Username must be at least 3 characters
    if (newUsername.length < 3) {
      return {
        success: false,
        message: "Username must be at least 3 characters",
      };
    }

    // Business rule: Username must be at most 50 characters
    if (newUsername.length > 50) {
      return {
        success: false,
        message: "Username must be at most 50 characters",
      };
    }

    // Get current user
    const user = await this.authRepository.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    // Business rule: Verify current password
    const isValidPassword = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValidPassword) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    // Business rule: Check if new username is already taken
    const existingUser = await this.authRepository.findByUsername(newUsername);
    if (existingUser && existingUser.id !== userId) {
      return {
        success: false,
        message: "Username already taken",
      };
    }

    // Update username
    const updated = await this.authRepository.updateUsername(userId, newUsername);

    if (updated) {
      this.logger.info({ userId, oldUsername: user.username, newUsername }, "Username changed successfully");
      return {
        success: true,
        message: "Username changed successfully",
      };
    } else {
      return {
        success: false,
        message: "Failed to update username",
      };
    }
  }
}
