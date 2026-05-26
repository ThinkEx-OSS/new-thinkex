import { Check, X } from "lucide-react";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "#/components/ai-elements/tool";
import { Button } from "#/components/ui/button";
import type {
	AiChatToolApprovalResponse,
	AiChatToolPart,
} from "#/features/workspaces/components/ai-chat/types";

interface AiChatToolCardProps {
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
	part: AiChatToolPart;
}

export default function AiChatToolCard({
	onToolApprovalResponse,
	part,
}: AiChatToolCardProps) {
	const header =
		part.type === "dynamic-tool" ? (
			<ToolHeader
				title={part.title}
				type={part.type}
				toolName={part.toolName}
				state={part.state}
			/>
		) : (
			<ToolHeader title={part.title} type={part.type} state={part.state} />
		);
	const approvalId = getApprovalId(part);

	return (
		<Tool defaultOpen={part.state === "approval-requested"}>
			{header}
			<ToolContent>
				{part.input === undefined ? null : <ToolInput input={part.input} />}
				{approvalId && onToolApprovalResponse ? (
					<div className="flex items-center gap-2">
						<Button
							size="xs"
							type="button"
							onClick={() =>
								onToolApprovalResponse({ id: approvalId, approved: true })
							}
						>
							<Check className="size-3" />
							Approve
						</Button>
						<Button
							size="xs"
							type="button"
							variant="secondary"
							onClick={() =>
								onToolApprovalResponse({ id: approvalId, approved: false })
							}
						>
							<X className="size-3" />
							Reject
						</Button>
					</div>
				) : null}
				<ToolOutput output={part.output} errorText={part.errorText} />
			</ToolContent>
		</Tool>
	);
}

function getApprovalId(part: AiChatToolPart) {
	if (part.state !== "approval-requested" || !("approval" in part)) {
		return null;
	}

	return part.approval.id;
}
