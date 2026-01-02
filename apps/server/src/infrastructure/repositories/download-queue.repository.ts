import { eq, and } from "drizzle-orm";
import type { Database } from "@repo/database";
import { downloadQueue } from "@repo/database/schema";
import type { DownloadStatus } from "@repo/shared-types";

/**
 * Download Queue Repository
 * Data access layer for download queue
 * Responsibilities:
 * - Database CRUD operations for download queue
 * - No business logic
 */
export class DownloadQueueRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find all download queue items
   */
  async findAll(statusFilter?: DownloadStatus) {
    return await this.db.query.downloadQueue.findMany({
      where: statusFilter ? eq(downloadQueue.status, statusFilter) : undefined,
      with: {
        scene: {
          columns: {
            id: true,
            title: true,
            externalIds: true,
            images: true,
          },
        },
      },
      orderBy: (downloadQueue, { desc }) => [desc(downloadQueue.addedAt)],
    });
  }

  /**
   * Find download queue item by ID
   */
  async findById(id: string) {
    const item = await this.db.query.downloadQueue.findFirst({
      where: eq(downloadQueue.id, id),
      with: {
        scene: {
          columns: {
            id: true,
            title: true,
            externalIds: true,
            images: true,
          },
        },
      },
    });
    return item || null;
  }

  /**
   * Find download queue item by scene ID and status
   */
  async findBySceneIdAndStatus(sceneId: string, status: DownloadStatus) {
    const item = await this.db.query.downloadQueue.findFirst({
      where: and(
        eq(downloadQueue.sceneId, sceneId),
        eq(downloadQueue.status, status)
      ),
    });
    return item || null;
  }

  /**
   * Create a new download queue item
   */
  async create(data: typeof downloadQueue.$inferInsert) {
    await this.db.insert(downloadQueue).values(data);
    return await this.findById(data.id);
  }

  /**
   * Update download queue item
   */
  async update(
    id: string,
    data: Partial<typeof downloadQueue.$inferInsert>
  ) {
    await this.db.update(downloadQueue).set(data).where(eq(downloadQueue.id, id));
    return await this.findById(id);
  }

  /**
   * Delete download queue item
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(downloadQueue).where(eq(downloadQueue.id, id));
  }

  /**
   * Find all queue items with full scene and studio info (for unified downloads)
   */
  async findAllWithFullDetails() {
    return await this.db.query.downloadQueue.findMany({
      with: {
        scene: {
          columns: {
            id: true,
            title: true,
            images: true,
          },
          with: {
            site: {
              columns: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: (downloadQueue, { desc }) => [desc(downloadQueue.addedAt)],
    });
  }

  /**
   * Check if scene exists
   */
  async sceneExists(sceneId: string): Promise<boolean> {
    const scene = await this.db.query.scenes.findFirst({
      where: (scenes, { eq }) => eq(scenes.id, sceneId),
    });
    return !!scene;
  }
}
