import { randomUUID } from "node:crypto";
import { afterAll, inject } from "vitest";

// Point lib/db.ts at the in-memory server, with a fresh database for this test file
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB = `t_${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  const g = globalThis as unknown as { mongoClient?: Promise<{ db: (n: string) => { dropDatabase: () => Promise<unknown> }; close: () => Promise<void> }> };
  const client = await g.mongoClient;
  if (client) {
    await client.db(process.env.MONGODB_DB!).dropDatabase();
    await client.close();
  }
});
