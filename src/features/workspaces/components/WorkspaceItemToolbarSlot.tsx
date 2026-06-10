import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

interface WorkspaceItemToolbarRegistration {
	itemId: string;
	toolbar: ReactNode;
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
	const value = useMemo(
		() => ({ registration, setRegistration }),
		[registration],
	);

	return (
		<WorkspaceItemToolbarContext value={value}>
			{children}
		</WorkspaceItemToolbarContext>
	);
}

export function useWorkspaceItemToolbar(itemId: string, toolbar: ReactNode) {
	const context = useContext(WorkspaceItemToolbarContext);
	const setRegistration = context?.setRegistration;

	useEffect(() => {
		if (!setRegistration) {
			return;
		}

		const registration = { itemId, toolbar };
		setRegistration(registration);

		return () => {
			setRegistration((current) => (current === registration ? null : current));
		};
	}, [itemId, setRegistration, toolbar]);
}

export function WorkspaceItemToolbarSlot({
	activeItemId,
}: {
	activeItemId?: string;
}) {
	const context = useContext(WorkspaceItemToolbarContext);
	const registration = context?.registration;

	if (!activeItemId || registration?.itemId !== activeItemId) {
		return null;
	}

	return (
		<div className="flex min-w-0 shrink-0 items-center overflow-hidden">
			{registration.toolbar}
		</div>
	);
}
