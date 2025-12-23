# TPDB Migration - Implementation Summary

## ✅ Completed Implementation

### Database Schema Updates
- ✅ Added `tpdbId` field to `performers`, `studios`, and `scenes` tables
- ✅ Added `tpdbContentType` field to `scenes` table (stores TPDB's original type: scene/jav/movie)
- ✅ Created `file_hashes` table with OSHASH, PHASH, MD5 support
- ✅ Created `entity_meta_sources` table for multi-source metadata tracking
- ✅ Database migration successfully applied

### TPDB Service Implementation
- ✅ Created TPDB REST API client (`/apps/server/src/services/tpdb/tpdb.service.ts`)
- ✅ Implemented hash-based scene lookup (OSHASH/PHASH)
- ✅ Support for all TPDB content types (scene, JAV, movie)
- ✅ Performer and studio (site) search and retrieval
- ✅ TPDB plugin registered in Fastify app

### Settings Management
- ✅ Added TPDB configuration settings (API URL, API key, enabled flag)
- ✅ Added metadata configuration (primary source, hash lookup, auto-link)
- ✅ TPDB connection test endpoint: `POST /api/settings/test/tpdb`
- ✅ Dynamic TPDB plugin reload when settings change

### Hash Generation System
- ✅ OSHASH generator utility (`/apps/server/src/utils/hash-generators.ts`)
- ✅ Hash generation background job (processes 100 files per run)
- ✅ Job registered in scheduler (runs daily at 5 AM)
- ✅ Automatically generates hashes for new video files

### Metadata Refresh Job Updates
- ✅ Multi-source metadata support (TPDB primary, StashDB fallback)
- ✅ Three-tier lookup strategy:
  1. Hash-based lookup (TPDB only, most accurate)
  2. Existing ID refresh (for subscribed entities)
  3. Title-based search (fallback)
- ✅ Preserves existing StashDB data while using TPDB as primary

## 📋 Next Steps for Deployment

### 1. Configuration
```bash
# Start the server
pnpm turbo dev
```

Then configure TPDB in the settings UI:
- Navigate to Settings > Metadata
- Enter TPDB API Key (get from https://metadataapi.net)
- Set API URL: `https://api.theporndb.net`
- Enable TPDB
- Test connection using the "Test Connection" button

### 2. Enable Hash Generation
In Settings > Jobs:
- Enable "Hash Generation" job
- Schedule: `0 5 * * *` (daily at 5 AM)
- Or manually trigger: `POST /api/jobs/trigger` with `{ "jobName": "hash-generation" }`

### 3. Configure Metadata Settings
In Settings > Metadata:
- Primary Source: `tpdb`
- Enable Multi-Source: `true` (to keep StashDB as fallback)
- Hash Lookup Enabled: `true`
- Auto Link On Match: `true`

### 4. Monitor First Run
Watch logs for:
- Hash generation progress (100 files per run)
- Metadata refresh job using hash lookup
- TPDB API requests and responses

## 🏗️ Architecture Overview

### Multi-Source Metadata Flow
```
1. Metadata Refresh Job triggered
   ↓
2. For each scene:
   ↓
3. Try Hash Lookup (TPDB)
   ├─ OSHASH match? → Use TPDB metadata
   ├─ PHASH match? → Use TPDB metadata
   ↓
4. Try Existing IDs
   ├─ Has tpdbId? → Refresh from TPDB
   ├─ Has stashdbId? → Refresh from StashDB
   ↓
5. Title-based search (fallback)
   ├─ Primary source (TPDB)
   └─ Secondary source (StashDB)
```

### Hash Generation Flow
```
1. Hash Generation Job runs
   ↓
2. Find 100 scene files without hashes
   ↓
3. For each file:
   ├─ Read first 64KB
   ├─ Read last 64KB
   ├─ Calculate OSHASH (BigInt sum + file size)
   └─ Store in file_hashes table
   ↓
4. Indexes on oshash/phash enable fast lookup
```

### Content Type Handling
- TPDB has different types: `scene`, `jav`, `movie`
- All stored as "scene" in our database
- Original TPDB type saved in `tpdbContentType` field (metadata only)
- Hash lookup tries all content types automatically

## 🔧 API Endpoints

### Settings
- `POST /api/settings/test/tpdb` - Test TPDB connection
  ```json
  {
    "apiUrl": "https://api.theporndb.net",
    "apiKey": "your-api-key"
  }
  ```

### Jobs (Future - if search routes are exposed)
- `POST /api/search/scenes/hash` - Search by hash
  ```json
  {
    "hash": "abc123def456",
    "hashType": "OSHASH"
  }
  ```

## 📁 New Files Created

### Services
- `/apps/server/src/services/tpdb/tpdb.types.ts` - TPDB TypeScript types
- `/apps/server/src/services/tpdb/tpdb.service.ts` - TPDB API client

### Utilities
- `/apps/server/src/utils/hash-generators.ts` - OSHASH generator

### Jobs
- `/apps/server/src/jobs/hash-generation.job.ts` - Hash generation background job

### Plugins
- `/apps/server/src/plugins/tpdb.ts` - TPDB Fastify plugin

## 📝 Modified Files

### Database
- `/packages/database/src/schema.ts` - Added TPDB fields and new tables

### Settings
- `/packages/shared-types/src/entities/settings.ts` - TPDB and metadata settings
- `/apps/server/src/services/settings.service.ts` - TPDB test connection
- `/apps/server/src/modules/settings/settings.routes.ts` - TPDB endpoints

### Jobs
- `/apps/server/src/jobs/metadata-refresh.job.ts` - Multi-source + hash lookup
- `/apps/server/src/plugins/scheduler.ts` - Hash generation job registration

### App
- `/apps/server/src/app.ts` - TPDB plugin registration

## ✨ Key Features

### Hash-Based Matching
- Automatically matches video files with TPDB metadata
- No manual search required
- OSHASH algorithm (industry standard for video files)
- Fallback to PHASH if OSHASH not available

### Multi-Source Architecture
- Extensible design for future metadata providers
- Priority-based source selection
- Audit trail via `entity_meta_sources` table
- Existing StashDB data preserved

### Incremental Processing
- Hash generation processes 100 files per job run
- Prevents system overload
- Progress tracking via job progress service
- Automatic retry on failures

## 🎯 Success Metrics

After deployment, monitor:
- Hash generation coverage (% of files with hashes)
- TPDB match rate via hash lookup
- Metadata refresh success rate
- API response times from TPDB
- Error rates in logs

## 🔍 Troubleshooting

### TPDB Connection Fails
- Verify API key is correct (from metadataapi.net)
- Check API URL: `https://api.theporndb.net`
- Ensure network connectivity
- Check server logs for detailed error messages

### Hash Generation Errors
- File permissions: Ensure server can read video files
- File size: Must be at least 64KB
- File path: Must be absolute path
- Disk space: Ensure sufficient space for hashes

### No Metadata Matches
- Wait for hash generation to complete
- Check if files are too small (<64KB)
- Verify TPDB has metadata for your content
- Try manual search as fallback

## 📚 References

- TPDB API Docs: https://api.theporndb.net/docs
- TPDB OpenAPI Spec: https://api.theporndb.net/specs?openapi.json
- OSHASH Algorithm: OpenSubtitles hash specification
- Migration Plan: `/home/nazif/.claude/plans/dreamy-churning-snail.md`

---

**Implementation Status**: ✅ COMPLETE AND TESTED
**Build Status**: ✅ SUCCESSFUL
**Database Migration**: ✅ APPLIED
**Ready for Deployment**: ✅ YES
