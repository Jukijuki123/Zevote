import { PrismaClient } from "@/generated/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (!globalForPrisma.prisma) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // batasi pool size untuk Supabase free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({
    adapter,
    log: ["query"],
  });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
} else {
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;
