import { Suspense, useEffect, useState } from "react";
import {
	Conversation,
	ConversationContent,
} from "#/components/ai-elements/conversation";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { scheduleAiChatThinkingLoaderPrewarm } from "#/features/workspaces/components/ai-chat/AiChatAssistantPending";
import {
	AiChatAttachmentDropProvider,
	useAiChatAttachmentDrop,
} from "#/features/workspaces/components/ai-chat/AiChatAttachmentDrop";
import AiChatPanelToolbar from "#/features/workspaces/components/ai-chat/AiChatPanelToolbar";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import AiChatThreadView from "#/features/workspaces/components/ai-chat/AiChatThreadView";
import AiChatTranscriptRail from "#/features/workspaces/components/ai-chat/AiChatTranscriptRail";
import { getAiChatPanelBodyPhase } from "#/features/workspaces/components/ai-chat/ai-chat-panel-phase";
import { useAiChatPanelController } from "#/features/workspaces/components/ai-chat/useAiChatPanelController";
import { WorkspaceFileDropOverlay } from "#/features/workspaces/components/WorkspaceFileDropOverlay";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";

interface AiChatPanelProps {
	context: WorkspaceAiContextScope;
}

export default function AiChatPanel({ context }: AiChatPanelProps) {
	return (
		<AiChatAttachmentDropProvider>
			<AiChatPanelLayout context={context} />
		</AiChatAttachmentDropProvider>
	);
}

function AiChatPanelLayout({ context }: AiChatPanelProps) {
	const [activeThreadIsRecovering, setActiveThreadIsRecovering] =
		useState(false);
	const {
		activeThreadId,
		areThreadsReady,
		deleteThreadDialog,
		getThreadInspectorSnapshot,
		isCreatingThread,
		isMaximized,
		modelId,
		onClose,
		onDeleteThread,
		onMaximize,
		onModelChange,
		onNewChat,
		onRestore,
		onSelectThread,
		threads,
	} = useAiChatPanelController({ workspaceId: context.workspaceId });
	const { isDropActive, mergePanelRef } = useAiChatAttachmentDrop();

	useEffect(() => {
		return scheduleAiChatThinkingLoaderPrewarm();
	}, []);

	const panelBodyPhase = getAiChatPanelBodyPhase({
		activeThreadId,
		areThreadsReady,
		threadCount: threads.length,
	});

	return (
		<aside
			ref={mergePanelRef}
			className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background"
		>
			<AiChatPanelToolbar
				activeThreadId={activeThreadId}
				activeThreadIsRecovering={activeThreadIsRecovering}
				isMaximized={isMaximized}
				onClose={onClose}
				onDeleteThread={onDeleteThread}
				isNewChatDisabled={isCreatingThread}
				onNewChat={onNewChat}
				onMaximize={onMaximize}
				onRestore={onRestore}
				onSelectThread={onSelectThread}
				threads={threads}
			/>

			{panelBodyPhase.kind === "empty" ? (
				<AiChatPanelEmpty
					isCreatingThread={isCreatingThread}
					onNewChat={onNewChat}
				/>
			) : panelBodyPhase.kind === "loading" ? (
				<AiChatPanelLoading />
			) : (
				<Suspense
					key={panelBodyPhase.threadId}
					fallback={<AiChatPanelLoading />}
				>
					<AiChatThreadView
						context={context}
						getInspectorSnapshot={getThreadInspectorSnapshot}
						modelId={modelId}
						onModelChange={onModelChange}
						onRecoveringChange={setActiveThreadIsRecovering}
						threadSummary={threads.find(
							(thread) => thread.id === panelBodyPhase.threadId,
						)}
						threadId={panelBodyPhase.threadId}
					/>
				</Suspense>
			)}

			{isDropActive ? (
				<WorkspaceFileDropOverlay
					description="Images will be added to your next message."
					title="Drop images to attach"
				/>
			) : null}

			<AlertDialog
				open={deleteThreadDialog.open}
				onOpenChange={deleteThreadDialog.onOpenChange}
				onOpenChangeComplete={(nextOpen) => {
					if (!nextOpen) {
						deleteThreadDialog.onClosed();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete chat?</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone.
							{deleteThreadDialog.thread
								? ` "${deleteThreadDialog.thread.title}" will be removed.`
								: ""}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (deleteThreadDialog.thread) {
									deleteThreadDialog.onConfirm(deleteThreadDialog.thread.id);
								}

								deleteThreadDialog.onOpenChange(false);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</aside>
	);
}

function AiChatPanelEmpty({
	isCreatingThread,
	onNewChat,
}: {
	isCreatingThread: boolean;
	onNewChat: () => void;
}) {
	return (
		<Conversation className="h-full min-h-0">
			<ConversationContent
				scrollClassName="min-h-0 overscroll-contain"
				className="items-center justify-center gap-3 px-4 py-8 text-center"
			>
				<p className="text-muted-foreground text-sm">
					No chats yet. Start a new conversation.
				</p>
				<Button
					type="button"
					size="sm"
					disabled={isCreatingThread}
					onClick={onNewChat}
				>
					New chat
				</Button>
			</ConversationContent>
		</Conversation>
	);
}

function AiChatPanelLoading() {
	return (
		<Conversation className="h-full min-h-0">
			<ConversationContent
				scrollClassName="min-h-0 overscroll-contain"
				className="gap-5 px-4 pt-5 pb-5"
			>
				<AiChatTranscriptRail withTopInset>
					<AiChatThreadSkeleton />
				</AiChatTranscriptRail>
			</ConversationContent>
		</Conversation>
	);
}
