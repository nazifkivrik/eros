import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { users } from "@repo/database";

/**
 * Auth Repository
 * Handles database operations for authentication
 * Pure data access - no business logic
 */
export class AuthRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string) {
    const userList = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return userList.length > 0 ? userList[0] : null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string) {
    const userList = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return userList.length > 0 ? userList[0] : null;
  }
}
