import { Upload } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { scheduleAiChatThinkingLoaderPrewarm } from "#/features/workspaces/components/ai-chat/AiChatAssistantPending";
import AiChatPanelToolbar from "#/features/workspaces/components/ai-chat/AiChatPanelToolbar";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import AiChatThreadView from "#/features/workspaces/components/ai-chat/AiChatThreadView";
import { useAiChatPanelController } from "#/features/workspaces/components/ai-chat/useAiChatPanelController";
import { useWorkspaceAiContextDropTarget } from "#/features/workspaces/components/useWorkspaceDropTarget";
import {
	WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
	workspaceAiContextCollisionDetector,
} from "#/features/workspaces/components/workspace-ai-context-collision";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import { cn } from "#/lib/utils";

interface AiChatPanelProps {
	context: WorkspaceAiContextScope;
}

export default function AiChatPanel({ context }: AiChatPanelProps) {
	const {
		activeThreadId,
		areThreadsReady,
		deleteThreadDialog,
		getThreadInspectorSnapshot,
		isEnsuringDraftThread,
		isMaximized,
		modelId,
		onClose,
		onDeleteThread,
		onMaximize,
		onModelChange,
		onNewChat,
		onRestore,
		onSelectThread,
		onThreadActivated,
		selectedThread,
		visibleThreadList,
	} = useAiChatPanelController({ workspaceId: context.workspaceId });
	const { isDropTarget, ref } = useWorkspaceAiContextDropTarget({
		workspaceId: context.workspaceId,
		collisionDetector: workspaceAiContextCollisionDetector,
		collisionPriority: WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
	});
	const [isAttachmentDropTarget, setIsAttachmentDropTarget] = useState(false);
	const attachmentDropTargetRef = useRef<HTMLElement | null>(null);
	const setPanelRef = useCallback(
		(element: HTMLElement | null) => {
			attachmentDropTargetRef.current = element;
			ref(element);
		},
		[ref],
	);

	useEffect(() => {
		return scheduleAiChatThinkingLoaderPrewarm();
	}, []);

	return (
		<aside
			ref={setPanelRef}
			className={cn(
				"relative flex h-full min-h-0 flex-col overflow-hidden bg-background transition-shadow",
				isDropTarget && "ring-2 ring-primary/45 ring-inset",
			)}
		>
			<AiChatPanelToolbar
				activeThreadId={activeThreadId}
				isMaximized={isMaximized}
				onClose={onClose}
				onDeleteThread={onDeleteThread}
				isNewChatDisabled={isEnsuringDraftThread}
				onNewChat={onNewChat}
				onMaximize={onMaximize}
				onRestore={onRestore}
				onSelectThread={onSelectThread}
				threads={visibleThreadList}
			/>

			{!areThreadsReady || !activeThreadId ? (
				<AiChatPanelLoading />
			) : (
				<Suspense key={activeThreadId} fallback={<AiChatPanelLoading />}>
					<AiChatThreadView
						attachmentDropTargetRef={attachmentDropTargetRef}
						context={context}
						getInspectorSnapshot={getThreadInspectorSnapshot}
						hasPersistedMessages={Boolean(selectedThread?.lastUserMessageAt)}
						modelId={modelId}
						onAttachmentDragActiveChange={setIsAttachmentDropTarget}
						onModelChange={onModelChange}
						onThreadActivated={onThreadActivated}
						threadId={activeThreadId}
					/>
				</Suspense>
			)}

			{isAttachmentDropTarget ? <AiChatAttachmentDropOverlay /> : null}

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

function AiChatAttachmentDropOverlay() {
	return (
		<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-6 backdrop-blur-[2px]">
			<div className="flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-3 rounded-md border border-primary/40 border-dashed bg-card/90 px-6 py-8 text-center shadow-lg ring-1 ring-primary/15">
				<div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
					<Upload className="size-5" aria-hidden="true" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">
						Drop images to attach
					</p>
					<p className="text-muted-foreground text-xs">
						Images will be added to your next message.
					</p>
				</div>
			</div>
		</div>
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
