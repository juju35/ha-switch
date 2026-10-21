// Builds src/ha-switch-card.js into the single HACS file dist/ha-switch-card.js, stamping the package version.
// Usage: node scripts/build.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = "ha-switch-card.js";
const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

const out = readFileSync(`${root}src/${FILE}`, "utf8").replace("__VERSION__", pkg.version);

const target = `${root}dist/${FILE}`;
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== out) {
    console.error(`dist/${FILE} is out of date: run \`npm run build\` and commit the result.`);
    process.exit(1);
  }
  console.log(`dist/${FILE} is up to date.`);
} else {
  writeFileSync(target, out);
  console.log(`Built dist/${FILE} (${(out.length / 1024).toFixed(1)} KB)`);
}
