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
}
