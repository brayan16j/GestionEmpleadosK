import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotPath = resolve(__dirname, "..", "..", "..", "packages", "api-types", "openapi.json");

describe("OpenAPI snapshot", () => {
  const appPromise = buildApp({ logger: false });

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it("matches packages/api-types/openapi.json", async () => {
    const app = await appPromise;
    await app.ready();

    const live = JSON.stringify(app.swagger(), null, 2) + "\n";
    const committed = readFileSync(snapshotPath, "utf-8");

    expect(live, "OpenAPI snapshot is out of date. Run 'pnpm api:types' to regenerate.").toBe(
      committed,
    );
  });
});
