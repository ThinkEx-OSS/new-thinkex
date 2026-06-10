import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { TooltipProvider } from "#/components/ui/tooltip";
import { DocumentToolbar } from "#/features/workspaces/components/document-editor/DocumentToolbar";
import { DocumentWordCount } from "#/features/workspaces/components/document-editor/DocumentWordCount";
import { useWorkspaceItemToolbar } from "#/features/workspaces/components/WorkspaceItemToolbarSlot";
import {
	getTiptapDocumentBaseExtensions,
	tiptapDocumentYjsField,
} from "#/features/workspaces/documents/tiptap-extensions";
import {
	type DocumentCollaborationSession,
	useDocumentCollaborationSession,
} from "#/features/workspaces/documents/use-document-collaboration-session";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { authClient } from "#/lib/auth-client";

export function DocumentEditorSurface({
	item,
	workspaceId,
}: {
	item: WorkspaceItem;
	workspaceId: string;
}) {
	const sessionQuery = authClient.useSession();
	const collaborationUser = useMemo(() => {
		if (!sessionQuery.data?.user) {
			return null;
		}

		return {
			id: sessionQuery.data.user.id,
			image: sessionQuery.data.user.image ?? null,
			name:
				sessionQuery.data.user.name || sessionQuery.data.user.email || "User",
		};
	}, [sessionQuery.data?.user]);
	const collaborationSession = useDocumentCollaborationSession({
		workspaceId,
		itemId: item.id,
		user: collaborationUser,
	});

	if (!collaborationSession) {
		return <DocumentEditorSkeleton />;
	}

	return (
		<DocumentEditorInstance
			collaborationSession={collaborationSession}
			item={item}
		/>
	);
}

function DocumentEditorInstance({
	collaborationSession,
	item,
}: {
	collaborationSession: DocumentCollaborationSession;
	item: WorkspaceItem;
}) {
	const extensions = useMemo(() => {
		const baseExtensions = getTiptapDocumentBaseExtensions();

		return [
			...baseExtensions,
			Collaboration.configure({
				document: collaborationSession.ydoc,
				field: tiptapDocumentYjsField,
			}),
			CollaborationCaret.configure({
				provider: collaborationSession.provider,
				user:
					collaborationSession.provider.awareness.getLocalState()?.user ?? {},
				render: renderCollaborationCaret,
				selectionRender: renderCollaborationSelection,
			}),
		];
	}, [collaborationSession.provider, collaborationSession.ydoc]);

	const editor = useEditor({
		immediatelyRender: false,
		enableContentCheck: true,
		onContentError: ({ disableCollaboration }) => {
			disableCollaboration();
		},
		extensions,
		editorProps: {
			attributes: {
				"aria-label": `${item.name} editor`,
				class:
					"workspace-document-prose min-h-[calc(100vh-5.75rem)] p-4 outline-none",
			},
		},
	});
	const toolbar = useMemo(
		() => (
			<TooltipProvider>
				<DocumentToolbar editor={editor} />
			</TooltipProvider>
		),
		[editor],
	);

	useWorkspaceItemToolbar(item.id, toolbar);

	return (
		<section className="relative flex h-[calc(100vh-5.75rem)] min-h-0 flex-col bg-background">
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="w-full pb-8">
					<EditorContent editor={editor} />
				</div>
			</div>
			<DocumentWordCount editor={editor} />
		</section>
	);
}

function renderCollaborationCaret(user: Record<string, unknown>) {
	const color = getCollaborationUserColor(user);
	const cursor = document.createElement("span");
	const label = document.createElement("span");

	cursor.style.borderLeft = `2px solid ${color}`;
	cursor.style.borderRight = `2px solid ${color}`;
	cursor.style.marginLeft = "-1px";
	cursor.style.marginRight = "-1px";
	cursor.style.pointerEvents = "none";
	cursor.style.position = "relative";

	label.textContent = getCollaborationUserName(user);
	label.style.backgroundColor = color;
	label.style.borderRadius = "4px";
	label.style.bottom = "100%";
	label.style.color = "white";
	label.style.fontSize = "11px";
	label.style.fontWeight = "500";
	label.style.left = "-1px";
	label.style.lineHeight = "1";
	label.style.padding = "3px 5px";
	label.style.position = "absolute";
	label.style.whiteSpace = "nowrap";

	cursor.appendChild(label);

	return cursor;
}

function renderCollaborationSelection(user: Record<string, unknown>) {
	return {
		nodeName: "span",
		style: `background-color: ${getCollaborationUserColor(user)}33`,
	};
}

function getCollaborationUserColor(user: Record<string, unknown>) {
	return typeof user.color === "string" ? user.color : "#2563eb";
}

function getCollaborationUserName(user: Record<string, unknown>) {
	return typeof user.name === "string" && user.name.trim() ? user.name : "User";
}

function DocumentEditorSkeleton() {
	return (
		<section className="flex h-[calc(100vh-5.75rem)] min-h-0 flex-col bg-background">
			<div className="min-h-0 flex-1 overflow-hidden p-4">
				<div className="max-w-3xl space-y-5">
					<Skeleton className="h-8 w-2/3 rounded-sm bg-muted/55" />
					<div className="space-y-2.5">
						<Skeleton className="h-4 w-full rounded-sm bg-muted/45" />
						<Skeleton className="h-4 w-11/12 rounded-sm bg-muted/45" />
						<Skeleton className="h-4 w-4/5 rounded-sm bg-muted/45" />
					</div>
					<div className="space-y-2.5">
						<Skeleton className="h-4 w-full rounded-sm bg-muted/45" />
						<Skeleton className="h-4 w-10/12 rounded-sm bg-muted/45" />
						<Skeleton className="h-4 w-7/12 rounded-sm bg-muted/45" />
					</div>
				</div>
			</div>
			<div className="px-4 py-2">
				<Skeleton className="h-3 w-28 rounded-sm bg-muted/45" />
			</div>
		</section>
	);
}
