import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { QualityItem } from "@repo/shared-types";
import { QualityProfilesRepository } from "../../infrastructure/repositories/quality-profiles.repository.js";

/**
 * DTOs for Quality Profiles Service
 */
export interface CreateQualityProfileDTO {
  name: string;
  items: QualityItem[];
}

export interface UpdateQualityProfileDTO {
  name?: string;
  items?: QualityItem[];
}

/**
 * Quality Profiles Service (Clean Architecture)
 * Business logic for quality profile management
 * Handles quality/source sorting logic
 */
export class QualityProfilesService {
  // Define quality order (best to worst)
  private readonly qualityOrder = ["2160p", "1080p", "720p", "480p", "any"];
  private readonly sourceOrder = ["bluray", "webdl", "webrip", "hdtv", "dvd", "any"];

  constructor({
    qualityProfilesRepository,
    logger,
  }: {
    qualityProfilesRepository: QualityProfilesRepository;
    logger: Logger;
  }) {
    this.qualityProfilesRepository = qualityProfilesRepository;
    this.logger = logger;
  }

  /**
   * Sort quality profile items from best to worst
   * This is the core business logic for quality profiles
   */
  private sortItems(items: QualityItem[]): QualityItem[] {
    return [...items].sort((a, b) => {
      const qualityDiff = this.qualityOrder.indexOf(a.quality) - this.qualityOrder.indexOf(b.quality);
      if (qualityDiff !== 0) return qualityDiff;

      // If quality is same, sort by source
      return this.sourceOrder.indexOf(a.source) - this.sourceOrder.indexOf(b.source);
    });
  }

  /**
   * Get all quality profiles
   */
  async getAll() {
    this.logger.info("Fetching all quality profiles");
    const profiles = await this.qualityProfilesRepository.findAll();
    return profiles;
  }

  /**
   * Get quality profile by ID
   */
  async getById(id: string) {
    this.logger.info({ profileId: id }, "Fetching quality profile by ID");
    const profile = await this.qualityProfilesRepository.findById(id);

    if (!profile) {
      throw new Error("Quality profile not found");
    }

    return profile;
  }

  /**
   * Create quality profile
   * Automatically sorts items from best to worst
   */
  async create(dto: CreateQualityProfileDTO) {
    this.logger.info({ name: dto.name }, "Creating quality profile");

    const id = nanoid();
    const now = new Date().toISOString();

    // Apply business logic: sort items
    const sortedItems = this.sortItems(dto.items);

    const profileData = {
      id,
      name: dto.name,
      items: sortedItems,
      createdAt: now,
      updatedAt: now,
    };

    return await this.qualityProfilesRepository.create(profileData);
  }

  /**
   * Update quality profile
   * Automatically sorts items from best to worst
   */
  async update(id: string, dto: UpdateQualityProfileDTO) {
    this.logger.info({ profileId: id }, "Updating quality profile");

    // Check if exists
    const exists = await this.qualityProfilesRepository.exists(id);
    if (!exists) {
      throw new Error("Quality profile not found");
    }

    const now = new Date().toISOString();

    // Apply business logic: sort items if provided
    const updateData: any = {
      updatedAt: now,
    };

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.items) {
      updateData.items = this.sortItems(dto.items);
    }

    return await this.qualityProfilesRepository.update(id, updateData);
  }

  /**
   * Delete quality profile
   */
  async delete(id: string) {
    this.logger.info({ profileId: id }, "Deleting quality profile");

    // Check if exists
    const exists = await this.qualityProfilesRepository.exists(id);
    if (!exists) {
      throw new Error("Quality profile not found");
    }

    await this.qualityProfilesRepository.delete(id);
    this.logger.info({ profileId: id }, "Quality profile deleted");
  }
}
