import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "./env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { planewardDb?: Database };

function createDb(): Database {
  // postgres.js connects lazily, so importing this at build time is safe.
  return drizzle(postgres(env.DATABASE_URL, { max: 10 }), { schema });
}

/** Shared instance; reused across Next dev hot reloads. */
export const db: Database = globalForDb.planewardDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.planewardDb = db;
