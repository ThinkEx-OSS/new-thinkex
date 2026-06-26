import { ChevronDown } from "lucide-react";

import { Shimmer } from "#/components/ai-elements/shimmer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import {
	getToolActivityForPart,
	type AiChatToolChildActivity,
	type AiChatToolActivity,
} from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type { AiChatToolPart } from "#/features/workspaces/components/ai-chat/types";

export function AiChatToolActivityRow({
	part,
	nestedChildren = [],
}: {
	part: AiChatToolPart;
	nestedChildren?: AiChatToolChildActivity[];
}) {
	const activity = getToolActivityForPart(part);

	if (!activity) {
		return null;
	}

	const hasDetails = nestedChildren.length > 0;

	if (!hasDetails) {
		return <ActivitySummary activity={activity} />;
	}

	return (
		<Collapsible className="w-fit max-w-full">
			<CollapsibleTrigger className="w-fit max-w-full text-left">
				<ActivitySummary activity={activity} canExpand />
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-2 space-y-2 pl-7">
				{nestedChildren.length > 0 ? (
					<div className="space-y-1">
						{nestedChildren.map((child) => (
							<div
								key={`${child.toolName}:${child.summary}`}
								className="text-muted-foreground/80 text-sm"
							>
								{child.summary}
							</div>
						))}
					</div>
				) : null}
			</CollapsibleContent>
		</Collapsible>
	);
}

function ActivitySummary({
	activity,
	canExpand = false,
}: {
	activity: AiChatToolActivity;
	canExpand?: boolean;
}) {
	const isRunning = activity.status === "running";

	if (isRunning) {
		return (
			<div className="flex max-w-full items-center gap-2 py-1 text-muted-foreground/80 text-sm">
				<Shimmer as="span" className="text-sm text-muted-foreground/80" duration={1.4}>
					{activity.summary}
				</Shimmer>
				{canExpand ? <ChevronDown className="size-3 shrink-0" aria-hidden="true" /> : null}
			</div>
		);
	}

	return (
		<div className="flex max-w-full items-center gap-2 py-1 text-muted-foreground text-sm">
			<span className="truncate text-muted-foreground/80">{activity.summary}</span>
			{canExpand ? <ChevronDown className="size-3 shrink-0" aria-hidden="true" /> : null}
		</div>
	);
}
