import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { performers } from "@repo/database";

/**
 * Performers Repository
 * Handles all database operations for performers
 * Pure data access - no business logic
 */
export class PerformersRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find performers with pagination
   */
  async findMany(limit: number, offset: number) {
    return await this.db.query.performers.findMany({
      limit,
      offset,
      orderBy: (performers, { desc }) => [desc(performers.createdAt)],
    });
  }

  /**
   * Find performer by ID
   */
  async findById(id: string) {
    return await this.db.query.performers.findFirst({
      where: eq(performers.id, id),
    });
  }

  /**
   * Get total count of performers
   */
  async count(): Promise<number> {
    const result = await this.db
      .select({ count: performers.id })
      .from(performers);
    return result.length;
  }

  /**
   * Create new performer
   */
  async create(data: typeof performers.$inferInsert) {
    await this.db.insert(performers).values(data);
    return data;
  }

  /**
   * Update performer
   */
  async update(id: string, data: Partial<typeof performers.$inferInsert>) {
    await this.db
      .update(performers)
      .set(data)
      .where(eq(performers.id, id));

    return await this.findById(id);
  }

  /**
   * Delete performer
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(performers).where(eq(performers.id, id));
  }

  /**
   * Check if performer exists
   */
  async exists(id: string): Promise<boolean> {
    const performer = await this.findById(id);
    return !!performer;
  }
}
