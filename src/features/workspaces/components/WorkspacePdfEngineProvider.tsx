import { PdfEngineProvider, usePdfiumEngine } from "@embedpdf/engines/react";
import type { ReactNode } from "react";

const pdfiumWasmPath = "/vendor/embedpdf/pdfium.wasm";

export function WorkspacePdfEngineProvider({
	children,
}: {
	children: ReactNode;
}) {
	const engineState = usePdfiumEngine({
		fontFallback: null,
		wasmUrl: getPdfiumWasmUrl(),
	});

	return <PdfEngineProvider {...engineState}>{children}</PdfEngineProvider>;
}

function getPdfiumWasmUrl() {
	if (typeof window === "undefined") {
		return pdfiumWasmPath;
	}

	return new URL(pdfiumWasmPath, window.location.origin).href;
}
