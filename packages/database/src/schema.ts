import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

// Helper function for timestamps
const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
};

// Performers Table
export const performers = sqliteTable("performers", {
  id: text("id").primaryKey(),
  stashdbId: text("stashdb_id").unique(),
  name: text("name").notNull(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  disambiguation: text("disambiguation"),
  gender: text("gender"),
  birthdate: text("birthdate"),
  deathDate: text("death_date"),
  careerStartDate: text("career_start_date"),
  careerEndDate: text("career_end_date"),
  careerLength: text("career_length"),
  bio: text("bio"),
  measurements: text("measurements"),
  tattoos: text("tattoos"),
  piercings: text("piercings"),
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  ...timestamps,
});

// Studios Table (self-referencing)
export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  stashdbId: text("stashdb_id").unique(),
  name: text("name").notNull(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  parentStudioId: text("parent_studio_id"),
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  url: text("url"),
  ...timestamps,
});

// Scenes Table
export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  stashdbId: text("stashdb_id").unique(),
  title: text("title").notNull(),
  date: text("date"),
  details: text("details"),
  duration: integer("duration"),
  director: text("director"),
  code: text("code"),
  urls: text("urls", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  hasMetadata: integer("has_metadata", { mode: "boolean" }).notNull().default(true),
  inferredFromIndexers: integer("inferred_from_indexers", { mode: "boolean" })
    .notNull()
    .default(false),
  ...timestamps,
});

// Performers-Scenes Junction Table
export const performersScenes = sqliteTable(
  "performers_scenes",
  {
    performerId: text("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.performerId, table.sceneId] }),
  })
);

// Studios-Scenes Junction Table
export const studiosScenes = sqliteTable(
  "studios_scenes",
  {
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.studioId, table.sceneId] }),
  })
);

// Quality Profiles Table
export const qualityProfiles = sqliteTable("quality_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  items: text("items", { mode: "json" })
    .$type<
      Array<{
        quality: string;
        source: string;
        minSeeders: number | "any"; // can be "any" or a number
        maxSize: number; // in GB
      }>
    >()
    .notNull(),
  ...timestamps,
});

// Subscriptions Table
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").$type<"performer" | "studio" | "scene">().notNull(),
  entityId: text("entity_id").notNull(),
  qualityProfileId: text("quality_profile_id")
    .notNull()
    .references(() => qualityProfiles.id),
  autoDownload: integer("auto_download", { mode: "boolean" }).notNull().default(true),
  includeMetadataMissing: integer("include_metadata_missing", { mode: "boolean" })
    .notNull()
    .default(false),
  includeAliases: integer("include_aliases", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"), // 'active' | 'paused' | 'inactive'
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(true),
  searchCutoffDate: text("search_cutoff_date"),
  ...timestamps,
});

// Indexers Table
export const indexers = sqliteTable("indexers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'prowlarr' | 'manual'
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"),
  priority: integer("priority").notNull().default(50),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Meta Sources Table
export const metaSources = sqliteTable("meta_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'stashdb' | 'theporndb' | 'custom'
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"),
  priority: integer("priority").notNull().default(50),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Download Queue Table
export const downloadQueue = sqliteTable("download_queue", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  torrentHash: text("torrent_hash"),
  qbitHash: text("qbit_hash"),
  indexerId: text("indexer_id").notNull(), // Prowlarr indexer ID (no FK constraint)
  indexerName: text("indexer_name"), // Indexer name from Prowlarr
  title: text("title").notNull(),
  size: integer("size").notNull(),
  seeders: integer("seeders").notNull(),
  quality: text("quality").notNull(),
  status: text("status").notNull().default("queued"), // 'queued' | 'downloading' | 'completed' | 'failed' | 'paused'
  addedAt: text("added_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

// Scene Files Table
export const sceneFiles = sqliteTable("scene_files", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  size: integer("size").notNull(),
  quality: text("quality").notNull(),
  dateAdded: text("date_added")
    .notNull()
    .default(sql`(datetime('now'))`),
  relativePath: text("relative_path").notNull(),
  nfoPath: text("nfo_path"),
  posterPath: text("poster_path"),
});

// Tags Table
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Scenes-Tags Junction Table
export const scenesTags = sqliteTable(
  "scenes_tags",
  {
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sceneId, table.tagId] }),
  })
);

