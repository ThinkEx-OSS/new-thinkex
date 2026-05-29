import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { ScrollArea } from "#/components/ui/scroll-area";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
import { getAIInspectorRunViews } from "#/features/workspaces/ai/ai-inspector-view-model";
import { AIInspectorRunPanel } from "#/features/workspaces/components/ai-chat/AiChatInspectorViews";
import { cn } from "#/lib/utils";

interface AiChatInspectorDialogProps {
	getSnapshot: (threadId: string) => Promise<AIInspectorSnapshot>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	threadId?: string;
}

export function AiChatInspectorDialog({
	getSnapshot,
	onOpenChange,
	open,
	threadId,
}: AiChatInspectorDialogProps) {
	const [snapshot, setSnapshot] = useState<AIInspectorSnapshot>();
	const [error, setError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);
	const [selectedRunId, setSelectedRunId] = useState<string>();

	const loadSnapshot = useCallback(async () => {
		if (!threadId) {
			setSnapshot(undefined);
			return;
		}

		setIsLoading(true);
		setError(undefined);

		try {
			setSnapshot(await getSnapshot(threadId));
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Failed to load AI inspector events.",
			);
		} finally {
			setIsLoading(false);
		}
	}, [getSnapshot, threadId]);

	useEffect(() => {
		if (!open) {
			return;
		}

		void loadSnapshot();
	}, [loadSnapshot, open]);

	const runs = useMemo(
		() => getAIInspectorRunViews(snapshot?.events ?? []),
		[snapshot?.events],
	);
	const selectedRun =
		runs.find((run) => run.runId === selectedRunId) ?? runs[0];

	useEffect(() => {
		if (runs.length === 0) {
			setSelectedRunId(undefined);
			return;
		}

		if (!selectedRunId || !runs.some((run) => run.runId === selectedRunId)) {
			setSelectedRunId(runs[0]?.runId);
		}
	}, [runs, selectedRunId]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="fixed inset-0 top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none">
				<DialogHeader className="border-b px-4 py-3">
					<div className="flex items-start justify-between gap-3 pr-9">
						<div className="min-w-0">
							<DialogTitle>AI Inspector</DialogTitle>
							<DialogDescription className="truncate">
								{threadId ?? "No active thread"}
							</DialogDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="shrink-0 gap-1.5"
							disabled={!threadId || isLoading}
							onClick={() => void loadSnapshot()}
						>
							<RefreshCw
								className={cn("size-3.5", isLoading && "animate-spin")}
								aria-hidden="true"
							/>
							Refresh
						</Button>
					</div>
				</DialogHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className="grid gap-4 p-4 lg:p-6">
						{snapshot && !snapshot.isEnabled ? (
							<p className="text-muted-foreground text-sm">
								The AI inspector is only available in development.
							</p>
						) : null}
						{error ? (
							<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
								{error}
							</p>
						) : null}
						{snapshot?.isEnabled && runs.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No inspector events have been captured for this thread yet.
							</p>
						) : null}
						{runs.length > 1 ? (
							<div className="flex flex-wrap gap-2">
								{runs.map((run, index) => (
									<Button
										key={run.runId}
										type="button"
										variant={
											run.runId === selectedRun?.runId ? "secondary" : "outline"
										}
										size="sm"
										className="gap-2"
										onClick={() => setSelectedRunId(run.runId)}
									>
										Run {runs.length - index}
										<Badge
											variant="outline"
											className="rounded-full font-normal"
										>
											{run.eventCount}
										</Badge>
									</Button>
								))}
							</div>
						) : null}
						{selectedRun ? <AIInspectorRunPanel run={selectedRun} /> : null}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
