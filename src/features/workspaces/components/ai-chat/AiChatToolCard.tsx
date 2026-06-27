import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "#/features/workspaces/components/ai-chat/ai-chat-tool";
import type { AiChatToolPart } from "#/features/workspaces/components/ai-chat/types";

interface AiChatToolCardProps {
	part: AiChatToolPart;
}

export default function AiChatToolCard({ part }: AiChatToolCardProps) {
	const header =
		part.type === "dynamic-tool" ? (
			<ToolHeader title={part.title} type={part.type} toolName={part.toolName} state={part.state} />
		) : (
			<ToolHeader title={part.title} type={part.type} state={part.state} />
		);

	return (
		<Tool>
			{header}
			<ToolContent>
				{part.input === undefined ? null : <ToolInput input={part.input} />}
				<ToolOutput output={part.output} errorText={part.errorText} />
			</ToolContent>
		</Tool>
	);
}
