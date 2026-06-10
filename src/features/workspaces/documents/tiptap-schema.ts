import { getSchema } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import UnderlineExtension from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

export const tiptapDocumentYjsField = "default";

export function getTiptapDocumentSchemaExtensions() {
	return [
		StarterKit.configure({
			heading: {
				levels: [1, 2, 3],
			},
			link: false,
			underline: false,
			undoRedo: false,
		}),
		UnderlineExtension,
		Highlight,
		Link.configure({
			openOnClick: false,
			autolink: true,
			defaultProtocol: "https",
		}),
		Mathematics.configure({
			katexOptions: {
				throwOnError: false,
			},
		}),
		TextAlign.configure({
			types: ["heading", "paragraph"],
		}),
		TaskList,
		TaskItem.configure({
			nested: true,
		}),
		TableKit.configure({
			table: {
				lastColumnResizable: false,
				resizable: true,
			},
		}),
	];
}

export function getTiptapDocumentSchema() {
	return getSchema(getTiptapDocumentSchemaExtensions());
}
