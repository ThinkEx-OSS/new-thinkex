import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(rootDir, "node_modules/@embedpdf/pdfium/dist/pdfium.wasm");
const targetPath = join(rootDir, "public/vendor/embedpdf/pdfium.wasm");

await mkdir(dirname(targetPath), { recursive: true });
await copyFile(sourcePath, targetPath);

console.log(`Copied PDFium WASM to ${targetPath}`);
