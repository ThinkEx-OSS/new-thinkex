export const PDFIUM_WASM_PUBLIC_PATH = "/vendor/embedpdf/pdfium.wasm";

export function getPdfiumWasmAbsoluteUrl(origin: string) {
	return new URL(PDFIUM_WASM_PUBLIC_PATH, origin).href;
}
