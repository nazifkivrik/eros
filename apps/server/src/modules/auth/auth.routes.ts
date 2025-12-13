import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Login
  app.post(
    "/login",
    {
      schema: {
        body: z.object({
          password: z.string().min(1),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          401: z.object({
            error: z.string(),
          }),
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
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
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
          200: z.object({
            authenticated: z.boolean(),
            userId: z.string().nullable(),
          }),
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
