import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import argon2 from "argon2";
import { users } from "@repo/database/schema";
import {
  LoginSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  StatusResponseSchema,
  ErrorResponseSchema,
} from "./auth.schema.js";

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Login
  app.post(
    "/login",
    {
      schema: {
        body: LoginSchema,
        response: {
          200: LoginResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;

      // Find user by username
      const user = await app.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (user.length === 0) {
        return reply.code(401).send({ error: "Invalid username or password" });
      }

      // Verify password using Argon2
      const isValidPassword = await argon2.verify(user[0].passwordHash, password);

      if (!isValidPassword) {
        return reply.code(401).send({ error: "Invalid username or password" });
      }

      request.session.authenticated = true;
      request.session.userId = user[0].id;

      return { success: true, message: "Logged in successfully" };
    }
  );

  // Logout
  app.post(
    "/logout",
    {
      schema: {
        response: {
          200: LogoutResponseSchema,
        },
      },
    },
    async (request) => {
      await request.session.destroy();
      return { success: true, message: "Logged out successfully" };
    }
  );

  // Check auth status
  app.get(
    "/status",
    {
      schema: {
        response: {
          200: StatusResponseSchema,
        },
      },
    },
    async (request) => {
      return {
        authenticated: request.session.authenticated ?? false,
        userId: request.session.userId ?? null,
      };
    }
  );
};

export default authRoutes;
