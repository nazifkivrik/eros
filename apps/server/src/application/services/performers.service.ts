import { nanoid } from "nanoid";
import type { Logger } from "pino";
import { PerformersRepository } from "../../infrastructure/repositories/performers.repository.js";
import type { SubscriptionService } from "./subscriptions.service.js";

/**
 * DTOs for Performers Service
 * These should eventually move to @repo/shared-types
 */
export interface CreatePerformerDTO {
  name: string;
  tpdbId?: string | null;
  aliases?: string[];
  disambiguation?: string;
  gender?: string | null;
  birthdate?: string | null;
  deathDate?: string | null;
  images?: Array<{ url: string; type: string }>;
}

export interface UpdatePerformerDTO {
  name?: string;
  tpdbId?: string | null;
  aliases?: string[];
  disambiguation?: string;
  gender?: string | null;
  birthdate?: string | null;
  deathDate?: string | null;
  images?: Array<{ url: string; type: string }>;
}

export interface ListPerformersDTO {
  limit: number;
  offset: number;
}

export interface DeletePerformerDTO {
  deleteAssociatedScenes?: boolean;
  removeFiles?: boolean;
}

/**
 * Performers Service
 * Business logic for performer management
 * Framework-agnostic - only uses DTOs and repositories
 */
export class PerformersService {
  private performersRepository: PerformersRepository;
  private logger: Logger;

  constructor({ performersRepository, logger }: { performersRepository: PerformersRepository; logger: Logger }) {
    this.performersRepository = performersRepository;
    this.logger = logger;
  }

  /**
   * Get paginated list of performers
   */
  async getAll(dto: ListPerformersDTO) {
    this.logger.info({ limit: dto.limit, offset: dto.offset }, "Fetching performers");

    const [data, total] = await Promise.all([
      this.performersRepository.findMany(dto.limit, dto.offset),
      this.performersRepository.count(),
    ]);

    return { data, total };
  }

  /**
   * Get performer by ID
   */
  async getById(id: string) {
    this.logger.info({ performerId: id }, "Fetching performer by ID");

    const performer = await this.performersRepository.findById(id);

    if (!performer) {
      throw new Error("Performer not found");
    }

    return performer;
  }

  /**
   * Create new performer
   */
  async create(dto: CreatePerformerDTO) {
    this.logger.info({ name: dto.name }, "Creating new performer");

    const id = nanoid();
    const now = new Date().toISOString();

    const performerData = {
      id,
      tpdbId: dto.tpdbId || null,
      slug: dto.name.toLowerCase().replace(/\s+/g, "-"),
      name: dto.name,
      fullName: dto.name,
      rating: 0,
      aliases: dto.aliases || [],
      disambiguation: dto.disambiguation || null,
      gender: dto.gender || null,
      birthdate: dto.birthdate || null,
      deathDate: dto.deathDate || null,
      images: dto.images || [],
      fakeBoobs: false,
      sameSexOnly: false,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.performersRepository.create(performerData);

    this.logger.info({ performerId: created.id }, "Performer created");

    return created;
  }

  /**
   * Update existing performer
   */
  async update(id: string, dto: UpdatePerformerDTO) {
    this.logger.info({ performerId: id }, "Updating performer");

    // Check if exists
    const exists = await this.performersRepository.exists(id);
    if (!exists) {
      throw new Error("Performer not found");
    }

    const now = new Date().toISOString();

    const updated = await this.performersRepository.update(id, {
      ...dto,
      updatedAt: now,
    });

    this.logger.info({ performerId: id }, "Performer updated");

    return updated;
  }

  /**
   * Delete performer
   * Note: Subscription deletion is handled by SubscriptionService
   */
  async delete(id: string, dto: DeletePerformerDTO, subscriptionService?: SubscriptionService) {
    this.logger.info({ performerId: id, ...dto }, "Deleting performer");

    // Check if exists
    const exists = await this.performersRepository.exists(id);
    if (!exists) {
      throw new Error("Performer not found");
    }

    // If subscription service provided, handle subscription deletion
    if (subscriptionService) {
      await subscriptionService.deletePerformerSubscription(
        id,
        dto.deleteAssociatedScenes,
        dto.removeFiles
      );
    }

    // Delete performer (cascade will handle relations)
    await this.performersRepository.delete(id);

    this.logger.info({ performerId: id }, "Performer deleted");
  }
}
