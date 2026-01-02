import fp from "fastify-plugin";
import session from "@fastify/session";
import cookie from "@fastify/cookie";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface Session {
    userId: string;
    authenticated: boolean;
  }
}

export default fp(async (app) => {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  // Register cookie plugin first (required by session)
  await app.register(cookie);

  await app.register(session, {
    secret,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    },
    cookieName: process.env.SESSION_COOKIE_NAME || "eros-session",
    saveUninitialized: false,
  });

  // Authentication decorator
  app.decorate("authenticate", async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (!request.session.authenticated) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.log.info("Authentication plugin registered");
});
