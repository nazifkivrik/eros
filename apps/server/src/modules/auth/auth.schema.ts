import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
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
  authenticated: z.boolean(),
  userId: z.string().nullable(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
