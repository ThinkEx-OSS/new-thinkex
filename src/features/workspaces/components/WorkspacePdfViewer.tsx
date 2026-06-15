import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF, type PluginBatchRegistrations } from "@embedpdf/core/react";
import { useEngineContext } from "@embedpdf/engines/react";
import {
	DocumentContent,
	DocumentManagerPluginPackage,
	useDocumentManagerCapability,
} from "@embedpdf/plugin-document-manager/react";
import {
	InteractionManagerPluginPackage,
	PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import {
	RenderLayer,
	RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import {
	Scroller,
	ScrollPluginPackage,
	ScrollStrategy,
} from "@embedpdf/plugin-scroll/react";
import {
	SelectionLayer,
	SelectionPluginPackage,
	useSelectionCapability,
} from "@embedpdf/plugin-selection/react";
import {
	TilingLayer,
	TilingPluginPackage,
} from "@embedpdf/plugin-tiling/react";
import {
	Viewport,
	ViewportPluginPackage,
} from "@embedpdf/plugin-viewport/react";
import {
	ZoomGestureWrapper,
	ZoomMode,
	ZoomPluginPackage,
} from "@embedpdf/plugin-zoom/react";
import { useEffect, useState } from "react";
import { usePdfItemToolbar } from "#/features/workspaces/components/WorkspaceItemToolbarSlot";
import { useWorkspacePaneHotkey } from "#/features/workspaces/components/WorkspacePaneRuntime";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

const pdfPlugins: PluginBatchRegistrations = [
	createPluginRegistration(DocumentManagerPluginPackage, {
		maxDocuments: 1,
	}),
	createPluginRegistration(ViewportPluginPackage, {
		viewportGap: 0,
	}),
	createPluginRegistration(ScrollPluginPackage, {
		defaultStrategy: ScrollStrategy.Vertical,
	}),
	createPluginRegistration(InteractionManagerPluginPackage),
	createPluginRegistration(SelectionPluginPackage, {
		marquee: {
			enabled: false,
		},
	}),
	createPluginRegistration(ZoomPluginPackage, {
		defaultZoomLevel: ZoomMode.FitWidth,
	}),
	createPluginRegistration(RenderPluginPackage),
	createPluginRegistration(TilingPluginPackage, {
		extraRings: 0,
		overlapPx: 2.5,
		tileSize: 768,
	}),
];

export default function WorkspacePdfViewer({
	item,
	toolbarSlotId,
	workspaceId,
}: {
	item: WorkspaceItem;
	toolbarSlotId?: string;
	workspaceId: string;
}) {
	const fileUrl = getWorkspaceFileContentUrl(workspaceId, item.id);
	const { engine, error, isLoading } = useEngineContext();

	usePdfItemToolbar({
		fileName: item.name,
		fileUrl,
		slotId: toolbarSlotId ?? item.id,
	});

	return (
		<div className="pdf-scrollbar h-full min-h-0 overflow-hidden bg-background">
			{error ? (
				<WorkspacePdfLoadFailure fileName={item.name} fileUrl={fileUrl}>
					Could not load the PDF engine.
				</WorkspacePdfLoadFailure>
			) : isLoading || !engine ? (
				<WorkspacePdfViewerStatus>
					Loading PDF viewer...
				</WorkspacePdfViewerStatus>
			) : (
				<EmbedPDF key={fileUrl} engine={engine} plugins={pdfPlugins}>
					{({ activeDocumentId, pluginsReady }) =>
						pluginsReady ? (
							<WorkspacePdfDocumentLoader
								activeDocumentId={activeDocumentId}
								documentId={item.id}
								fileName={item.name}
								fileUrl={fileUrl}
							/>
						) : (
							<WorkspacePdfViewerStatus>
								Preparing document...
							</WorkspacePdfViewerStatus>
						)
					}
				</EmbedPDF>
			)}
		</div>
	);
}

function WorkspacePdfDocumentLoader({
	activeDocumentId,
	documentId,
	fileName,
	fileUrl,
}: {
	activeDocumentId: string | null;
	documentId: string;
	fileName: string;
	fileUrl: string;
}) {
	const { provides: documentManager } = useDocumentManagerCapability();
	const [openError, setOpenError] = useState<{
		documentId: string;
		message: string;
	} | null>(null);
	const currentOpenError =
		openError?.documentId === documentId ? openError.message : null;

	useEffect(() => {
		if (!documentManager || documentManager.isDocumentOpen(documentId)) {
			return;
		}

		let cancelled = false;

		const task = documentManager.openDocumentUrl({
			autoActivate: true,
			documentId,
			name: fileName,
			requestOptions: {
				credentials: "same-origin",
			},
			url: fileUrl,
		});

		task.wait(
			() => {
				if (cancelled) {
					return;
				}
			},
			(error) => {
				if (cancelled) {
					return;
				}

				const message =
					error instanceof Error
						? error.message
						: typeof error === "object" && error && "message" in error
							? String(error.message)
							: String(error);

				setOpenError({ documentId, message });
			},
		);

		return () => {
			cancelled = true;
		};
	}, [documentId, documentManager, fileName, fileUrl]);
	if (currentOpenError) {
		return (
			<WorkspacePdfLoadFailure fileName={fileName} fileUrl={fileUrl}>
				Could not load this PDF.
			</WorkspacePdfLoadFailure>
		);
	}

	if (!activeDocumentId) {
		return (
			<WorkspacePdfViewerStatus>Preparing document...</WorkspacePdfViewerStatus>
		);
	}

	return (
		<DocumentContent documentId={activeDocumentId}>
			{(props) => (
				<WorkspacePdfDocumentContent
					documentId={activeDocumentId}
					fileName={fileName}
					fileUrl={fileUrl}
					{...props}
				/>
			)}
		</DocumentContent>
	);
}

function WorkspacePdfDocumentContent({
	documentId,
	fileName,
	fileUrl,
	isError,
	isLoaded,
	isLoading,
}: {
	documentId: string;
	fileName: string;
	fileUrl: string;
	isError: boolean;
	isLoaded: boolean;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<WorkspacePdfViewerStatus>Loading document...</WorkspacePdfViewerStatus>
		);
	}

	if (isError) {
		return (
			<WorkspacePdfLoadFailure fileName={fileName} fileUrl={fileUrl}>
				Could not load this PDF.
			</WorkspacePdfLoadFailure>
		);
	}

	if (!isLoaded) {
		return null;
	}

	return (
		<Viewport className="h-full w-full" documentId={documentId}>
			<WorkspacePdfSelectionShortcuts documentId={documentId} />
			<ZoomGestureWrapper
				className="min-h-full"
				documentId={documentId}
				enablePinch
				enableWheel
			>
				<Scroller
					documentId={documentId}
					renderPage={({ pageIndex }) => (
						<div className="absolute inset-0 overflow-hidden bg-white">
							<PagePointerProvider
								documentId={documentId}
								pageIndex={pageIndex}
							>
								<RenderLayer
									className="block select-none"
									documentId={documentId}
									pageIndex={pageIndex}
									style={{ pointerEvents: "none" }}
								/>
								<TilingLayer
									className="absolute inset-0"
									documentId={documentId}
									pageIndex={pageIndex}
									style={{ pointerEvents: "none" }}
								/>
								<SelectionLayer
									documentId={documentId}
									pageIndex={pageIndex}
									textStyle={{ background: "rgb(147 197 253 / 0.24)" }}
								/>
							</PagePointerProvider>
						</div>
					)}
				/>
			</ZoomGestureWrapper>
		</Viewport>
	);
}

function WorkspacePdfSelectionShortcuts({
	documentId,
}: {
	documentId: string;
}) {
	const { provides: selection } = useSelectionCapability();

	useWorkspacePaneHotkey(
		"Mod+C",
		(event) => {
			if (!selection?.getState(documentId).selection) {
				return;
			}

			event.preventDefault();
			selection.copyToClipboard(documentId);
		},
		{
			enabled: Boolean(selection),
			preventDefault: false,
			stopPropagation: false,
		},
	);

	return null;
}

function WorkspacePdfViewerStatus({ children }: { children: string }) {
	return (
		<div className="flex h-full items-center justify-center px-4 text-muted-foreground text-sm">
			{children}
		</div>
	);
}

function WorkspacePdfLoadFailure({
	children,
	fileName,
	fileUrl,
}: {
	children: string;
	fileName: string;
	fileUrl: string;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
			<p className="text-muted-foreground text-sm">{children}</p>
			<a
				className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted"
				download={fileName}
				href={fileUrl}
			>
				Download original file
			</a>
		</div>
	);
}

function getWorkspaceFileContentUrl(workspaceId: string, itemId: string) {
	return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(itemId)}/content`;
}
