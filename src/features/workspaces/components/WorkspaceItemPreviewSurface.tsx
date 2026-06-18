import { useState } from "react";

import { workspaceItemDocumentPreviewTextClass } from "#/features/workspaces/components/workspace-item-card-chrome";
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
	className?: string;
}

export default function WorkspaceItemPreviewSurface({
	item,
	className,
}: WorkspaceItemPreviewSurfaceProps) {
	const fileDescriptor =
		item.type === "file" ? resolveWorkspaceFileTypeFromItem(item) : null;
	const previewUrl =
		fileDescriptor?.previewGenerator != null
			? getWorkspaceFilePreviewUrl(item.workspaceId, item.id)
			: null;
	const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);

	if (item.type === "document") {
		const previewText = getWorkspaceDocumentPreviewText(item);

		return (
			<div
				className={cn("size-full overflow-hidden bg-transparent", className)}
			>
				<p className={workspaceItemDocumentPreviewTextClass}>
					{previewText || DOCUMENT_PREVIEW_PLACEHOLDER}
				</p>
			</div>
		);
	}

	const { Icon, iconClassName, surfaceClassName } =
		getWorkspaceItemDisplay(item);
	const showImage = Boolean(previewUrl) && failedPreviewUrl !== previewUrl;

	return (
		<div className={cn("overflow-hidden", className)}>
			{showImage ? (
				<img
					src={previewUrl ?? undefined}
					alt=""
					loading="lazy"
					decoding="async"
					className="size-full object-cover object-top"
					onError={() => setFailedPreviewUrl(previewUrl)}
				/>
			) : (
				<div
					className={cn(
						"flex size-full items-center justify-center",
						surfaceClassName,
					)}
				>
					<Icon
						className={cn("size-10", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</div>
			)}
		</div>
	);
}
