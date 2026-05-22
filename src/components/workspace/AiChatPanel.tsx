import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { useState } from "react";
import { RiChatHistoryLine } from "react-icons/ri";

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "#/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "#/components/ai-elements/message";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
} from "#/components/ai-elements/prompt-input";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";

const placeholderChats = [
	"Workspace brief",
	"Q2 planning notes",
	"Customer interview summary",
];

const placeholderMessages = [
	{
		id: "welcome",
		role: "assistant" as const,
		text: "What should we work on in this workspace?",
	},
	{
		id: "request",
		role: "user" as const,
		text: "Summarize the current workspace and suggest next steps.",
	},
	{
		id: "response",
		role: "assistant" as const,
		text: "I can help review workspace items, draft plans, and turn notes into actionable tasks once chat logic is connected.",
	},
];

const floatingActionButtonClassName =
	"size-8.5 text-muted-foreground hover:text-foreground";

export default function AiChatPanel() {
	const [input, setInput] = useState("");
	const isMaximized = useAiChatPanelStore((state) => state.isMaximized);
	const toggleCollapsed = useAiChatPanelStore((state) => state.toggleCollapsed);
	const toggleMaximized = useAiChatPanelStore((state) => state.toggleMaximized);
	const handleSubmit = (message: PromptInputMessage) => {
		if (!message.text.trim()) {
			return;
		}

		setInput("");
	};

	return (
		<aside className="relative flex min-h-screen flex-col bg-background">
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
						{placeholderChats.map((chat) => (
							<DropdownMenuItem key={chat}>{chat}</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<Button
					variant="ghost"
					size="icon-sm"
					className={floatingActionButtonClassName}
					aria-label={isMaximized ? "Restore AI chat" : "Maximize AI chat"}
					onClick={toggleMaximized}
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
					onClick={toggleCollapsed}
				>
					<X className="size-4" />
				</Button>
			</div>

			<Conversation className="min-h-0">
				<ConversationContent className="gap-5 px-4 pt-14 pb-5">
					{placeholderMessages.map((message) => (
						<Message key={message.id} from={message.role}>
							<MessageContent>
								<MessageResponse>{message.text}</MessageResponse>
							</MessageContent>
						</Message>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="border-t p-4">
				<PromptInput onSubmit={handleSubmit}>
					<PromptInputBody>
						<PromptInputTextarea
							value={input}
							placeholder="Message AI"
							onChange={(event) => setInput(event.currentTarget.value)}
							className="min-h-12"
						/>
					</PromptInputBody>
					<PromptInputFooter>
						<div />
						<PromptInputSubmit disabled={!input.trim()} status="ready" />
					</PromptInputFooter>
				</PromptInput>
			</div>
		</aside>
	);
}

export function AiChatPanelMaximized() {
	return (
		<div className="fixed inset-0 z-50 bg-background">
			<AiChatPanel />
		</div>
	);
}
