import { z } from "zod";

/**
 * Common response schemas used across the API
 */

/**
 * Standard error response
 */
export const ErrorResponseSchema = z
  .object({
    error: z.string().describe("Error message describing what went wrong"),
  })
  .describe("Error response");

/**
 * Standard success response
 */
export const SuccessResponseSchema = z
  .object({
    success: z.boolean().describe("Indicates whether the operation succeeded"),
  })
  .describe("Success response");

/**
 * Success response with message
 */
export const SuccessMessageResponseSchema = z
  .object({
    success: z.boolean().describe("Indicates whether the operation succeeded"),
    message: z.string().optional().describe("Optional success message"),
  })
  .describe("Success response with optional message");

/**
 * Pagination metadata
 */
export const PaginationMetaSchema = z
  .object({
    total: z.number().int().describe("Total number of items"),
    page: z.number().int().positive().describe("Current page number"),
    pageSize: z.number().int().positive().describe("Number of items per page"),
    hasNext: z.boolean().describe("Whether there are more pages"),
    hasPrevious: z.boolean().describe("Whether there are previous pages"),
  })
  .describe("Pagination metadata");

/**
 * Creates a paginated response schema for any item type
 * @param itemSchema The schema for individual items
 */
export function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      data: z.array(itemSchema).describe("Array of items"),
      meta: PaginationMetaSchema.describe("Pagination metadata"),
    })
    .describe("Paginated response");
}

/**
 * Creates a simple list response schema (without pagination)
 * @param itemSchema The schema for individual items
 */
export function createListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      data: z.array(itemSchema).describe("Array of items"),
    })
    .describe("List response");
}

/**
 * Common query parameters for pagination
 */
export const PaginationQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .positive()
      .default(1)
      .describe("Page number (1-indexed)"),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(20)
      .describe("Number of items per page (max 100)"),
  })
  .describe("Pagination query parameters");

/**
 * ID parameter schema
 */
export const IdParamsSchema = z
  .object({
    id: z.string().describe("Entity ID"),
  })
  .describe("ID parameter");
