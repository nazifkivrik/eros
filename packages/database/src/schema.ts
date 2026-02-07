import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

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
  externalIds: text("external_ids", { mode: "json" })
    .$type<Array<{ source: string; id: string }>>()
    .notNull()
    .default(sql`'[]'`),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  disambiguation: text("disambiguation"),
  bio: text("bio"),
  rating: real("rating").notNull().default(0),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),

  // Physical attributes
  gender: text("gender"),
  birthdate: text("birthdate"),
  deathDate: text("death_date"),
  birthplace: text("birthplace"),
  birthplaceCode: text("birthplace_code"),
  astrology: text("astrology"),
  ethnicity: text("ethnicity"),
  nationality: text("nationality"),

  // Appearance
  hairColour: text("hair_colour"),
  eyeColour: text("eye_colour"),
  height: text("height"),
  weight: text("weight"),
  measurements: text("measurements"),
  cupsize: text("cupsize"),
  waist: text("waist"),
  hips: text("hips"),
  tattoos: text("tattoos"),
  piercings: text("piercings"),
  fakeBoobs: integer("fake_boobs", { mode: "boolean" }).notNull().default(false),

  // Career
  careerStartYear: integer("career_start_year"),
  careerEndYear: integer("career_end_year"),
  sameSexOnly: integer("same_sex_only", { mode: "boolean" }).notNull().default(false),

  // Media
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  thumbnail: text("thumbnail"),
  poster: text("poster"),

  // External links
  links: text("links", { mode: "json" }).$type<Array<{ url: string; platform: string }>>(),

  ...timestamps,
});

// Studios Table
export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  externalIds: text("external_ids", { mode: "json" })
    .$type<Array<{ source: string; id: string }>>()
    .notNull()
    .default(sql`'[]'`),
  name: text("name").notNull(),
  shortName: text("short_name"),
  slug: text("slug"),
  url: text("url"),
  description: text("description"),
  rating: real("rating").notNull().default(0),

  // Hierarchy
  parentStudioId: text("parent_studio_id"),
  networkId: text("network_id"),

  // Media
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  logo: text("logo"),
  favicon: text("favicon"),
  poster: text("poster"),

  // External links
  links: text("links", { mode: "json" }).$type<Array<{ url: string; platform: string }>>(),

  ...timestamps,
});

// Scenes Table
export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  externalIds: text("external_ids", { mode: "json" })
    .$type<Array<{ source: string; id: string }>>()
    .notNull()
    .default(sql`'[]'`),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date"),

  // Content type
  contentType: text("content_type").$type<"scene" | "jav" | "movie">().notNull().default("scene"),

  // Media info
  duration: integer("duration"),
  format: text("format"),

  // Identifiers
  externalId: text("external_id"),
  code: text("code"),
  sku: text("sku"),
  url: text("url"),

  // Media
  images: text("images", { mode: "json" })
    .$type<Array<{ url: string; width?: number; height?: number }>>()
    .notNull()
    .default(sql`'[]'`),
  poster: text("poster"),
  backImage: text("back_image"),
  thumbnail: text("thumbnail"),
  trailer: text("trailer"),
  background: text("background", { mode: "json" })
    .$type<{
      full: string | null;
      large: string | null;
      medium: string | null;
      small: string | null;
    }>(),

  // Metadata
  rating: real("rating").notNull().default(0),

  // Relations
  siteId: text("site_id").references(() => studios.id, { onDelete: "set null" }),

  // External links
  links: text("links", { mode: "json" }).$type<Array<{ url: string; platform: string }>>(),

  // System
  hasMetadata: integer("has_metadata", { mode: "boolean" }).notNull().default(true),
  inferredFromIndexers: integer("inferred_from_indexers", { mode: "boolean" }).notNull().default(false),
  isSubscribed: integer("is_subscribed", { mode: "boolean" }).notNull().default(true),  // Soft delete for scenes - false means unsubscribed but kept for re-subscription
  discoveryGroupId: text("discovery_group_id"),  // Links to torrent group if discovered from indexers

  ...timestamps,
});

// Directors Table
export const directors = sqliteTable("directors", {
  id: text("id").primaryKey(),
  externalIds: text("external_ids", { mode: "json" })
    .$type<Array<{ source: string; id: string }>>()
    .notNull()
    .default(sql`'[]'`),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
});

