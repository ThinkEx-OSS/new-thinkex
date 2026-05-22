import {
	Maximize2,
	MessageSquare,
	Minimize2,
	PanelRightClose,
} from "lucide-react";

import { Button } from "#/components/ui/button";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";

export default function AiChatPanel() {
	const isMaximized = useAiChatPanelStore((state) => state.isMaximized);
	const toggleCollapsed = useAiChatPanelStore((state) => state.toggleCollapsed);
	const toggleMaximized = useAiChatPanelStore((state) => state.toggleMaximized);

	return (
		<aside className="relative flex min-h-screen flex-col bg-background">
			<div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={isMaximized ? "Restore AI chat" : "Maximize AI chat"}
					onClick={toggleMaximized}
				>
					{isMaximized ? <Minimize2 /> : <Maximize2 />}
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Collapse AI chat"
					onClick={toggleCollapsed}
				>
					<PanelRightClose />
				</Button>
			</div>

			<div className="flex flex-1 items-center justify-center px-6 text-muted-foreground">
				<MessageSquare
					className="size-8"
					strokeWidth={1.5}
					aria-hidden="true"
				/>
			</div>

			<div className="border-t p-4">
				<div className="flex min-h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
					Message AI
				</div>
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
