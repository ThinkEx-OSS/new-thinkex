import type {
	WorkspaceAiContextPaneReference,
	WorkspaceAiContextPresentationReference,
	WorkspaceAiContextTabReference,
} from "./workspace-ai-context-types";
import {
	isWorkspaceAiContextMarkedItem,
	isWorkspaceAiContextSnapshot,
	isWorkspaceAiContextTabReference,
} from "./workspace-ai-context-validation";

export function formatWorkspaceAiContextForPrompt(value: unknown) {
	if (!isWorkspaceAiContextSnapshot(value)) {
		return "";
	}

	const lines = [
		"Workspace AI context for this turn:",
		"- This is metadata only. Item content is not included unless fetched with tools.",
	];
	const markedItems = value.markedItems.filter(isWorkspaceAiContextMarkedItem);
	const openTabs = value.openTabs.filter(isWorkspaceAiContextTabReference);

	if (markedItems.length > 0) {
		lines.push("- Items explicitly marked for AI context:");
		for (const item of markedItems) {
			const state = [
				item.state.activeVisible ? "active visible" : "",
				item.state.openInTabs.length > 0
					? `open in ${item.state.openInTabs.join(", ")}`
					: "",
			]
				.filter(Boolean)
				.join("; ");
			lines.push(
				`  ${item.order}. ${item.path} (${item.type}${state ? `; ${state}` : ""})`,
			);
		}
	} else {
		lines.push("- No items are explicitly marked for AI context.");
	}

	if (openTabs.length > 0) {
		lines.push("- Open tabs:");
		for (const tab of openTabs) {
			lines.push(`  - ${formatWorkspaceAiContextTab(tab)}`);
		}
	}

	lines.push(
		`- Active view: ${formatWorkspaceAiContextPresentation(value.view.presentation)}`,
	);

	return lines.join("\n");
}

function formatWorkspaceAiContextTab(tab: WorkspaceAiContextTabReference) {
	const active = tab.active ? "active, " : "";

	if (tab.view.kind === "workspace-root") {
		return `${tab.title} (${active}workspace root)`;
	}

	if (tab.view.kind === "missing-item") {
		return `${tab.title} (${active}missing item)`;
	}

	return `${tab.title} (${active}${tab.view.item.path})`;
}

function formatWorkspaceAiContextPresentation(
	presentation: WorkspaceAiContextPresentationReference,
) {
	if (presentation.mode === "standard") {
		return `standard${presentation.activePane ? `, ${formatWorkspaceAiContextPane(presentation.activePane)}` : ""}`;
	}

	if (presentation.mode === "maximized") {
		return `maximized, ${formatWorkspaceAiContextPane(presentation.activePane)}`;
	}

	const activePane = presentation.activePane
		? formatWorkspaceAiContextPane(presentation.activePane)
		: "unknown active pane";

	return `split ${presentation.direction}, active ${activePane}`;
}

function formatWorkspaceAiContextPane(pane: WorkspaceAiContextPaneReference) {
	if (pane.kind === "workspace-root") {
		return "workspace root";
	}

	if (pane.kind === "ai-chat") {
		return "AI chat";
	}

	if (pane.kind === "missing-item") {
		return "missing item";
	}

	return pane.item.path;
}
