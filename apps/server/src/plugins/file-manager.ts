import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createFileManagerService } from "../services/file-manager.service.js";

/**
 * FileManager Plugin
 * Provides file management functionality for scenes
 */
const fileManagerPlugin: FastifyPluginAsync = async (app) => {
  const scenesPath = process.env.SCENES_PATH || "/app/media/scenes";
  const incompletePath = process.env.INCOMPLETE_PATH || "/app/media/incomplete";

  app.log.info(
    `Initializing FileManager with SCENES_PATH=${scenesPath}, INCOMPLETE_PATH=${incompletePath}`
  );

  const fileManager = createFileManagerService(
    app.db,
    scenesPath,
    incompletePath
  );

  app.log.info("Decorating app with fileManager", {
    hasDecorateMethod: typeof app.decorate === "function",
    fileManagerExists: !!fileManager,
  });

  app.decorate("fileManager", fileManager);

  app.log.info("FileManager decorated successfully", {
    hasFileManager: !!app.fileManager,
  });
};

export default fp(fileManagerPlugin, {
  name: "file-manager",
});

// TypeScript declaration
declare module "fastify" {
  interface FastifyInstance {
    fileManager: ReturnType<typeof createFileManagerService>;
  }
}
