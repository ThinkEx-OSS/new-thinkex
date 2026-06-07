import type { ReactElement, ReactNode } from "react";

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";

interface WorkspaceFrameProps {
	chrome: ReactNode;
	content: ReactNode;
	chatPanel?: ReactElement;
}

export default function WorkspaceFrame({
	chrome,
	content,
	chatPanel,
}: WorkspaceFrameProps) {
	return (
		<div className="h-screen overflow-hidden bg-background text-foreground">
			<ResizablePanelGroup
				id="workspace-layout"
				orientation="horizontal"
				className="h-full min-h-0"
				resizeTargetMinimumSize={{ coarse: 37, fine: 27 }}
			>
				<ResizablePanel
					id="workspace"
					minSize="45%"
					className="min-h-0 overflow-hidden"
				>
					<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						{chrome}
						<main className="min-h-0 flex-1 bg-background">{content}</main>
					</div>
				</ResizablePanel>

				{chatPanel ? (
					<>
						<ResizableHandle
							id="workspace-ai-chat-separator"
							className="relative z-[45] -mx-[13px] flex w-[27px] items-stretch justify-center bg-transparent outline-none after:hidden [&[data-separator=active]>div]:w-[3px] [&[data-separator=active]>div]:bg-ring [&[data-separator=hover]>div]:w-[3px] [&[data-separator=hover]>div]:bg-ring/70"
							onPointerUp={(event) => event.currentTarget.blur()}
						>
							<div className="my-0 w-px bg-border transition-[background-color,width] duration-150" />
						</ResizableHandle>
						<ResizablePanel
							id="ai-chat"
							defaultSize="30rem"
							minSize="26rem"
							maxSize="60%"
							className="min-h-0 overflow-hidden"
						>
							{chatPanel}
						</ResizablePanel>
					</>
				) : null}
			</ResizablePanelGroup>
		</div>
	);
}
