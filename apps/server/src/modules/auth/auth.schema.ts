import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(1).describe("Username for authentication"),
  password: z.string().min(1).describe("Password for authentication"),
});

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const LogoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const StatusResponseSchema = z.object({
  authenticated: z.boolean().describe("Whether the user is authenticated"),
  userId: z.string().nullable().describe("User ID if authenticated"),
});
