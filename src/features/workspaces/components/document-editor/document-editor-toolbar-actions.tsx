import type { Editor } from "@tiptap/react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	CheckSquare,
	Code,
	CodeXml,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	Italic,
	Link2,
	List,
	ListOrdered,
	Minus,
	Pilcrow,
	Sigma,
	Strikethrough,
	Table2,
	Underline,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
	DocumentEditorUiState,
	DocumentFontSize,
	DocumentInlineMark,
	DocumentStructureBlock,
	DocumentTextAlign,
} from "#/features/workspaces/components/document-editor/document-editor-state";

export interface DocumentToolbarAction {
	active?: (editorState: DocumentEditorUiState) => boolean;
	icon?: ReactNode;
	id: string;
	label: string;
	run: (editor: Editor) => void;
}

export const documentFontSizeActions: DocumentToolbarAction[] = [
	{
		id: "font-size-16",
		icon: <Pilcrow />,
		label: "Paragraph",
		active: (editorState) => isFontSize(editorState, "16"),
		run: (editor) => editor.chain().focus().setParagraph().run(),
	},
	{
		id: "font-size-32",
		icon: <Heading1 />,
		label: "Heading 1",
		active: (editorState) => isFontSize(editorState, "32"),
		run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
	},
	{
		id: "font-size-24",
		icon: <Heading2 />,
		label: "Heading 2",
		active: (editorState) => isFontSize(editorState, "24"),
		run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
	},
	{
		id: "font-size-18",
		icon: <Heading3 />,
		label: "Heading 3",
		active: (editorState) => isFontSize(editorState, "18"),
		run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
	},
];

export const documentTextAlignActions: DocumentToolbarAction[] = [
	{
		id: "align-left",
		icon: <AlignLeft />,
		label: "Align left",
		active: (editorState) => editorState.textAlign === "left",
		run: (editor) => editor.chain().focus().unsetTextAlign().run(),
	},
	{
		id: "align-center",
		icon: <AlignCenter />,
		label: "Align center",
		active: (editorState) => editorState.textAlign === "center",
		run: (editor) => editor.chain().focus().setTextAlign("center").run(),
	},
	{
		id: "align-right",
		icon: <AlignRight />,
		label: "Align right",
		active: (editorState) => editorState.textAlign === "right",
		run: (editor) => editor.chain().focus().setTextAlign("right").run(),
	},
	{
		id: "align-justify",
		icon: <AlignJustify />,
		label: "Justify",
		active: (editorState) => editorState.textAlign === "justify",
		run: (editor) => editor.chain().focus().setTextAlign("justify").run(),
	},
];

export const documentBlockActions: DocumentToolbarAction[] = [
	{
		id: "bullet-list",
		icon: <List />,
		label: "Bullet",
		active: (editorState) => isStructureBlock(editorState, "bulletList"),
		run: (editor) => editor.chain().focus().toggleBulletList().run(),
	},
	{
		id: "ordered-list",
		icon: <ListOrdered />,
		label: "Numbered",
		active: (editorState) => isStructureBlock(editorState, "orderedList"),
		run: (editor) => editor.chain().focus().toggleOrderedList().run(),
	},
	{
		id: "task-list",
		icon: <CheckSquare />,
		label: "Tasks",
		active: (editorState) => isStructureBlock(editorState, "taskList"),
		run: (editor) => editor.chain().focus().toggleTaskList().run(),
	},
	{
		id: "code-block",
		icon: <CodeXml />,
		label: "Code",
		active: (editorState) => isStructureBlock(editorState, "codeBlock"),
		run: (editor) =>
			editor.chain().focus().toggleCodeBlock({ language: "typescript" }).run(),
	},
	{
		id: "horizontal-rule",
		icon: <Minus />,
		label: "Divider",
		run: (editor) => editor.chain().focus().setHorizontalRule().run(),
	},
	{
		id: "block-math",
		icon: <Sigma />,
		label: "Equation",
		active: (editorState) => isStructureBlock(editorState, "blockMath"),
		run: setBlockMath,
	},
	{
		id: "table",
		icon: <Table2 />,
		label: "Table",
		active: (editorState) => isStructureBlock(editorState, "table"),
		run: (editor) =>
			editor
				.chain()
				.focus()
				.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
				.run(),
	},
];