// Scene Markers Table
export const sceneMarkers = sqliteTable("scene_markers", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time"),
  ...timestamps,
});

// Scene Hashes Table
export const sceneHashes = sqliteTable("scene_hashes", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  type: text("type").$type<"oshash" | "md5" | "phash">().notNull(),
  duration: integer("duration"),
}, (table) => ({
  hashIdx: index("scene_hashes_hash_idx").on(table.hash),
  typeHashIdx: index("scene_hashes_type_hash_idx").on(table.type, table.hash),
}));

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

// Directors-Scenes Junction Table
export const directorsScenes = sqliteTable(
  "directors_scenes",
  {
    directorId: text("director_id")
      .notNull()
      .references(() => directors.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.directorId, table.sceneId] }),
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
        minSeeders: number | "any";
        maxSize: number;
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
  isSubscribed: integer("is_subscribed", { mode: "boolean" }).notNull().default(true),
  searchCutoffDate: text("search_cutoff_date"),
  ...timestamps,
}, (table) => ({
  entityIdx: index("subscription_entity_idx").on(table.entityType, table.entityId),
}));

// Meta Sources Table
export const metaSources = sqliteTable("meta_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
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
  title: text("title").notNull(),
  size: integer("size").notNull(),
  seeders: integer("seeders").notNull(),
  quality: text("quality").notNull(),
  status: text("status").notNull().default("queued"),
  addedAt: text("added_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  // Retry tracking for torrents that failed to add to qBittorrent
  addToClientAttempts: integer("add_to_client_attempts")
    .notNull()
    .default(0),
  addToClientLastAttempt: text("add_to_client_last_attempt"),
  addToClientError: text("add_to_client_error"),
}, (table) => ({
  statusAddedIdx: index("download_queue_status_added_idx").on(table.status, table.addedAt),
}));

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

// File Hashes Table
export const fileHashes = sqliteTable("file_hashes", {
  id: text("id").primaryKey(),
  sceneFileId: text("scene_file_id")
    .notNull()
    .references(() => sceneFiles.id, { onDelete: "cascade" }),
  oshash: text("oshash"),
  phash: text("phash"),
  md5: text("md5"),
  calculatedAt: text("calculated_at").notNull().default(sql`(datetime('now'))`),
  ...timestamps,
}, (table) => ({
  oshashIdx: index("file_hashes_oshash_idx").on(table.oshash),
  phashIdx: index("file_hashes_phash_idx").on(table.phash),
  sceneFileIdx: index("file_hashes_scene_file_idx").on(table.sceneFileId),
}));

// AI Match Scores Table - tracks AI matching decisions for debugging/audit
export const aiMatchScores = sqliteTable("ai_match_scores", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
  torrentTitle: text("torrent_title").notNull(),
  score: real("score").notNull(), // 0.0 - 1.0
  method: text("method").$type<"cross-encoder" | "bi-encoder" | "levenshtein">().notNull(),
  model: text("model"), // e.g., "ms-marco-MiniLM-L-6-v2"
  threshold: real("threshold").notNull(),
  matched: integer("matched", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  sceneIdx: index("ai_match_scores_scene_idx").on(table.sceneId),
  createdAtIdx: index("ai_match_scores_created_at_idx").on(table.createdAt),
}));

// Torrent Groups Table - tracks grouped torrents for discovery logic
export const torrentGroups = sqliteTable("torrent_groups", {
  id: text("id").primaryKey(),
  groupTitle: text("group_title").notNull(), // Cleaned/normalized title
  rawTitles: text("raw_titles", { mode: "json" }).$type<string[]>().notNull(), // Original torrent titles
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  torrentCount: integer("torrent_count").notNull(),
  indexerCount: integer("indexer_count").notNull(), // Unique indexers
  status: text("status").$type<"matched" | "unknown" | "ignored">().notNull(),
  aiScore: real("ai_score"), // Best match score if matched
  searchPhase: text("search_phase").$type<"performer" | "studio" | "targeted">(), // Which phase found it
  ...timestamps,
}, (table) => ({
  sceneIdx: index("torrent_groups_scene_idx").on(table.sceneId),
  statusIdx: index("torrent_groups_status_idx").on(table.status),
}));

