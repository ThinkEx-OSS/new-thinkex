import type { Editor } from "@tiptap/react";
import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	use,
	useEffect,
	useState,
} from "react";

import { TooltipProvider } from "#/components/ui/tooltip";
import { DocumentToolbar } from "#/features/workspaces/components/document-editor/DocumentToolbar";

interface WorkspaceItemToolbarRegistration {
	editor: Editor | null;
	itemId: string;
}

interface WorkspaceItemToolbarContextValue {
	registration: WorkspaceItemToolbarRegistration | null;
	setRegistration: Dispatch<
		SetStateAction<WorkspaceItemToolbarRegistration | null>
	>;
}

const WorkspaceItemToolbarContext =
	createContext<WorkspaceItemToolbarContextValue | null>(null);

export function WorkspaceItemToolbarProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [registration, setRegistration] =
		useState<WorkspaceItemToolbarRegistration | null>(null);

	return (
		<WorkspaceItemToolbarContext value={{ registration, setRegistration }}>
			{children}
		</WorkspaceItemToolbarContext>
	);
}

export function useDocumentEditorToolbar(
	itemId: string,
	editor: Editor | null,
) {
	const context = use(WorkspaceItemToolbarContext);
	const setRegistration = context?.setRegistration;

	useEffect(() => {
		if (!setRegistration) {
			return;
		}

		const registration = { editor, itemId };
		setRegistration(registration);

		return () => {
			setRegistration((current) => (current === registration ? null : current));
		};
	}, [editor, itemId, setRegistration]);
}

export function WorkspaceItemToolbarSlot({
	activeItemId,
}: {
	activeItemId?: string;
}) {
	const context = use(WorkspaceItemToolbarContext);
	const registration = context?.registration;

	if (!activeItemId || registration?.itemId !== activeItemId) {
		return null;
	}

	return (
		<div className="flex min-w-0 shrink-0 items-center overflow-hidden">
			<TooltipProvider>
				<DocumentToolbar editor={registration.editor} />
			</TooltipProvider>
		</div>
	);
}
