import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const root = join(fileURLToPath(import.meta.url), "../..");
const minified = await readFile(join(root, "kaon.min.js"));

await writeFile(join(root, "kaon.js.br"), brotliCompressSync(minified));
await writeFile(join(root, "kaon.js.gz"), gzipSync(minified));
