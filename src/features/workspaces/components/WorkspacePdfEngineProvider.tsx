import { PdfEngineProvider, usePdfiumEngine } from "@embedpdf/engines/react";
import type { ReactNode } from "react";

import { getPdfiumWasmAbsoluteUrl } from "#/features/workspaces/files/pdfium-assets";

export function WorkspacePdfEngineProvider({
	children,
}: {
	children: ReactNode;
}) {
	const engineState = usePdfiumEngine({
		fontFallback: null,
		wasmUrl: getPdfiumWasmAbsoluteUrl(window.location.origin),
	});

	return <PdfEngineProvider {...engineState}>{children}</PdfEngineProvider>;
}
