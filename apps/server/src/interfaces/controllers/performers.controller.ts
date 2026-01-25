import type { Logger } from "pino";
import { z } from "zod";
import { PerformersService } from "@/application/services/performers.service.js";
import type { SubscriptionsService } from "@/application/services/subscriptions.service.js";
import type { Performer } from "@repo/shared-types";
import {
  PerformerListQuerySchema,
  CreatePerformerSchema,
  UpdatePerformerSchema,
  PerformerParamsSchema,
  PerformerListResponseSchema,
  PerformerResponseSchema,
} from "@/modules/performers/performers.schema.js";

/**
 * Performers Controller
 * Handles HTTP request/response for performers endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class PerformersController {
  private performersService: PerformersService;
  private subscriptionsService: SubscriptionsService;
  private logger: Logger;

  constructor({
    performersService,
    subscriptionsService,
    logger,
  }: {
    performersService: PerformersService;
    subscriptionsService: SubscriptionsService;
    logger: Logger;
  }) {
    this.performersService = performersService;
    this.subscriptionsService = subscriptionsService;
    this.logger = logger;
  }

  /**
   * List performers with pagination
   */
  async list(query: unknown): Promise<z.infer<typeof PerformerListResponseSchema>> {
    // Validate request
    const validated = PerformerListQuerySchema.parse(query);

    // Call service
    const result = await this.performersService.getAll({
      limit: validated.limit,
      offset: validated.offset,
    });

    return result;
  }

  /**
   * Get performer by ID
   */
  async getById(params: unknown): Promise<z.infer<typeof PerformerResponseSchema>> {
    // Validate request
    const validated = PerformerParamsSchema.parse(params);

    // Call service
    const performer = await this.performersService.getById(validated.id);

    return performer;
  }

  /**
   * Create new performer
   */
  async create(body: unknown): Promise<z.infer<typeof PerformerResponseSchema>> {
    // Validate request
    const validated = CreatePerformerSchema.parse(body);

    // Call service with externalIds for flexibility
    const created = await this.performersService.create({
      name: validated.name,
      externalIds: validated.tpdbId ? [{ source: "tpdb", id: validated.tpdbId }] : undefined,
      aliases: validated.aliases,
      disambiguation: validated.disambiguation,
      gender: validated.gender,
      birthdate: validated.birthdate,
      deathDate: validated.deathDate,
      images: validated.images.map(img => ({ ...img, type: "profile" })), // Add type property
    });

    return created as z.infer<typeof PerformerResponseSchema>;
  }

  /**
   * Update performer
   */
  async update(params: unknown, body: unknown): Promise<z.infer<typeof PerformerResponseSchema>> {
    // Validate request
    const validatedParams = PerformerParamsSchema.parse(params);
    const validatedBody = UpdatePerformerSchema.parse(body);

    // Call service with externalIds for flexibility
    const updated = await this.performersService.update(validatedParams.id, {
      name: validatedBody.name,
      externalIds: validatedBody.tpdbId ? [{ source: "tpdb", id: validatedBody.tpdbId }] : undefined,
      aliases: validatedBody.aliases,
      disambiguation: validatedBody.disambiguation,
      gender: validatedBody.gender,
      birthdate: validatedBody.birthdate,
      deathDate: validatedBody.deathDate,
      images: validatedBody.images?.map(img => ({ ...img, type: "profile" })),
    });

    return updated as z.infer<typeof PerformerResponseSchema>;
  }

  /**
   * Delete performer
   */
  async delete(
    params: unknown,
    query: { deleteAssociatedScenes?: boolean; removeFiles?: boolean }
  ): Promise<{ success: boolean }> {
    // Validate request
    const validated = PerformerParamsSchema.parse(params);

    // Call service (pass subscription service for handling subscriptions)
    await this.performersService.delete(
      validated.id,
      {
        deleteAssociatedScenes: query.deleteAssociatedScenes,
        removeFiles: query.removeFiles,
      },
      this.subscriptionsService
    );

    return { success: true };
  }
}
