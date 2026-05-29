import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NORMALIZED_DATA_PATH } from "../src/lib/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");
const srcDir = path.join(repoRoot, "src");
const dataDir = path.join(publicDir, "data");

async function removeDirectory(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

await removeDirectory(publicDir);
await copyDirectory(srcDir, publicDir);
await fs.mkdir(dataDir, { recursive: true });

const normalizedPayload = JSON.parse(await fs.readFile(path.join(repoRoot, NORMALIZED_DATA_PATH), "utf8"));
const publicPayload = {
  meta: normalizedPayload.meta,
  dashboard: normalizedPayload.dashboard,
};

await fs.writeFile(path.join(dataDir, "latest.json"), `${JSON.stringify(publicPayload)}\n`, "utf8");

console.log(`Built static site into ${publicDir}`);
