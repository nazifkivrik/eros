/**
 * Shared logger utility for services that don't have direct access to Fastify instance
 * Uses Pino for structured logging consistent with Fastify's logger
 */
import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
});
