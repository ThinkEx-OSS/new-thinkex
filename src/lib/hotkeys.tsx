import {
	formatForDisplay,
	HotkeysProvider,
	type Hotkey,
	type HotkeyCallback,
	type HotkeySequence,
	type HotkeysProviderOptions,
	type UseHotkeyOptions,
	type UseHotkeySequenceOptions,
	useHotkey,
	useHotkeySequence,
} from "@tanstack/react-hotkeys";
import type { ReactNode } from "react";

type AppHotkeyAction =
	| "sidebar.toggle"
	| "workspace.aiChat.toggle"
	| "workspace.search.open";

type AppHotkeyDefinition = {
	hotkey: Hotkey;
	description: string;
	scope: "global" | "workspace";
};

const APP_HOTKEYS = {
	"sidebar.toggle": {
		hotkey: "Mod+B",
		description: "Toggle sidebar",
		scope: "global",
	},
	"workspace.aiChat.toggle": {
		hotkey: "Mod+J",
		description: "Toggle AI chat",
		scope: "workspace",
	},
	"workspace.search.open": {
		hotkey: "Mod+K",
		description: "Search workspace",
		scope: "workspace",
	},
} as const satisfies Record<AppHotkeyAction, AppHotkeyDefinition>;

const RESERVED_BROWSER_HOTKEYS = [
	"Mod+W",
	"Mod+Shift+W",
	"Mod+T",
	"Mod+N",
	"Mod+L",
	"Mod+R",
	"Mod+Q",
	"Mod+F",
	"Mod+P",
	"Mod+1",
	"Mod+2",
	"Mod+3",
	"Mod+4",
	"Mod+5",
	"Mod+6",
	"Mod+7",
	"Mod+8",
	"Mod+9",
] as const satisfies readonly Hotkey[];

const RESERVED_BROWSER_HOTKEY_SET = new Set<Hotkey>(RESERVED_BROWSER_HOTKEYS);

const APP_HOTKEY_DEFAULT_OPTIONS = {
	hotkey: {
		conflictBehavior: "warn",
		eventType: "keydown",
		preventDefault: true,
		stopPropagation: true,
	},
	hotkeySequence: {
		conflictBehavior: "warn",
	},
} as const satisfies HotkeysProviderOptions;

function AppHotkeysProvider({ children }: { children: ReactNode }) {
	return (
		<HotkeysProvider defaultOptions={APP_HOTKEY_DEFAULT_OPTIONS}>
			{children}
		</HotkeysProvider>
	);
}

function useAppHotkey(
	action: AppHotkeyAction,
	callback: HotkeyCallback,
	options?: UseHotkeyOptions,
) {
	useHotkey(APP_HOTKEYS[action].hotkey, callback, options);
}

function useAppHotkeySequence(
	sequence: HotkeySequence,
	callback: HotkeyCallback,
	options?: UseHotkeySequenceOptions,
) {
	useHotkeySequence(sequence, callback, options);
}

function getAppHotkey(action: AppHotkeyAction) {
	return APP_HOTKEYS[action];
}

function formatAppHotkey(hotkey: Hotkey) {
	return formatForDisplay(hotkey);
}

function isReservedBrowserHotkey(hotkey: Hotkey) {
	return RESERVED_BROWSER_HOTKEY_SET.has(hotkey);
}

export {
	APP_HOTKEYS,
	AppHotkeysProvider,
	RESERVED_BROWSER_HOTKEYS,
	formatAppHotkey,
	getAppHotkey,
	isReservedBrowserHotkey,
	useAppHotkey,
	useAppHotkeySequence,
};
export type { AppHotkeyAction, AppHotkeyDefinition };
