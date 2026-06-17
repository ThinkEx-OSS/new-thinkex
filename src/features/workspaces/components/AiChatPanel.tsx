import { Suspense, useCallback, useEffect } from "react";
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
import { useAiChatPanelController } from "#/features/workspaces/components/ai-chat/useAiChatPanelController";
import { useWorkspaceAiContextDropTarget } from "#/features/workspaces/components/useWorkspaceDropTarget";
import { WorkspaceFileDropOverlay } from "#/features/workspaces/components/WorkspaceFileDropOverlay";
import {
	WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
	workspaceAiContextCollisionDetector,
} from "#/features/workspaces/components/workspace-ai-context-collision";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import { interactionHighlightClassName } from "#/lib/design-system-colors";
import { cn } from "#/lib/utils";

interface AiChatPanelProps {
	context: WorkspaceAiContextScope;
}

export default function AiChatPanel({ context }: AiChatPanelProps) {
	const workspaceDrop = useWorkspaceAiContextDropTarget({
		workspaceId: context.workspaceId,
		collisionDetector: workspaceAiContextCollisionDetector,
		collisionPriority: WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
	});

	return (
		<AiChatAttachmentDropProvider>
			<AiChatPanelLayout context={context} workspaceDrop={workspaceDrop} />
		</AiChatAttachmentDropProvider>
	);
}

function AiChatPanelLayout({
	context,
	workspaceDrop,
}: AiChatPanelProps & {
	workspaceDrop: ReturnType<typeof useWorkspaceAiContextDropTarget>;
}) {
	const {
		activeThreadId,
		areThreadsReady,
		deleteThreadDialog,
		getThreadInspectorSnapshot,
		activeThread,
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
	const setPanelRef = useCallback(
		(element: HTMLElement | null) => {
			mergePanelRef(element);
			workspaceDrop.ref(element);
		},
		[mergePanelRef, workspaceDrop.ref],
	);

	useEffect(() => {
		return scheduleAiChatThinkingLoaderPrewarm();
	}, []);

	return (
		<aside
			ref={setPanelRef}
			className={cn(
				"relative flex h-full min-h-0 flex-col overflow-hidden bg-background transition-shadow",
				workspaceDrop.isDropTarget && interactionHighlightClassName.ringInset,
			)}
		>
			<AiChatPanelToolbar
				activeThreadId={activeThreadId}
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

			{!areThreadsReady ? (
				<AiChatPanelLoading />
			) : !activeThreadId ? (
				<AiChatPanelEmpty
					isCreatingThread={isCreatingThread}
					onNewChat={onNewChat}
				/>
			) : (
				<Suspense key={activeThreadId} fallback={<AiChatPanelLoading />}>
					<AiChatThreadView
						context={context}
						getInspectorSnapshot={getThreadInspectorSnapshot}
						hasPersistedMessages={Boolean(activeThread?.lastUserMessageAt)}
						modelId={modelId}
						onModelChange={onModelChange}
						threadId={activeThreadId}
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
		<Conversation className="min-h-0">
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
		<Conversation className="min-h-0">
			<ConversationContent
				scrollClassName="min-h-0 overscroll-contain"
				className="gap-5 px-4 pt-5 pb-5"
			>
				<AiChatThreadSkeleton />
			</ConversationContent>
		</Conversation>
	);
}
