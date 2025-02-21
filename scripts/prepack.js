import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");

const packageFile = join(root, "package.json");
const packageInfo = JSON.parse(await readFile(packageFile, "utf-8"));

delete packageInfo.scripts;
delete packageInfo.devDependencies;

await writeFile(packageFile, JSON.stringify(packageInfo, null, "\t") + "\n");
