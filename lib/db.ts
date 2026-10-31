import "server-only";
import { MongoClient } from "mongodb";

// Reuse one connection across hot reloads and requests
const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env");

  globalForMongo.mongoClient ??= new MongoClient(uri).connect();
  const client = await globalForMongo.mongoClient;
  return client.db(process.env.MONGODB_DB || undefined);
}
