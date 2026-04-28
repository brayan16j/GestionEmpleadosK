import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env before importing buildApp. In CI .env is absent and vars come from
// the runner environment instead — swallow ENOENT so the script still works there.
try {
  process.loadEnvFile(resolve(__dirname, "..", "..", "..", ".env"));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

// Import after env is loaded
const { buildApp } = await import("../src/app.js");

const app = await buildApp({ logger: false });
await app.ready();

const doc = app.swagger();

const outputPath = resolve(__dirname, "..", "..", "..", "packages", "api-types", "openapi.json");
writeFileSync(outputPath, JSON.stringify(doc, null, 2) + "\n", "utf-8");

console.log(`OpenAPI snapshot written to ${outputPath}`);

await app.close();
process.exit(0);