// Search History Table
export const searchHistory = sqliteTable("search_history", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  entityType: text("entity_type"), // 'performer' | 'studio' | 'scene' | 'all'
  resultsCount: integer("results_count").notNull(),
  searchedAt: text("searched_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Jobs Log Table
export const jobsLog = sqliteTable("jobs_log", {
  id: text("id").primaryKey(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(), // 'running' | 'completed' | 'failed'
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
});

// App Settings Table
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Logs Table
export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  level: text("level").$type<"error" | "warning" | "info" | "debug">().notNull(),
  eventType: text("event_type").$type<"torrent" | "subscription" | "download" | "metadata" | "system" | "missing-scenes">().notNull(),
  message: text("message").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  performerId: text("performer_id").references(() => performers.id, { onDelete: "set null" }),
  studioId: text("studio_id").references(() => studios.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => ({
  // Index for efficient date-based queries and cleanup
  createdAtIdx: index("logs_created_at_idx").on(table.createdAt),
  // Composite index for filtering by level and date
  levelCreatedAtIdx: index("logs_level_created_at_idx").on(table.level, table.createdAt),
}));

// Scene Exclusions Table
export const sceneExclusions = sqliteTable("scene_exclusions", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(), // 'user_deleted' | 'manual_removal'
  excludedAt: text("excluded_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => ({
  sceneIdIdx: index("scene_exclusions_scene_id_idx").on(table.sceneId),
}));

// ============================================
// Relations Definitions
// ============================================

export const performersRelations = relations(performers, ({ many }) => ({
  performersScenes: many(performersScenes),
}));

export const studiosRelations = relations(studios, ({ many }) => ({
  studiosScenes: many(studiosScenes),
}));

export const scenesRelations = relations(scenes, ({ many }) => ({
  performersScenes: many(performersScenes),
  studiosScenes: many(studiosScenes),
  scenesTags: many(scenesTags),
  downloadQueue: many(downloadQueue),
  sceneFiles: many(sceneFiles),
  sceneExclusions: many(sceneExclusions),
}));

export const performersScenesRelations = relations(performersScenes, ({ one }) => ({
  performer: one(performers, {
    fields: [performersScenes.performerId],
    references: [performers.id],
  }),
  scene: one(scenes, {
    fields: [performersScenes.sceneId],
    references: [scenes.id],
  }),
}));

export const studiosScenesRelations = relations(studiosScenes, ({ one }) => ({
  studio: one(studios, {
    fields: [studiosScenes.studioId],
    references: [studios.id],
  }),
  scene: one(scenes, {
    fields: [studiosScenes.sceneId],
    references: [scenes.id],
  }),
}));

export const qualityProfilesRelations = relations(qualityProfiles, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  qualityProfile: one(qualityProfiles, {
    fields: [subscriptions.qualityProfileId],
    references: [qualityProfiles.id],
  }),
}));

export const indexersRelations = relations(indexers, ({ many }) => ({
  downloadQueue: many(downloadQueue),
}));

export const downloadQueueRelations = relations(downloadQueue, ({ one }) => ({
  scene: one(scenes, {
    fields: [downloadQueue.sceneId],
    references: [scenes.id],
  }),
  indexer: one(indexers, {
    fields: [downloadQueue.indexerId],
    references: [indexers.id],
  }),
}));

export const sceneFilesRelations = relations(sceneFiles, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneFiles.sceneId],
    references: [scenes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  scenesTags: many(scenesTags),
}));

export const scenesTagsRelations = relations(scenesTags, ({ one }) => ({
  scene: one(scenes, {
    fields: [scenesTags.sceneId],
    references: [scenes.id],
  }),
  tag: one(tags, {
    fields: [scenesTags.tagId],
    references: [tags.id],
  }),
}));

export const sceneExclusionsRelations = relations(sceneExclusions, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneExclusions.sceneId],
    references: [scenes.id],
  }),
}));
