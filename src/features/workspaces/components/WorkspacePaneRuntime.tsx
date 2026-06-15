import {
	type Hotkey,
	type HotkeyCallback,
	type UseHotkeyOptions,
	useHotkey,
} from "@tanstack/react-hotkeys";
import { createContext, type ReactNode, use, useMemo } from "react";

type WorkspacePaneRuntimeValue = {
	isActive: boolean;
};

type WorkspacePaneHotkeyOptions = UseHotkeyOptions & {
	ignoreEditableTargets?: boolean;
};

const WorkspacePaneRuntimeContext =
	createContext<WorkspacePaneRuntimeValue | null>(null);

function WorkspacePaneRuntimeProvider({
	children,
	isActive,
}: {
	children: ReactNode;
	isActive: boolean;
}) {
	const value = useMemo(
		() => ({
			isActive,
		}),
		[isActive],
	);

	return (
		<WorkspacePaneRuntimeContext value={value}>
			{children}
		</WorkspacePaneRuntimeContext>
	);
}

function useWorkspacePaneRuntime() {
	return use(WorkspacePaneRuntimeContext);
}

function useWorkspacePaneHotkey(
	hotkey: Hotkey,
	callback: HotkeyCallback,
	options?: WorkspacePaneHotkeyOptions,
) {
	const runtime = useWorkspacePaneRuntime();
	const isActive = runtime?.isActive ?? true;
	const {
		enabled = true,
		ignoreEditableTargets = true,
		...hotkeyOptions
	} = options ?? {};

	useHotkey(
		hotkey,
		(event, context) => {
			if (!isActive) {
				return;
			}

			if (ignoreEditableTargets && isEditableEventTarget(event.target)) {
				return;
			}

			callback(event, context);
		},
		{
			...hotkeyOptions,
			enabled: isActive && enabled,
		},
	);
}

function isEditableEventTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) {
		return false;
	}

	return Boolean(
		target.closest(
			"input, textarea, select, [contenteditable=''], [contenteditable='true']",
		),
	);
}

export { useWorkspacePaneHotkey, WorkspacePaneRuntimeProvider };