// Entity Meta Sources Table
export const entityMetaSources = sqliteTable("entity_meta_sources", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").$type<"performer" | "studio" | "scene">().notNull(),
  entityId: text("entity_id").notNull(),
  sourceType: text("source_type").$type<"tpdb" | "manual">().notNull(),
  sourceId: text("source_id").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  lastSyncedAt: text("last_synced_at").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => ({
  entityIdx: index("entity_meta_sources_entity_idx").on(table.entityType, table.entityId),
  sourceIdx: index("entity_meta_sources_source_idx").on(table.sourceType, table.sourceId),
}));

// Tags Table
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  externalIds: text("external_ids", { mode: "json" })
    .$type<Array<{ source: string; id: string }>>()
    .notNull()
    .default(sql`'[]'`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull(),
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
  entityType: text("entity_type"),
  resultsCount: integer("results_count").notNull(),
  searchedAt: text("searched_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Jobs Log Table
export const jobsLog = sqliteTable("jobs_log", {
  id: text("id").primaryKey(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
});

// Users Table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
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
  eventType: text("event_type").$type<"torrent" | "subscription" | "download" | "metadata" | "system" | "torrent-search">().notNull(),
  message: text("message").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  performerId: text("performer_id").references(() => performers.id, { onDelete: "set null" }),
  studioId: text("studio_id").references(() => studios.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => ({
  createdAtIdx: index("logs_created_at_idx").on(table.createdAt),
  levelCreatedAtIdx: index("logs_level_created_at_idx").on(table.level, table.createdAt),
}));

// Scene Exclusions Table
export const sceneExclusions = sqliteTable("scene_exclusions", {
  id: text("id").primaryKey(),
  sceneId: text("scene_id")
    .notNull()
    .references(() => scenes.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
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
  scenes: many(scenes),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  performersScenes: many(performersScenes),
  scenesTags: many(scenesTags),
  downloadQueue: many(downloadQueue),
  sceneFiles: many(sceneFiles),
  sceneExclusions: many(sceneExclusions),
  sceneMarkers: many(sceneMarkers),
  sceneHashes: many(sceneHashes),
  directorsScenes: many(directorsScenes),
  aiMatchScores: many(aiMatchScores),
  site: one(studios, {
    fields: [scenes.siteId],
    references: [studios.id],
  }),
  discoveryGroup: one(torrentGroups, {
    fields: [scenes.discoveryGroupId],
    references: [torrentGroups.id],
  }),
}));

export const directorsRelations = relations(directors, ({ many }) => ({
  directorsScenes: many(directorsScenes),
}));

export const sceneMarkersRelations = relations(sceneMarkers, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneMarkers.sceneId],
    references: [scenes.id],
  }),
}));

export const sceneHashesRelations = relations(sceneHashes, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneHashes.sceneId],
    references: [scenes.id],
  }),
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

export const directorsScenesRelations = relations(directorsScenes, ({ one }) => ({
  director: one(directors, {
    fields: [directorsScenes.directorId],
    references: [directors.id],
  }),
  scene: one(scenes, {
    fields: [directorsScenes.sceneId],
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

export const downloadQueueRelations = relations(downloadQueue, ({ one }) => ({
  scene: one(scenes, {
    fields: [downloadQueue.sceneId],
    references: [scenes.id],
  }),
}));

export const sceneFilesRelations = relations(sceneFiles, ({ one, many }) => ({
  scene: one(scenes, {
    fields: [sceneFiles.sceneId],
    references: [scenes.id],
  }),
  fileHashes: many(fileHashes),
}));

export const fileHashesRelations = relations(fileHashes, ({ one }) => ({
  sceneFile: one(sceneFiles, {
    fields: [fileHashes.sceneFileId],
    references: [sceneFiles.id],
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

export const aiMatchScoresRelations = relations(aiMatchScores, ({ one }) => ({
  scene: one(scenes, {
    fields: [aiMatchScores.sceneId],
    references: [scenes.id],
  }),
}));

export const torrentGroupsRelations = relations(torrentGroups, ({ one }) => ({
  scene: one(scenes, {
    fields: [torrentGroups.sceneId],
    references: [scenes.id],
  }),
}));
