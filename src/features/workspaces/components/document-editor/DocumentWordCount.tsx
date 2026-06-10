import type { Editor } from "@tiptap/react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { useDocumentEditorUiState } from "#/features/workspaces/components/document-editor/document-editor-state";

export function DocumentWordCount({ editor }: { editor: Editor | null }) {
	const { counts } = useDocumentEditorUiState(editor);

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<span className="absolute right-4 bottom-3 inline-flex h-6 min-w-16 items-center justify-center rounded-sm bg-background/85 px-2 text-xs text-muted-foreground" />
				}
			>
				{counts.selectedWords > 0
					? `${counts.selectedWords} / ${counts.totalWords} words`
					: `${counts.totalWords} words`}
			</TooltipTrigger>
			<TooltipContent>
				{counts.selectedCharacters > 0
					? `${counts.selectedCharacters} / ${counts.totalCharacters} characters`
					: `${counts.totalCharacters} characters`}
			</TooltipContent>
		</Tooltip>
	);
}
