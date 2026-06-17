import type { DocumentState } from "@embedpdf/core";
import {
	type PdfPageObject,
	type Position,
	type Rect,
	type Rotation,
	restoreRect,
	transformSize,
} from "@embedpdf/models";
import { useInteractionManagerCapability } from "@embedpdf/plugin-interaction-manager/react";
import type { RenderCapability } from "@embedpdf/plugin-render";
import type { PageLayout } from "@embedpdf/plugin-scroll";
import { useSelectionCapability } from "@embedpdf/plugin-selection/react";
import type { PointerEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspacePaneHotkey } from "#/features/workspaces/components/WorkspacePaneRuntime";

const PDF_CAPTURE_MODE_ID = "pdfCapture";
const MIN_CAPTURE_SIZE = 8;
const MAX_RENDER_SCALE = 2;

export interface WorkspacePdfCaptureResult {
	blob: Blob;
	pageIndex: number;
}

interface WorkspacePdfCapturePageOverlayProps {
	active: boolean;
	documentState: DocumentState;
	onCapture: (capture: WorkspacePdfCaptureResult) => void;
	page: PdfPageObject;
	pageLayout: PageLayout;
	renderCapability: Readonly<RenderCapability> | null;
}

interface CaptureDraft {
	current: Position;
	start: Position;
}

export function WorkspacePdfCapturePageOverlay({
	active,
	documentState,
	onCapture,
	page,
	pageLayout,
	renderCapability,
}: WorkspacePdfCapturePageOverlayProps) {
	const [draft, setDraft] = useState<CaptureDraft | null>(null);
	const [isRendering, setIsRendering] = useState(false);
	const visible = active || draft || isRendering;

	if (!visible) {
		return null;
	}

	const selectionRect = draft
		? rectFromTwoPoints(draft.start, draft.current)
		: null;

	return (
		<div
			className="absolute inset-0 z-[60] cursor-crosshair touch-none"
			onPointerDown={(event) => {
				if (!active || isRendering || event.button !== 0) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				event.currentTarget.setPointerCapture(event.pointerId);

				const start = getLocalPointerPosition(event, event.currentTarget);
				setDraft({ current: start, start });
			}}
			onPointerMove={(event) => {
				if (!draft) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				const pointerPosition = getLocalPointerPosition(
					event,
					event.currentTarget,
				);

				setDraft((draft) =>
					draft
						? {
								...draft,
								current: pointerPosition,
							}
						: draft,
				);
			}}
			onPointerCancel={() => {
				setDraft(null);
			}}
			onPointerUp={async (event) => {
				if (!draft) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();

				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}

				const rect = rectFromTwoPoints(
					draft.start,
					getLocalPointerPosition(event, event.currentTarget),
				);
				setDraft(null);

				if (
					!renderCapability ||
					rect.size.width < MIN_CAPTURE_SIZE ||
					rect.size.height < MIN_CAPTURE_SIZE
				) {
					return;
				}

				setIsRendering(true);

				try {
					const blob = await renderPdfCapture({
						documentState,
						page,
						pageLayout,
						rect,
						renderCapability,
					});
					onCapture({ blob, pageIndex: page.index });
				} catch (error) {
					console.warn(
						"[WorkspacePdfCapture] Failed to capture PDF region",
						error,
					);
					toast.error("Could not capture that region. Try again.");
				}

				setIsRendering(false);
			}}
		>
			{active ? (
				<div className="pointer-events-none absolute inset-0 bg-blue-500/5" />
			) : null}
			{selectionRect ? (
				<div
					className="pointer-events-none absolute rounded-sm border border-blue-500 bg-blue-500/15 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
					style={{
						height: selectionRect.size.height,
						left: selectionRect.origin.x,
						top: selectionRect.origin.y,
						width: selectionRect.size.width,
					}}
				/>
			) : null}
			{isRendering ? (
				<div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-blue-500/25 bg-background/90 px-3 py-1 font-medium text-blue-600 text-xs shadow-sm backdrop-blur-sm dark:text-blue-300">
					Capturing...
				</div>
			) : null}
		</div>
	);
}

