/**
 * Hash Generation Job
 * Generates OSHASH for video files that don't have hashes yet
 * Runs daily at 5 AM
 */

import type { FastifyInstance } from "fastify";
import { isNull } from "drizzle-orm";
import { sceneFiles, fileHashes } from "@repo/database";
import { generateOSHash } from "../utils/hash-generators.js";
import { randomUUID } from "node:crypto";
import { getJobProgressService } from "../services/job-progress.service.js";

export async function hashGenerationJob(app: FastifyInstance) {
  const progressService = getJobProgressService();

  progressService.emitStarted("hash-generation", "Starting hash generation job");
  app.log.info("Starting hash generation job");

  try {
    // Find scene files without hashes (limit 100 per run to avoid overwhelming the system)
    const filesWithoutHashes = await app.db.query.sceneFiles.findMany({
      limit: 100,
      with: {
        fileHashes: true,
      },
    });

    const filesToProcess = filesWithoutHashes.filter(
      (f) => !f.fileHashes || f.fileHashes.length === 0
    );

    progressService.emitProgress(
      "hash-generation",
      `Found ${filesToProcess.length} files to process`,
      0,
      filesToProcess.length
    );

    app.log.info(`Found ${filesToProcess.length} files without hashes to process`);

    if (filesToProcess.length === 0) {
      progressService.emitCompleted(
        "hash-generation",
        "No files to process",
        { processedCount: 0 }
      );
      app.log.info("No files to process, hash generation job completed");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        progressService.emitProgress(
          "hash-generation",
          `Generating hash for: ${file.relativePath}`,
          i,
          filesToProcess.length,
          { fileName: file.relativePath }
        );

        app.log.debug({ fileId: file.id, filePath: file.filePath }, "Generating OSHASH");

        const oshash = await generateOSHash(file.filePath);

        await app.db.insert(fileHashes).values({
          id: randomUUID(),
          sceneFileId: file.id,
          oshash,
          phash: null,
          md5: null,
          calculatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        successCount++;
        app.log.info(
          { fileId: file.id, oshash, fileName: file.relativePath },
          "Generated OSHASH for file"
        );
      } catch (error) {
        errorCount++;
        app.log.error(
          {
            error,
            fileId: file.id,
            filePath: file.filePath,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          "Failed to generate hash for file"
        );
      }
    }

    progressService.emitCompleted(
      "hash-generation",
      `Completed: Generated ${successCount} hashes, ${errorCount} errors`,
      { total: filesToProcess.length, success: successCount, errors: errorCount }
    );

    app.log.info(
      {
        total: filesToProcess.length,
        success: successCount,
        errors: errorCount,
      },
      "Hash generation job completed"
    );
  } catch (error) {
    progressService.emitFailed(
      "hash-generation",
      `Hash generation job failed: ${error instanceof Error ? error.message : String(error)}`
    );
    app.log.error({ error }, "Hash generation job failed");
    throw error;
  }
}
