import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import "katex/dist/katex.min.css";

import { CodeBlockShiki } from "#/features/workspaces/documents/code-block-shiki";
import {
	getTiptapDocumentSchemaExtensions,
	tiptapDocumentYjsField,
} from "#/features/workspaces/documents/tiptap-schema";

export { tiptapDocumentYjsField };

export function getTiptapDocumentBaseExtensions() {
	return [
		...getTiptapDocumentSchemaExtensions({
			codeBlock: CodeBlockShiki,
		}),
		Placeholder.configure({
			placeholder: ({ node }) =>
				node.type.name === "heading" ? "Untitled" : "Write something...",
		}),
		CharacterCount,
	];
}
