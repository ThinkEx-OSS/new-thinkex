import { PdfEngineProvider, usePdfiumEngine } from "@embedpdf/engines/react";
import type { ReactNode } from "react";

import { getPdfiumWasmAbsoluteUrl } from "#/features/workspaces/files/pdfium-assets";
import { getClientOrigin } from "#/lib/client-url";

export function WorkspacePdfEngineProvider({ children }: { children: ReactNode }) {
	const engineState = usePdfiumEngine({
		fontFallback: null,
		wasmUrl: getPdfiumWasmAbsoluteUrl(getClientOrigin()),
	});

	return <PdfEngineProvider {...engineState}>{children}</PdfEngineProvider>;
}
