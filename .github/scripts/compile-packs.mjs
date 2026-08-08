/**
 * Compile LevelDB packs from packs/src/<name> using Foundry CLI.
 * No private testharness required — safe for DarkEric fork CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const moduleJson = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const packs = Array.isArray(moduleJson.packs) ? moduleJson.packs : [];

if (!packs.length) {
  console.log("compile-packs: no packs in module.json — skip");
  process.exit(0);
}

const { compilePack } = await import("@foundryvtt/foundryvtt-cli");

function replaceDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

let compiled = 0;
for (const pack of packs) {
  const name = pack.name;
  if (!name) continue;
  const src = path.join(root, "packs", "src", name);
  const out = path.join(root, "packs", name);
  const staging = path.join(root, "packs", ".ci-build", name);
  if (!fs.existsSync(src)) {
    console.warn(`compile-packs: missing source ${path.relative(root, src)} — skip`);
    continue;
  }
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(staging), { recursive: true });
  console.log(`compile-packs: ${name} (${pack.type ?? "unknown"})`);
  await compilePack(src, staging, { recursive: true, yaml: false, log: true });
  try {
    replaceDir(staging, out);
  } catch (err) {
    console.error(
      `compile-packs: cannot replace ${name} (is Foundry locking the pack?). In CI this should not happen.`,
      err.message
    );
    process.exit(1);
  }
  compiled += 1;
}

fs.rmSync(path.join(root, "packs", ".ci-build"), { recursive: true, force: true });

if (compiled === 0) {
  console.error("compile-packs: no packs compiled");
  process.exit(1);
}
console.log(`compile-packs: done (${compiled})`);
