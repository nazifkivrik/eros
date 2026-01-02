/**
 * Barrel export - single entry point for @repo/shared-types
 * All types can be imported from '@repo/shared-types'
 */

// Core types (fundamental building blocks)
export * from "./core/index.js";

// Domain entities (business domain)
export * from "./domain/index.js";

// Integration types (external services)
export * from "./integration/index.js";

// Configuration types (app settings)
export * from "./config/index.js";

// API contract types (request/response)
export * from "./api/index.js";
