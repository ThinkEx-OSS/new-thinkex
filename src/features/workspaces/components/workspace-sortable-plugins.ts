import { Feedback } from "@dnd-kit/dom";
import type { UseSortableInput } from "@dnd-kit/react/sortable";
import type { WorkspaceDragData } from "#/features/workspaces/model/drag";

type WorkspaceSortablePlugins = NonNullable<
	UseSortableInput<WorkspaceDragData>["plugins"]
>;
type WorkspaceSortablePluginResolver = Exclude<
	WorkspaceSortablePlugins,
	readonly unknown[]
>;

export const workspaceControlledSortablePlugins: WorkspaceSortablePluginResolver =
	(defaults) => defaults;

export const workspaceItemSortablePlugins: WorkspaceSortablePluginResolver = (
	defaults,
) => [
	...workspaceControlledSortablePlugins(defaults),
	Feedback.configure({ feedback: "clone", dropAnimation: null }),
];
