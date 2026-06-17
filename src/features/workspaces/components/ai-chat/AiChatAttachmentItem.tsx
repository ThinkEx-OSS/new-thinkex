import type { FileUIPart, SourceDocumentUIPart } from "ai";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import {
	Attachment,
	type AttachmentData,
	AttachmentInfo,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
	type AttachmentVariant,
	getAttachmentLabel,
	getMediaCategory,
} from "#/components/ai-elements/attachments";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

export function AiChatAttachmentGroup({
	children,
	data,
}: {
	children: ReactNode;
	data: AttachmentData;
}) {
	return (
		<Attachments variant={getAiChatAttachmentVariant(data)}>
			{children}
		</Attachments>
	);
}

export function AiChatAttachmentItem({
	data,
	onRemove,
}: {
	data: AttachmentData;
	onRemove?: () => void;
}) {
	if (isPreviewableImageAttachment(data)) {
		return <AiChatImageAttachment data={data} onRemove={onRemove} />;
	}

	return (
		<Attachment data={data} onRemove={onRemove}>
			<AttachmentPreview />
			<AttachmentInfo />
			<AttachmentRemove />
		</Attachment>
	);
}

export function getFileAttachmentData(
	part: FileUIPart,
): FileUIPart & { id: string } {
	return { ...part, id: part.url };
}

export function getSourceDocumentAttachmentData(
	part: SourceDocumentUIPart,
): SourceDocumentUIPart & { id: string } {
	return { ...part, id: part.sourceId };
}

function getAiChatAttachmentVariant(data: AttachmentData): AttachmentVariant {
	return isPreviewableImageAttachment(data) ? "grid" : "inline";
}

function isPreviewableImageAttachment(
	data: AttachmentData,
): data is FileUIPart & { id: string } {
	return (
		getMediaCategory(data) === "image" &&
		data.type === "file" &&
		Boolean(data.url)
	);
}

function AiChatImageAttachment({
	data,
	onRemove,
}: {
	data: FileUIPart & { id: string };
	onRemove?: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const label = getAttachmentLabel(data);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		setIsOpen(true);
	};

	return (
		<>
			<Attachment
				className="cursor-zoom-in outline-none ring-ring/35 transition-shadow focus-visible:ring-2"
				data={data}
				onClick={() => setIsOpen(true)}
				onKeyDown={handleKeyDown}
				onRemove={onRemove}
				role="button"
				tabIndex={0}
			>
				<AttachmentPreview />
				<AttachmentRemove />
			</Attachment>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-[min(96vw,900px)] gap-4 p-4 sm:max-w-4xl">
					<DialogHeader className="pr-8">
						<DialogTitle className="truncate text-base">{label}</DialogTitle>
					</DialogHeader>
					<div className="flex max-h-[78vh] min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
						<img
							alt={label}
							className="max-h-[78vh] max-w-full object-contain"
							src={data.url}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
