import { GripVertical } from "lucide-react";
import type * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "#/lib/utils.ts";

function ResizablePanelGroup({
	className,
	...props
}: React.ComponentProps<typeof Group>) {
	return (
		<Group
			data-slot="resizable-panel-group"
			className={cn(
				"flex h-full w-full data-[panel-group-orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

function ResizablePanel(props: React.ComponentProps<typeof Panel>) {
	return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	className,
	children,
	...props
}: React.ComponentProps<typeof Separator> & {
	withHandle?: boolean;
}) {
	return (
		<Separator
			data-slot="resizable-handle"
			className={cn(
				"relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none data-[panel-group-orientation=vertical]:h-px data-[panel-group-orientation=vertical]:w-full data-[panel-group-orientation=vertical]:after:left-0 data-[panel-group-orientation=vertical]:after:h-1 data-[panel-group-orientation=vertical]:after:w-full data-[panel-group-orientation=vertical]:after:translate-x-0 data-[panel-group-orientation=vertical]:after:-translate-y-1/2 [&[data-panel-group-orientation=vertical]>div]:rotate-90",
				className,
			)}
			{...props}
		>
			{children ??
				(withHandle ? (
					<div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
						<GripVertical className="size-2.5" />
					</div>
				) : null)}
		</Separator>
	);
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
