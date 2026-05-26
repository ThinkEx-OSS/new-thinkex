import {
	Check,
	History,
	LoaderCircle,
	Maximize2,
	Minimize2,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { AIThreadSummary } from "#/features/workspaces/ai/user-ai-agents";
import { formatWorkspaceRecency } from "#/features/workspaces/model/display";
import { cn } from "#/lib/utils";

const floatingActionButtonClassName =
	"size-8.5 text-muted-foreground hover:text-foreground";

interface AiChatPanelToolbarProps {
	activeThreadId?: string;
	isMaximized: boolean;
	isNewChatDisabled?: boolean;
	onClose: () => void;
	onDeleteThread: (thread: AIThreadSummary) => void;
	onMaximize: () => void;
	onNewChat: () => void;
	onRestore: () => void;
	onSelectThread: (threadId: string) => void;
	threads: AIThreadSummary[];
}

export default function AiChatPanelToolbar({
	activeThreadId,
	isMaximized,
	isNewChatDisabled = false,
	onClose,
	onDeleteThread,
	onMaximize,
	onNewChat,
	onRestore,
	onSelectThread,
	threads,
}: AiChatPanelToolbarProps) {
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);

	const handleNewChat = () => {
		onNewChat();
		setIsHistoryOpen(false);
	};

	const handleSelectThread = (threadId: string) => {
		onSelectThread(threadId);
		setIsHistoryOpen(false);
	};

	const handleDeleteThread = (thread: AIThreadSummary) => {
		onDeleteThread(thread);
		setIsHistoryOpen(false);
	};

	return (
		<div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-md border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
			<DropdownMenu open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							className={floatingActionButtonClassName}
							aria-label="Open chat history"
						/>
					}
				>
					<History className="size-4" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuGroup>
						<DropdownMenuItem
							disabled={isNewChatDisabled}
							onClick={handleNewChat}
						>
							<Plus className="size-4" aria-hidden="true" />
							New chat
						</DropdownMenuItem>
					</DropdownMenuGroup>
					{threads.length > 0 ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								{threads.map((thread) => (
									<div key={thread.id} className="group/thread-row relative">
										<DropdownMenuItem
											className={cn(
												"min-w-0 items-start py-2 pr-9",
												thread.id === activeThreadId && "bg-accent",
											)}
											onClick={() => handleSelectThread(thread.id)}
										>
											<span className="grid min-w-0 flex-1 gap-1">
												<span className="truncate font-medium text-sm leading-none">
													{thread.title}
												</span>
												<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs leading-none">
													<span className="truncate">
														{formatWorkspaceRecency(thread.lastActivityAt)}
													</span>
													<ThreadStatusBadge thread={thread} />
												</span>
											</span>
										</DropdownMenuItem>
										<DropdownMenuItem
											className="-translate-y-1/2 absolute top-1/2 right-1 size-7 justify-center p-0 text-muted-foreground opacity-0 hover:text-destructive hover:*:[svg]:text-destructive focus-visible:opacity-100 group-hover/thread-row:opacity-100"
											onClick={() => handleDeleteThread(thread)}
										>
											<Trash2 className="size-3.5" aria-hidden="true" />
											<span className="sr-only">Delete {thread.title}</span>
										</DropdownMenuItem>
									</div>
								))}
							</DropdownMenuGroup>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				variant="ghost"
				size="icon-sm"
				className={floatingActionButtonClassName}
				aria-label={isMaximized ? "Restore AI chat" : "Maximize AI chat"}
				onClick={isMaximized ? onRestore : onMaximize}
			>
				{isMaximized ? (
					<Minimize2 className="size-4" />
				) : (
					<Maximize2 className="size-4" />
				)}
			</Button>

			<Button
				variant="ghost"
				size="icon-sm"
				className={floatingActionButtonClassName}
				aria-label="Close AI chat"
				onClick={onClose}
			>
				<X className="size-4" />
			</Button>
		</div>
	);
}

function ThreadStatusBadge({ thread }: { thread: AIThreadSummary }) {
	if (thread.isRunning) {
		return (
			<Badge
				variant="secondary"
				className="h-4 shrink-0 gap-1 rounded-full px-1.5 font-normal text-[10px] leading-none"
			>
				<LoaderCircle className="size-2.5 animate-spin" aria-hidden="true" />
				Running
			</Badge>
		);
	}

	if (thread.hasUnreadCompletion) {
		return (
			<Badge
				variant="outline"
				className="h-4 shrink-0 gap-1 rounded-full border-emerald-500/25 bg-emerald-500/10 px-1.5 font-normal text-[10px] text-emerald-700 leading-none dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
			>
				<Check className="size-2.5" aria-hidden="true" />
				Complete
			</Badge>
		);
	}

	return null;
}
