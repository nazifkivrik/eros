import type { Logger } from "pino";
import type { FastifyRequest } from "fastify";
import { AuthService } from "@/application/services/auth.service.js";
import { LoginSchema } from "@/modules/auth/auth.schema.js";

/**
 * Auth Controller
 * Handles HTTP request/response for auth endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Session management
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class AuthController {
  private authService: AuthService;
  private logger: Logger;

  constructor({
    authService,
    logger,
  }: {
    authService: AuthService;
    logger: Logger;
  }) {
    this.authService = authService;
    this.logger = logger;
  }

  /**
   * User login
   * Validates credentials and creates session
   */
  async login(body: unknown, request: FastifyRequest) {
    const validated = LoginSchema.parse(body);

    // Authenticate via service
    const result = await this.authService.login({
      username: validated.username,
      password: validated.password,
    });

    // Session management (HTTP concern)
    request.session.authenticated = true;
    request.session.userId = result.userId!;

    return {
      success: true,
      message: "Logged in successfully",
    };
  }

  /**
   * User logout
   * Destroys session
   */
  async logout(request: FastifyRequest) {
    await request.session.destroy();

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  /**
   * Check authentication status
   * Returns current session state
   */
  async getStatus(request: FastifyRequest) {
    return {
      authenticated: request.session.authenticated ?? false,
      userId: request.session.userId ?? null,
    };
  }
}
