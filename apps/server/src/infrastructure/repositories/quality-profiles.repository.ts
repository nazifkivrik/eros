import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { qualityProfiles } from "@repo/database";

/**
 * Quality Profiles Repository
 * Handles all database operations for quality profiles
 * Pure data access - no business logic
 */
export class QualityProfilesRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find all quality profiles
   */
  async findAll() {
    return await this.db.query.qualityProfiles.findMany({
      orderBy: (qualityProfiles, { desc }) => [desc(qualityProfiles.createdAt)],
    });
  }

  /**
   * Find quality profile by ID
   */
  async findById(id: string) {
    return await this.db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, id),
    });
  }

  /**
   * Create quality profile
   */
  async create(data: typeof qualityProfiles.$inferInsert) {
    await this.db.insert(qualityProfiles).values(data);
    return data;
  }

  /**
   * Update quality profile
   */
  async update(id: string, data: Partial<typeof qualityProfiles.$inferInsert>) {
    await this.db
      .update(qualityProfiles)
      .set(data)
      .where(eq(qualityProfiles.id, id));

    return await this.findById(id);
  }

  /**
   * Delete quality profile
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(qualityProfiles).where(eq(qualityProfiles.id, id));
  }

  /**
   * Check if quality profile exists
   */
  async exists(id: string): Promise<boolean> {
    const profile = await this.findById(id);
    return !!profile;
  }
}
