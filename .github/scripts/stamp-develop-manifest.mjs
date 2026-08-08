/**
 * Stamp module.json for the rolling GitHub prerelease tag "develop".
 * Writes .build/module.json for packaging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repo = process.env.GITHUB_REPOSITORY || "DarkEric/unknown";
const sha = (process.env.GITHUB_SHA || "local").slice(0, 7);
const owner = repo.split("/")[0] || "DarkEric";

const src = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const baseVersion = String(src.version || "0.0.0").split("-")[0];
const downloadRoot = `https://github.com/${repo}/releases/download/develop`;

src.version = `${baseVersion}-dev.${sha}`;
src.url = `https://github.com/${repo}`;
src.manifest = `${downloadRoot}/module.json`;
src.download = `${downloadRoot}/module.zip`;
if (src.readme?.includes("githubusercontent.com/")) {
  src.readme = `https://raw.githubusercontent.com/${repo}/develop/README.md`;
}

const rewriteIonriftManifest = (entry) => {
  if (!entry || typeof entry !== "object") return entry;
  if (typeof entry.id === "string" && entry.id.startsWith("ionrift-") && entry.type === "module") {
    entry.manifest = `https://github.com/${owner}/${entry.id}/releases/download/develop/module.json`;
  }
  return entry;
};

if (src.relationships?.requires) {
  src.relationships.requires = src.relationships.requires.map(rewriteIonriftManifest);
}

const outDir = path.join(root, ".build");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "module.json");
fs.writeFileSync(outPath, `${JSON.stringify(src, null, 2)}\n`, "utf8");
console.log(`stamp-develop-manifest: ${src.id} ${src.version} -> ${outPath}`);
console.log(`manifest: ${src.manifest}`);
