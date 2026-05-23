import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { RiChatHistoryLine } from "react-icons/ri";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { PLACEHOLDER_CHAT_HISTORY } from "#/features/workspaces/components/ai-chat/constants";

const floatingActionButtonClassName =
	"size-8.5 text-muted-foreground hover:text-foreground";

interface AiChatPanelToolbarProps {
	isMaximized: boolean;
	onClose: () => void;
	onMaximize: () => void;
	onRestore: () => void;
}

export default function AiChatPanelToolbar({
	isMaximized,
	onClose,
	onMaximize,
	onRestore,
}: AiChatPanelToolbarProps) {
	return (
		<div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-md border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className={floatingActionButtonClassName}
						aria-label="Open chat history"
					>
						<RiChatHistoryLine className="size-4" aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuItem>
						<Plus className="size-4" aria-hidden="true" />
						New chat
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Recent chats</DropdownMenuLabel>
					{PLACEHOLDER_CHAT_HISTORY.map((chat) => (
						<DropdownMenuItem key={chat}>{chat}</DropdownMenuItem>
					))}
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
