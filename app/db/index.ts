import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://monden:monden@localhost:5432/monden";

export const db = drizzle(databaseUrl, { schema });
