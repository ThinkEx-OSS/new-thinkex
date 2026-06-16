import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

import { WorkspaceAskSelectionButton } from "#/features/workspaces/components/WorkspaceAskSelectionButton";
import { createDocumentSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

const DOCUMENT_ASK_BUBBLE_MENU_PLUGIN_KEY = "documentAskSelectionBubbleMenu";

export function DocumentAskSelectionMenu({
	editor,
	itemId,
	scrollTarget,
	workspaceId,
}: {
	editor: Editor | null;
	itemId: string;
	scrollTarget: HTMLElement | null;
	workspaceId: string;
}) {
	const addSelectedMention = useWorkspaceUiStore(
		(state) => state.addSelectedMention,
	);

	if (!editor) {
		return null;
	}

	return (
		<BubbleMenu
			className="z-[49]"
			editor={editor}
			pluginKey={DOCUMENT_ASK_BUBBLE_MENU_PLUGIN_KEY}
			resizeDelay={0}
			updateDelay={0}
			options={{
				flip: true,
				inline: true,
				offset: 10,
				placement: "top",
				scrollTarget: scrollTarget ?? undefined,
				shift: true,
				strategy: "fixed",
			}}
			shouldShow={({ state, from, to }) =>
				from !== to && Boolean(state.doc.textBetween(from, to, " ").trim())
			}
		>
			<WorkspaceAskSelectionButton
				onClick={() => {
					const { from, to } = editor.state.selection;
					const text = editor.state.doc.textBetween(from, to, " ").trim();

					if (!text || from === to) {
						return;
					}

					addSelectedMention(
						workspaceId,
						createDocumentSelectedMention({
							itemId,
							text,
						}),
					);
					editor.commands.blur();
				}}
			/>
		</BubbleMenu>
	);
}
