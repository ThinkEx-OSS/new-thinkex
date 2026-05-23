export { default as CreateWorkspaceCard } from "./components/CreateWorkspaceCard";
export { default as WorkspaceCard } from "./components/WorkspaceCard";
export { WorkspaceShell } from "./components/WorkspaceLayout";
export { listMockWorkspaceItems } from "./data/mock-workspace-items";
export { listMockWorkspaces } from "./data/mock-workspaces";
export {
	getWorkspaceTabSearch,
	WORKSPACE_ROOT_VIEW,
} from "./model/tabs";
export type { WorkspaceItem } from "./model/types";
export { useWorkspaceTabsStore } from "./state/workspace-tabs-store";
export {
	useWorkspaceUiStore,
	type WorkspacePane,
	type WorkspacePresentation,
} from "./state/workspace-ui-store";
