import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const root = join(fileURLToPath(import.meta.url), "../..");
const minified = await readFile(join(root, "kaon.min.js"));

const brotli = brotliCompressSync(minified);
await writeFile(join(root, "kaon.min.js.br"), brotli);
console.log(`brotli: ${brotli.length}b`);

const gzip = gzipSync(minified);
await writeFile(join(root, "kaon.min.js.gz"), gzip);
console.log(`gzip: ${gzip.length}b`);
