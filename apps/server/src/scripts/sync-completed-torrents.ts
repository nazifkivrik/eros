#!/usr/bin/env node
/**
 * One-time script to sync completed torrents from qBittorrent to database
 * This will:
 * 1. Get all completed torrents from qBittorrent
 * 2. Match them with database records by title
 * 3. Update qbitHash and trigger completion handling
 *
 * Run with: pnpm --filter=server exec tsx src/scripts/sync-completed-torrents.ts
 */

import { logger } from "@/utils/logger.js";
import { Database } from "@repo/database";
import { downloadQueue, scenes } from "@repo/database/schema";
import { eq, or } from "drizzle-orm";
import { QBittorrentAdapter } from "@/infrastructure/adapters/qbittorrent.adapter.js";

interface QBittorrentConfig {
  url: string;
  username: string;
  password: string;
}

interface QBTorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  state: string;
  save_path: string;
}

async function getQBittorrentConfig(): Promise<QBittorrentConfig> {
  // Try environment variables first
  const envUrl = process.env.QBITTORRENT_URL;
  const envUser = process.env.QBITTORRENT_USERNAME;
  const envPass = process.env.QBITTORRENT_PASSWORD;

  if (envUrl && envUser && envPass) {
    logger.info("Using qBittorrent config from environment variables");
    return {
      url: envUrl,
      username: envUser,
      password: envPass,
    };
  }

  // Fallback to common default
  logger.info("Using default qBittorrent config (http://localhost:8080)");
  return {
    url: process.env.QBITTORRENT_URL || "http://localhost:8080",
    username: process.env.QBITTORRENT_USERNAME || "admin",
    password: process.env.QBITTORRENT_PASSWORD || "password",
  };
}

async function getTorrentsFromQBit(qbit: QBittorrentAdapter): Promise<QBTorrentInfo[]> {
  const response = await fetch(`${new URL(qbit as any).baseUrl}/api/v2/torrents/info`, {
    headers: {
      Cookie: (qbit as any).cookie || "",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch torrents: ${response.statusText}`);
  }

  return await response.json();
}

function normalizeTitleForMatching(title: string): string {
  return title
    .toLowerCase()
    .replace(/[._\-[\](){}]/g, " ")  // Replace separators with space
    .replace(/\s+/g, " ")               // Collapse multiple spaces
    .trim();
}

function titlesMatch(torrentName: string, dbTitle: string): boolean {
  const normalizedTorrent = normalizeTitleForMatching(torrentName);
  const normalizedDb = normalizeTitleForMatching(dbTitle);

  // Exact match
  if (normalizedTorrent === normalizedDb) {
    return true;
  }

  // Substring match (handles cases where torrent name is longer)
  if (normalizedTorrent.includes(normalizedDb) || normalizedDb.includes(normalizedTorrent)) {
    return true;
  }

  return false;
}

async function main() {
  logger.info("Starting one-time completed torrents sync...");

  try {
    // Initialize database
    const db = new Database();

    // Get qBittorrent config and create adapter
    const qbitConfig = await getQBittorrentConfig();
    logger.info({ ...qbitConfig, password: "***" }, "Connecting to qBittorrent");

    const qbit = new QBittorrentAdapter(qbitConfig, logger);

    // Login first
    await (qbit as any).login();
    logger.info("Logged in to qBittorrent");

    // Get all torrents from qBittorrent
    const torrents = await getTorrentsFromQBit(qbit);
    logger.info({ total: torrents.length }, "Fetched torrents from qBittorrent");

    // Filter completed torrents
    const completedTorrents = torrents.filter(t => t.progress >= 1);
    logger.info({ completed: completedTorrents.length }, "Found completed torrents");

    // Get all download queue items (including failed ones)
    const queueItems = await db.query.downloadQueue.findMany({
      with: {
        scene: {
          columns: {
            title: true,
          },
        },
      },
    });

    logger.info({ queueItems: queueItems.length }, "Fetched download queue items");

    // Create a map of matched items to avoid duplicates
    const matchedItemIds = new Set<string>();
    let matchedCount = 0;
    let notFoundCount = 0;
    const notFoundTorrents: Array<{ name: string; hash: string; save_path: string }> = [];

    for (const torrent of completedTorrents) {
      // Skip if save_path is already in scenes folder (already processed)
      if (torrent.save_path.includes("/scenes/") || torrent.save_path.includes("\\scenes\\")) {
        logger.debug({ name: torrent.name, save_path: torrent.save_path }, "Skipping - already in scenes folder");
        continue;
      }

      // Try to find matching queue item
      let matchedItem = queueItems.find(item => {
        if (matchedItemIds.has(item.id)) return false;

        // First try hash match
        if (item.qbitHash && item.qbitHash.toLowerCase() === torrent.hash.toLowerCase()) {
          return true;
        }

        // Then try title match
        const itemTitle = item.scene?.title || item.title;
        if (itemTitle && titlesMatch(torrent.name, itemTitle)) {
          return true;
        }

        return false;
      });

      if (matchedItem) {
        matchedItemIds.add(matchedItem.id);
        matchedCount++;

        logger.info({
          torrentName: torrent.name,
          torrentHash: torrent.hash,
          queueItemId: matchedItem.id,
          queueItemTitle: matchedItem.title,
          currentStatus: matchedItem.status,
        }, "Found match - updating qbitHash");

        // Update qbitHash and status
        await db.update(downloadQueue)
          .set({
            qbitHash: torrent.hash,
            status: matchedItem.status === "completed" ? "completed" : "downloading",
          })
          .where(eq(downloadQueue.id, matchedItem.id));

        logger.info({ queueItemId: matchedItem.id, torrentHash: torrent.hash }, "Updated qbitHash in database");
      } else {
        notFoundCount++;
        notFoundTorrents.push({
          name: torrent.name,
          hash: torrent.hash,
          save_path: torrent.save_path,
        });
      }
    }

    logger.info({
      matched: matchedCount,
      notFound: notFoundCount,
    }, "Matching complete");

    // Log torrents that couldn't be matched
    if (notFoundTorrents.length > 0) {
      logger.warn("The following completed torrents could not be matched to database records:");
      for (const t of notFoundTorrents) {
        logger.warn({ name: t.name, hash: t.hash, save_path: t.save_path }, "Unmatched torrent");
      }
    }

    logger.info("Sync complete! The torrent-monitor job will now process these torrents on the next run (every 5 minutes).");
    logger.info("If you want to trigger processing immediately, restart the server or wait for the next job run.");

    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Script failed");
    process.exit(1);
  }
}

main();
