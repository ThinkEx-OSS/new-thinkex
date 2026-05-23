import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "#/components/ai-elements/conversation";
import AiChatPanelToolbar from "#/features/workspaces/components/ai-chat/AiChatPanelToolbar";
import AiChatPromptInput from "#/features/workspaces/components/ai-chat/AiChatPromptInput";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

export default function AiChatPanel() {
	const presentation = useWorkspaceUiStore((state) => state.presentation);
	const closeChatPanel = useWorkspaceUiStore((state) => state.closeChatPanel);
	const maximizeChat = useWorkspaceUiStore((state) => state.maximizeChat);
	const restorePresentation = useWorkspaceUiStore(
		(state) => state.restorePresentation,
	);
	const isMaximized =
		presentation.mode === "maximized" && presentation.pane.kind === "chat";

	return (
		<aside className="relative flex min-h-screen flex-col bg-background">
			<AiChatPanelToolbar
				isMaximized={isMaximized}
				onClose={closeChatPanel}
				onMaximize={maximizeChat}
				onRestore={restorePresentation}
			/>

			<Conversation className="min-h-0">
				<ConversationContent className="gap-5 px-4 pt-14 pb-5">
					{""}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="px-4 pb-4">
				<div className="mx-auto w-full max-w-2xl">
					<AiChatPromptInput />
				</div>
			</div>
		</aside>
	);
}
