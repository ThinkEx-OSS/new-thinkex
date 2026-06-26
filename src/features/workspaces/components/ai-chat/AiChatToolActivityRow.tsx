import { ChevronDown } from "lucide-react";

import { Shimmer } from "#/components/ai-elements/shimmer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import {
	getToolActivityForPart,
	type AiChatToolActivity,
} from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type { AiChatToolPart } from "#/features/workspaces/components/ai-chat/types";
import { cn } from "#/lib/utils";

export function AiChatToolActivityRow({ part }: { part: AiChatToolPart }) {
	const activity = getToolActivityForPart(part);

	if (!activity) {
		return null;
	}

	const hasDetails = activity.detail.input !== undefined || activity.detail.output !== undefined;
	const isRunning = activity.status === "running";

	if (!hasDetails) {
		return <ActivitySummary activity={activity} />;
	}

	return (
		<Collapsible className="w-fit max-w-full">
			<CollapsibleTrigger className="w-fit max-w-full text-left">
				<ActivitySummary activity={activity} canExpand />
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-2 space-y-2 pl-7">
				{activity.detail.output !== undefined ? (
					<DetailBlock
						label={isRunning ? "Current result" : "Result"}
						value={formatDetailValue(activity.detail.output)}
					/>
				) : null}
				{activity.detail.input !== undefined ? (
					<DetailBlock label="Details" value={formatDetailValue(activity.detail.input)} />
				) : null}
				{activity.detail.errorText ? (
					<DetailBlock label="Reason" tone="muted" value={activity.detail.errorText} />
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
			<div className="flex max-w-full items-center gap-2 py-1 text-muted-foreground text-xs">
				<Shimmer as="span" className="text-xs text-muted-foreground" duration={1.4}>
					{activity.summary}
				</Shimmer>
				{canExpand ? <ChevronDown className="size-3 shrink-0" aria-hidden="true" /> : null}
			</div>
		);
	}

	return (
		<div className="flex max-w-full items-center gap-2 py-1 text-muted-foreground text-xs">
			<span
				className={cn(
					"truncate",
					activity.status === "failed" ? "text-muted-foreground" : "text-foreground/80",
				)}
			>
				{activity.summary}
			</span>
			{canExpand ? <ChevronDown className="size-3 shrink-0" aria-hidden="true" /> : null}
		</div>
	);
}

function DetailBlock({ label, tone, value }: { label: string; tone?: "muted"; value: string }) {
	return (
		<div className="space-y-1">
			<div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
			<pre
				className={cn(
					"max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground [overflow-wrap:anywhere]",
					tone === "muted" && "text-muted-foreground",
				)}
			>
				{value}
			</pre>
		</div>
	);
}

function formatDetailValue(value: unknown) {
	if (typeof value === "string") {
		return value;
	}

	try {
		return JSON.stringify(value ?? null, null, 2);
	} catch {
		return String(value);
	}
}
