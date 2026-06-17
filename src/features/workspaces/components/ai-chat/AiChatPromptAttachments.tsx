import { Attachments } from "#/components/ai-elements/attachments";
import { usePromptInputAttachments } from "#/components/ai-elements/prompt-input";
import { AiChatAttachmentItem } from "#/features/workspaces/components/ai-chat/AiChatAttachmentItem";

export default function AiChatPromptAttachments() {
	const attachments = usePromptInputAttachments();

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<Attachments className="ml-0 w-full min-w-0" variant="grid">
			{attachments.files.map((file) => (
				<AiChatAttachmentItem
					key={file.id}
					data={file}
					onRemove={() => attachments.remove(file.id)}
				/>
			))}
		</Attachments>
	);
}