export function WorkspacePdfCaptureInteractionMode({
	documentId,
	isActive,
}: {
	documentId: string;
	isActive: boolean;
}) {
	const { provides: interactionManager } = useInteractionManagerCapability();
	const { provides: selection } = useSelectionCapability();

	useEffect(() => {
		if (!interactionManager) {
			return;
		}

		interactionManager.registerMode({
			cursor: "crosshair",
			exclusive: true,
			id: PDF_CAPTURE_MODE_ID,
			scope: "page",
		});
	}, [interactionManager]);

	useEffect(() => {
		if (!interactionManager) {
			return;
		}

		const interaction = interactionManager.forDocument(documentId);

		if (!isActive) {
			if (interaction.getActiveMode() === PDF_CAPTURE_MODE_ID) {
				interaction.activateDefaultMode();
			}
			return;
		}

		selection?.clear(documentId);
		interaction.activate(PDF_CAPTURE_MODE_ID);

		return () => {
			try {
				if (interaction.getActiveMode() === PDF_CAPTURE_MODE_ID) {
					interaction.activateDefaultMode();
				}
			} catch {
				// The document can be torn down before React effect cleanup runs.
			}
		};
	}, [documentId, interactionManager, isActive, selection]);

	return null;
}

export function WorkspacePdfCaptureShortcuts({
	isActive,
	onExit,
	onToggle,
}: {
	isActive: boolean;
	onExit: () => void;
	onToggle: () => void;
}) {
	useWorkspacePaneHotkey(
		"Mod+Shift+C",
		(event) => {
			event.preventDefault();
			onToggle();
		},
		{
			preventDefault: false,
			stopPropagation: true,
		},
	);

	useWorkspacePaneHotkey(
		"Escape",
		(event) => {
			event.preventDefault();
			onExit();
		},
		{
			enabled: isActive,
			preventDefault: false,
			stopPropagation: true,
		},
	);

	return null;
}

export function createPdfCaptureAttachmentFile({
	blob,
	fileName,
	pageIndex,
}: {
	blob: Blob;
	fileName: string;
	pageIndex: number;
}) {
	const stem = fileName.replace(/\.[^/.]+$/, "") || "pdf";
	const captureFileName = `${stem}-page-${pageIndex + 1}-capture.png`;

	return new File([blob], captureFileName, {
		lastModified: Date.now(),
		type: blob.type || "image/png",
	});
}

async function renderPdfCapture({
	documentState,
	page,
	pageLayout,
	rect,
	renderCapability,
}: {
	documentState: DocumentState;
	page: PdfPageObject;
	pageLayout: PageLayout;
	rect: Rect;
	renderCapability: Readonly<RenderCapability>;
}) {
	const rotation = combineRotations(page.rotation, documentState.rotation);
	const rotatedSize = transformSize(page.size, rotation, 1);
	const scale =
		rotatedSize.width > 0
			? pageLayout.rotatedWidth / rotatedSize.width
			: pageLayout.width / page.size.width;
	const pdfRect = clampRectToPage(
		restoreRect(page.size, rect, rotation, scale || 1),
		page,
	);
	const renderScale = clampNumber(scale || 1, 1, MAX_RENDER_SCALE);

	return renderCapability
		.renderPageRect({
			options: {
				dpr: 1,
				imageType: "image/png",
				scaleFactor: renderScale,
				withAnnotations: true,
				withForms: true,
			},
			pageIndex: page.index,
			rect: pdfRect,
		})
		.toPromise();
}

function getLocalPointerPosition(
	event: PointerEvent<HTMLElement>,
	element: HTMLElement,
): Position {
	const rect = element.getBoundingClientRect();

	return {
		x: clampNumber(event.clientX - rect.left, 0, rect.width),
		y: clampNumber(event.clientY - rect.top, 0, rect.height),
	};
}

function rectFromTwoPoints(first: Position, second: Position): Rect {
	const left = Math.min(first.x, second.x);
	const top = Math.min(first.y, second.y);
	const right = Math.max(first.x, second.x);
	const bottom = Math.max(first.y, second.y);

	return {
		origin: { x: left, y: top },
		size: {
			height: bottom - top,
			width: right - left,
		},
	};
}

function clampRectToPage(rect: Rect, page: PdfPageObject): Rect {
	const left = clampNumber(rect.origin.x, 0, page.size.width);
	const top = clampNumber(rect.origin.y, 0, page.size.height);
	const right = clampNumber(
		rect.origin.x + rect.size.width,
		left,
		page.size.width,
	);
	const bottom = clampNumber(
		rect.origin.y + rect.size.height,
		top,
		page.size.height,
	);

	return {
		origin: { x: left, y: top },
		size: {
			height: bottom - top,
			width: right - left,
		},
	};
}

function combineRotations(left: Rotation, right: Rotation): Rotation {
	return ((left + right) % 4) as Rotation;
}

function clampNumber(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}
