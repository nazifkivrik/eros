import type { Logger } from "pino";
import { z } from "zod";
import { QualityProfilesService } from "@/application/services/quality-profiles.service.js";
import type { QualityProfile } from "@repo/shared-types";
import {
  QualityProfileParamsSchema,
  CreateQualityProfileSchema,
  UpdateQualityProfileSchema,
  QualityProfileListResponseSchema,
  QualityProfileResponseSchema,
} from "@/modules/quality-profiles/quality-profiles.schema.js";

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
  async list(): Promise<z.infer<typeof QualityProfileListResponseSchema>> {
    const profiles = await this.qualityProfilesService.getAll();
    return { data: profiles } as z.infer<typeof QualityProfileListResponseSchema>;
  }

  /**
   * Get quality profile by ID
   */
  async getById(params: unknown): Promise<z.infer<typeof QualityProfileResponseSchema>> {
    const validated = QualityProfileParamsSchema.parse(params);
    const profile = await this.qualityProfilesService.getById(validated.id);
    return profile as z.infer<typeof QualityProfileResponseSchema>;
  }

  /**
   * Create quality profile
   */
  async create(body: unknown): Promise<z.infer<typeof QualityProfileResponseSchema>> {
    const validated = CreateQualityProfileSchema.parse(body);

    const profile = await this.qualityProfilesService.create({
      name: validated.name,
      items: validated.items,
    });

    return profile as z.infer<typeof QualityProfileResponseSchema>;
  }

  /**
   * Update quality profile
   */
  async update(params: unknown, body: unknown): Promise<z.infer<typeof QualityProfileResponseSchema>> {
    const validatedParams = QualityProfileParamsSchema.parse(params);
    const validatedBody = UpdateQualityProfileSchema.parse(body);

    const updated = await this.qualityProfilesService.update(validatedParams.id, {
      name: validatedBody.name,
      items: validatedBody.items,
    });

    return updated as z.infer<typeof QualityProfileResponseSchema>;
  }

  /**
   * Delete quality profile
   */
  async delete(params: unknown): Promise<{ success: boolean }> {
    const validated = QualityProfileParamsSchema.parse(params);
    await this.qualityProfilesService.delete(validated.id);
    return { success: true };
  }
}
