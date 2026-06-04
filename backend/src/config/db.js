import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrls } from "./databaseUrl.js";

const { pooled } = resolveDatabaseUrls();

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: pooled,
    },
  },
});
