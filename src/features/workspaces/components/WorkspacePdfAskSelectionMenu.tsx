import {
	type SelectionSelectionMenuProps,
	useSelectionCapability,
} from "@embedpdf/plugin-selection/react";

import { WorkspaceAskSelectionButton } from "#/features/workspaces/components/WorkspaceAskSelectionButton";
import { createPdfSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

export function WorkspacePdfAskSelectionMenu({
	documentId,
	itemId,
	menuWrapperProps,
	placement,
	rect,
	workspaceId,
}: SelectionSelectionMenuProps & {
	documentId: string;
	itemId: string;
	workspaceId: string;
}) {
	const { provides: selectionCapability } = useSelectionCapability();
	const addSelectedMention = useWorkspaceUiStore(
		(state) => state.addSelectedMention,
	);
	const top = placement.suggestTop ? -42 : rect.size.height + 10;

	return (
		<div {...menuWrapperProps}>
			<div
				className="absolute left-1/2 z-[49] -translate-x-1/2"
				style={{
					cursor: "default",
					pointerEvents: "auto",
					top,
				}}
			>
				<WorkspaceAskSelectionButton
					onClick={async () => {
						const selection = selectionCapability?.forDocument(documentId);

						if (!selection) {
							return;
						}

						let text = "";

						try {
							text = await readPdfSelectedText(selection.getSelectedText());
						} catch (error) {
							console.warn(
								"[WorkspacePdfAskSelectionMenu] Failed to read selected PDF text",
								error,
							);
							return;
						}

						if (!text) {
							return;
						}

						const pageNumbers = Array.from(
							new Set(
								selection
									.getFormattedSelection()
									.map((item) => item.pageIndex + 1),
							),
						).sort((left, right) => left - right);

						addSelectedMention(
							workspaceId,
							createPdfSelectedMention({
								itemId,
								pageNumbers,
								text,
							}),
						);
						selection.clear();
					}}
				/>
			</div>
		</div>
	);
}

type PdfSelectedTextTask = {
	wait: (
		onSuccess: (lines: string[]) => void,
		onError: (error: unknown) => void,
	) => void;
};

function readPdfSelectedText(task: PdfSelectedTextTask) {
	return new Promise<string>((resolve, reject) => {
		task.wait(
			(lines) => resolve(lines.join("\n").trim()),
			(error) => reject(error),
		);
	});
}
