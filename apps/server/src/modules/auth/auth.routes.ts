import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
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
      const { password } = request.body;

      // Single user authentication - check against env variable
      const adminPassword = process.env.ADMIN_PASSWORD || "admin";

      if (password !== adminPassword) {
        return reply.code(401).send({ error: "Invalid password" });
      }

      request.session.authenticated = true;
      request.session.userId = "admin";

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
