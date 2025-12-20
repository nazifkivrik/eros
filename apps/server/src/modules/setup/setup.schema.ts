import { z } from "zod";

export const SetupDataSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(8, "Password must be at least 8 characters"),
  settings: z
    .object({
      qbittorrent: z
        .object({
          url: z.string().url(),
          username: z.string().min(1),
          password: z.string().min(1),
          enabled: z.boolean(),
        })
        .optional(),
      prowlarr: z
        .object({
          apiUrl: z.string().url(),
          apiKey: z.string().min(1),
          enabled: z.boolean(),
        })
        .optional(),
      stashdb: z
        .object({
          apiUrl: z.string().url(),
          apiKey: z.string(),
          enabled: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});

export const SetupStatusResponseSchema = z.object({
  setupCompleted: z.boolean(),
  hasAdmin: z.boolean(),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
