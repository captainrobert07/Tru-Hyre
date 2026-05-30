import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error("POSTGRES_URL or DATABASE_URL must be set");
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