export const documentInlineActions: DocumentToolbarAction[] = [
	{
		id: "bold",
		icon: <Bold />,
		label: "Bold",
		active: (editorState) => editorState.inlineMarks.bold,
		run: (editor) => editor.chain().focus().toggleBold().run(),
	},
	{
		id: "italic",
		icon: <Italic />,
		label: "Italic",
		active: (editorState) => editorState.inlineMarks.italic,
		run: (editor) => editor.chain().focus().toggleItalic().run(),
	},
	{
		id: "underline",
		icon: <Underline />,
		label: "Underline",
		active: (editorState) => editorState.inlineMarks.underline,
		run: (editor) => editor.chain().focus().toggleUnderline().run(),
	},
	{
		id: "strike",
		icon: <Strikethrough />,
		label: "Strikethrough",
		active: (editorState) => editorState.inlineMarks.strike,
		run: (editor) => editor.chain().focus().toggleStrike().run(),
	},
	{
		id: "inline-code",
		icon: <Code />,
		label: "Inline code",
		active: (editorState) => editorState.inlineMarks.code,
		run: (editor) => editor.chain().focus().toggleCode().run(),
	},
	{
		id: "highlight",
		icon: <Highlighter />,
		label: "Highlight",
		active: (editorState) => editorState.inlineMarks.highlight,
		run: (editor) => editor.chain().focus().toggleHighlight().run(),
	},
	{
		id: "link",
		icon: <Link2 />,
		label: "Link",
		active: (editorState) => editorState.inlineMarks.link,
		run: setSelectionLink,
	},
	{
		id: "inline-math",
		icon: <Sigma />,
		label: "Inline equation",
		active: (editorState) => editorState.inlineMarks.inlineMath,
		run: setInlineMath,
	},
];

export function getStructureBlockIcon(type: DocumentStructureBlock) {
	switch (type) {
		case "blockMath":
			return <Sigma />;
		case "bulletList":
			return <List />;
		case "codeBlock":
			return <CodeXml />;
		case "orderedList":
			return <ListOrdered />;
		case "table":
			return <Table2 />;
		case "taskList":
			return <CheckSquare />;
	}
}

export function getFontSizeIcon(size: DocumentFontSize) {
	switch (size) {
		case "16":
			return <Pilcrow />;
		case "18":
			return <Heading3 />;
		case "24":
			return <Heading2 />;
		case "32":
			return <Heading1 />;
	}
}

export function getTextAlignIcon(align: DocumentTextAlign) {
	switch (align) {
		case "center":
			return <AlignCenter />;
		case "justify":
			return <AlignJustify />;
		case "left":
			return <AlignLeft />;
		case "right":
			return <AlignRight />;
	}
}

export function getInlineMarkIcon(mark: DocumentInlineMark) {
	switch (mark) {
		case "bold":
			return <Bold />;
		case "code":
			return <Code />;
		case "highlight":
			return <Highlighter />;
		case "inlineMath":
			return <Sigma />;
		case "italic":
			return <Italic />;
		case "link":
			return <Link2 />;
		case "strike":
			return <Strikethrough />;
		case "underline":
			return <Underline />;
	}
}

function isFontSize(
	editorState: DocumentEditorUiState,
	size: DocumentFontSize,
) {
	return (
		editorState.block.kind === "fontSize" && editorState.block.size === size
	);
}

function isStructureBlock(
	editorState: DocumentEditorUiState,
	type: DocumentStructureBlock,
) {
	return (
		editorState.block.kind === "structure" && editorState.block.type === type
	);
}

function setSelectionLink(editor: Editor) {
	const currentHref = editor.getAttributes("link").href;
	const href = globalThis.prompt(
		"Link URL",
		typeof currentHref === "string" ? currentHref : "",
	);

	if (href === null) {
		return;
	}

	const trimmedHref = href.trim();
	const chain = editor.chain().focus().extendMarkRange("link");

	if (!trimmedHref) {
		chain.unsetLink().run();
		return;
	}

	chain.setLink({ href: trimmedHref }).run();
}

function setInlineMath(editor: Editor) {
	const currentLatex = getCurrentLatex(editor, "inlineMath");
	const latex = promptMathLatex("Inline equation", currentLatex);

	if (latex === null) {
		return;
	}

	if (!latex) {
		if (editor.isActive("inlineMath")) {
			editor.chain().focus().deleteInlineMath().run();
		}
		return;
	}

	const chain = editor.chain().focus();

	if (editor.isActive("inlineMath")) {
		chain.updateInlineMath({ latex }).run();
		return;
	}

	chain.insertInlineMath({ latex }).run();
}

function setBlockMath(editor: Editor) {
	const currentLatex = getCurrentLatex(editor, "blockMath");
	const latex = promptMathLatex("Equation", currentLatex || "E = mc^2");

	if (latex === null) {
		return;
	}

	if (!latex) {
		if (editor.isActive("blockMath")) {
			editor.chain().focus().deleteBlockMath().run();
		}
		return;
	}

	const chain = editor.chain().focus();

	if (editor.isActive("blockMath")) {
		chain.updateBlockMath({ latex }).run();
		return;
	}

	chain.insertBlockMath({ latex }).run();
}

function promptMathLatex(label: string, currentLatex: string) {
	const latex = globalThis.prompt(`${label} LaTeX`, currentLatex);

	if (latex === null) {
		return null;
	}

	return latex.trim();
}

function getCurrentLatex(editor: Editor, nodeName: "blockMath" | "inlineMath") {
	const latex = editor.getAttributes(nodeName).latex;

	return typeof latex === "string" ? latex : "";
}
