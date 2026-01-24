/**
 * Studios Repository
 * Handles all database operations for studios
 */

import type { Database } from "@repo/database";
import { studios } from "@repo/database";
import { eq, desc } from "drizzle-orm";

export class StudiosRepository {
  constructor(private db: Database) {}

  /**
   * Find studio by ID
   */
  async findById(id: string) {
    const result = await this.db.query.studios.findFirst({
      where: eq(studios.id, id),
    });
    return result || null;
  }

  /**
   * Find studio by name
   */
  async findByName(name: string) {
    const result = await this.db.query.studios.findFirst({
      where: eq(studios.name, name),
    });
    return result || null;
  }

  /**
   * Get all studios
   */
  async findAll() {
    return await this.db.query.studios.findMany({
      orderBy: [desc(studios.createdAt)],
    });
  }
}
