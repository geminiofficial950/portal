import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// One in-memory MongoDB for the whole run; each test file gets its own database (setup.ts)
let server: MongoMemoryServer;

export async function setup(project: TestProject) {
  server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
}

export async function teardown() {
  await server?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
