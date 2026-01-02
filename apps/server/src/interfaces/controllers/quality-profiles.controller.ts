import type { Logger } from "pino";
import { QualityProfilesService } from "../../application/services/quality-profiles.service.js";
import {
  QualityProfileParamsSchema,
  CreateQualityProfileSchema,
  UpdateQualityProfileSchema,
} from "../../modules/quality-profiles/quality-profiles.schema.js";

/**
 * Quality Profiles Controller
 * Handles HTTP request/response for quality profiles endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class QualityProfilesController {
  private qualityProfilesService: QualityProfilesService;
  private logger: Logger;

  constructor({
    qualityProfilesService,
    logger,
  }: {
    qualityProfilesService: QualityProfilesService;
    logger: Logger;
  }) {
    this.qualityProfilesService = qualityProfilesService;
    this.logger = logger;
  }

  /**
   * List all quality profiles
   */
  async list() {
    const profiles = await this.qualityProfilesService.getAll();
    return { data: profiles };
  }

  /**
   * Get quality profile by ID
   */
  async getById(params: unknown) {
    const validated = QualityProfileParamsSchema.parse(params);
    const profile = await this.qualityProfilesService.getById(validated.id);
    return profile;
  }

  /**
   * Create quality profile
   */
  async create(body: unknown) {
    const validated = CreateQualityProfileSchema.parse(body);

    const profile = await this.qualityProfilesService.create({
      name: validated.name,
      items: validated.items,
    });

    return profile;
  }

  /**
   * Update quality profile
   */
  async update(params: unknown, body: unknown) {
    const validatedParams = QualityProfileParamsSchema.parse(params);
    const validatedBody = UpdateQualityProfileSchema.parse(body);

    const updated = await this.qualityProfilesService.update(validatedParams.id, {
      name: validatedBody.name,
      items: validatedBody.items,
    });

    return updated;
  }

  /**
   * Delete quality profile
   */
  async delete(params: unknown) {
    const validated = QualityProfileParamsSchema.parse(params);
    await this.qualityProfilesService.delete(validated.id);
    return { success: true };
  }
}
