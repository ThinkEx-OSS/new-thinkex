import { useState } from "react";

import {
	workspaceItemDocumentPreviewPanelClass,
	workspaceItemDocumentPreviewTextClass,
	workspaceItemPreviewContentLayerClass,
	workspaceItemPreviewIconClass,
} from "#/features/workspaces/components/workspace-item-card-chrome";
import { getWorkspaceDocumentPreviewText } from "#/features/workspaces/documents/document-preview-text";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceFilePreviewUrl,
	resolveWorkspaceFileTypeFromItem,
} from "#/features/workspaces/model/workspace-file";
import { cn } from "#/lib/utils";

const DOCUMENT_PREVIEW_PLACEHOLDER =
	"Outline the main idea first, then expand with supporting details. Notes, drafts, and references can live here as the document grows over time.";

interface WorkspaceItemPreviewSurfaceProps {
	item: WorkspaceItem;
}

export default function WorkspaceItemPreviewSurface({
	item,
}: WorkspaceItemPreviewSurfaceProps) {
	switch (item.type) {
		case "document":
			return <WorkspaceItemDocumentPreview item={item} />;
		case "file":
			return <WorkspaceItemFilePreview item={item} />;
		default:
			return <WorkspaceItemIconPreview item={item} />;
	}
}

function WorkspaceItemDocumentPreview({ item }: { item: WorkspaceItem }) {
	const previewText = getWorkspaceDocumentPreviewText(item);

	return (
		<div className={workspaceItemPreviewContentLayerClass}>
			<div className={workspaceItemDocumentPreviewPanelClass}>
				<p className={workspaceItemDocumentPreviewTextClass}>
					{previewText || DOCUMENT_PREVIEW_PLACEHOLDER}
				</p>
			</div>
		</div>
	);
}

function WorkspaceItemFilePreview({ item }: { item: WorkspaceItem }) {
	const fileDescriptor = resolveWorkspaceFileTypeFromItem(item);
	const previewUrl =
		fileDescriptor?.previewGenerator != null
			? getWorkspaceFilePreviewUrl(item.workspaceId, item.id)
			: null;
	const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
	const showImage = Boolean(previewUrl) && failedPreviewUrl !== previewUrl;

	if (showImage) {
		return (
			<div className={workspaceItemPreviewContentLayerClass}>
				<img
					src={previewUrl ?? undefined}
					alt=""
					loading="lazy"
					decoding="async"
					className="size-full object-cover object-top"
					onError={() => setFailedPreviewUrl(previewUrl)}
				/>
			</div>
		);
	}

	return <WorkspaceItemIconPreview item={item} />;
}

/** Icon-only preview for folders and types without a custom thumbnail yet. */
function WorkspaceItemIconPreview({ item }: { item: WorkspaceItem }) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

	return (
		<div className={workspaceItemPreviewContentLayerClass}>
			<div className="flex size-full items-center justify-center bg-transparent">
				<Icon
					className={cn(workspaceItemPreviewIconClass, iconClassName)}
					strokeWidth={1.75}
					aria-hidden="true"
				/>
			</div>
		</div>
	);
}
