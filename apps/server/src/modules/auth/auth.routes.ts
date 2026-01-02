import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorResponseSchema } from "../../schemas/common.schema.js";
import {
  LoginSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  StatusResponseSchema,
} from "./auth.schema.js";

/**
 * Auth Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { authController } = app.container;
  // Login
  app.post(
    "/login",
    {
      schema: {
        tags: ["auth"],
        summary: "User login",
        description: "Authenticate a user with username and password",
        body: LoginSchema,
        response: {
          200: LoginResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await authController.login(request.body, request);
      } catch (error) {
        if (error instanceof Error && error.message === "Invalid username or password") {
          return reply.code(401).send({ error: "Invalid username or password" });
        }
        throw error;
      }
    }
  );

  // Logout
  app.post(
    "/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "User logout",
        description: "Destroy the current user session",
        response: {
          200: LogoutResponseSchema,
        },
      },
    },
    async (request) => {
      return await authController.logout(request);
    }
  );

  // Check auth status
  app.get(
    "/status",
    {
      schema: {
        tags: ["auth"],
        summary: "Check authentication status",
        description: "Get the current authentication status and user ID if authenticated",
        response: {
          200: StatusResponseSchema,
        },
      },
    },
    async (request) => {
      return await authController.getStatus(request);
    }
  );
};

export default authRoutes;
