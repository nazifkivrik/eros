import type { Logger } from "pino";
import { SetupService } from "../../application/services/setup.service.js";
import { SetupDataSchema } from "../../modules/setup/setup.schema.js";

/**
 * Setup Controller
 * Handles HTTP request/response for setup endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class SetupController {
  private setupService: SetupService;
  private logger: Logger;

  constructor({
    setupService,
    logger,
  }: {
    setupService: SetupService;
    logger: Logger;
  }) {
    this.setupService = setupService;
    this.logger = logger;
  }

  /**
   * Get setup status
   */
  async getStatus() {
    const status = await this.setupService.getSetupStatus();
    return status;
  }

  /**
   * Complete initial setup
   */
  async completeSetup(body: unknown) {
    const validated = SetupDataSchema.parse(body);

    await this.setupService.completeSetup({
      username: validated.username,
      password: validated.password,
      settings: validated.settings,
    });

    // Return updated status
    const status = await this.setupService.getSetupStatus();
    return status;
  }
}
