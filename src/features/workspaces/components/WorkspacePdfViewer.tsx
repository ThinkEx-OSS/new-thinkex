import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF, type PluginBatchRegistrations } from "@embedpdf/core/react";
import { useEngineContext } from "@embedpdf/engines/react";
import {
	AnnotationLayer,
	AnnotationPluginPackage,
	LockModeType,
} from "@embedpdf/plugin-annotation/react";
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
	useScroll,
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
import { type ReactNode, useEffect, useState } from "react";
import { Spinner } from "#/components/ui/spinner";
import { usePdfItemToolbar } from "#/features/workspaces/components/WorkspaceItemToolbarSlot";
import { useWorkspacePaneHotkey } from "#/features/workspaces/components/WorkspacePaneRuntime";
import { WorkspacePdfAskSelectionMenu } from "#/features/workspaces/components/WorkspacePdfAskSelectionMenu";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	type ClientPoint,
	getPointerClientPoint,
} from "#/features/workspaces/model/workspace-selection-geometry";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

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
	createPluginRegistration(AnnotationPluginPackage, {
		locked: { type: LockModeType.All },
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
								itemId={item.id}
								workspaceId={workspaceId}
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
	itemId,
	workspaceId,
}: {
	activeDocumentId: string | null;
	documentId: string;
	fileName: string;
	fileUrl: string;
	itemId: string;
	workspaceId: string;
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
					itemId={itemId}
					workspaceId={workspaceId}
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
	itemId,
	workspaceId,
}: {
	documentId: string;
	fileName: string;
	fileUrl: string;
	isError: boolean;
	isLoaded: boolean;
	isLoading: boolean;
	itemId: string;
	workspaceId: string;
}) {
	const [selectionPoint, setSelectionPoint] = useState<ClientPoint | null>(
		null,
	);

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
		return (
			<WorkspacePdfViewerStatus>Preparing document...</WorkspacePdfViewerStatus>
		);
	}

	return (
		<Viewport className="h-full w-full" documentId={documentId}>
			<WorkspacePdfItemViewStateReporter
				documentId={documentId}
				itemId={itemId}
				workspaceId={workspaceId}
			/>
			<WorkspacePdfSelectionShortcuts documentId={documentId} />
			<ZoomGestureWrapper
				className="min-h-full"
				documentId={documentId}
				enablePinch
				enableWheel
				onPointerUpCapture={(event) => {
					setSelectionPoint(getPointerClientPoint(event));
				}}
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
									selectionMenu={(props) => (
										<WorkspacePdfAskSelectionMenu
											{...props}
											documentId={documentId}
											itemId={itemId}
											selectionPoint={selectionPoint}
											workspaceId={workspaceId}
										/>
									)}
									textStyle={{
										background: "var(--workspace-ask-selection-background)",
									}}
								/>
								<AnnotationLayer
									className="absolute inset-0"
									documentId={documentId}
									pageIndex={pageIndex}
								/>
							</PagePointerProvider>
						</div>
					)}
				/>
			</ZoomGestureWrapper>
		</Viewport>
	);
}

function WorkspacePdfItemViewStateReporter({
	documentId,
	itemId,
	workspaceId,
}: {
	documentId: string;
	itemId: string;
	workspaceId: string;
}) {
	const {
		state: { currentPage },
	} = useScroll(documentId);
	const clearItemViewState = useWorkspaceUiStore(
		(state) => state.clearItemViewState,
	);
	const setItemViewState = useWorkspaceUiStore(
		(state) => state.setItemViewState,
	);

	useEffect(() => {
		setItemViewState(workspaceId, {
			kind: "pdf-page",
			itemId,
			pageNumber: currentPage,
		});
	}, [currentPage, itemId, setItemViewState, workspaceId]);

	useEffect(() => {
		return () => {
			clearItemViewState(workspaceId, itemId);
		};
	}, [clearItemViewState, itemId, workspaceId]);

	return null;
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

function WorkspacePdfViewerStatus({
	action,
	children,
	loading = true,
}: {
	action?: ReactNode;
	children: string;
	loading?: boolean;
}) {
	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground text-sm"
			aria-live="polite"
		>
			{loading ? <Spinner className="size-4" /> : null}
			<p>{children}</p>
			{action}
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
		<WorkspacePdfViewerStatus
			loading={false}
			action={
				<a
					className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted"
					download={fileName}
					href={fileUrl}
				>
					Download original file
				</a>
			}
		>
			{children}
		</WorkspacePdfViewerStatus>
	);
}

function getWorkspaceFileContentUrl(workspaceId: string, itemId: string) {
	return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(itemId)}/content`;
}
