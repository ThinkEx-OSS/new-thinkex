import { FilePlus2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	workspaceContextMenuRenderer,
	workspaceDropdownMenuRenderer,
} from "#/features/workspaces/components/WorkspaceMenuRenderers";
import type { WorkspaceMenuRenderer } from "#/features/workspaces/components/workspace-menu-actions";
import { renderWorkspaceMenuActions } from "#/features/workspaces/components/workspace-menu-actions";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import {
	workspaceItemAcquisitionActions,
	workspaceItemLearnCreateActions,
	workspaceItemPrimaryCreateActions,
} from "#/features/workspaces/model/item-display";

interface WorkspaceCreateMenuProps {
	parentId: string | null;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
}

export default function WorkspaceCreateMenu({
	parentId,
	onCreateItem,
}: WorkspaceCreateMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						type="button"
						className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
					/>
				}
			>
				<FilePlus2 className="size-3.5" />
				<span className="hidden sm:inline">New</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<WorkspaceCreateMenuContent
					parentId={parentId}
					onCreateItem={onCreateItem}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function WorkspaceCreateMenuContent({
	parentId,
	onCreateItem,
	renderer = workspaceDropdownMenuRenderer,
}: WorkspaceCreateMenuProps & {
	renderer?: WorkspaceMenuRenderer;
}) {
	return renderWorkspaceMenuActions(
		getWorkspaceCreateMenuActions({ parentId, onCreateItem }),
		renderer,
	);
}

export function WorkspaceCreateContextMenuContent(
	props: WorkspaceCreateMenuProps,
) {
	return (
		<WorkspaceCreateMenuContent
			{...props}
			renderer={workspaceContextMenuRenderer}
		/>
	);
}

function getWorkspaceCreateMenuActions({
	parentId,
	onCreateItem,
}: WorkspaceCreateMenuProps) {
	return [
		...workspaceItemPrimaryCreateActions.map(
			({ type, label, description, Icon, iconClassName }) => ({
				kind: "item" as const,
				id: type,
				label,
				trailing: description,
				leading: <Icon className={`size-4 ${iconClassName}`} />,
				onSelect: () => onCreateItem({ type, parentId }),
			}),
		),
		...workspaceItemAcquisitionActions.map(
			({ id, label, description, Icon, iconClassName, disabled }) => ({
				kind: "item" as const,
				id,
				label,
				trailing: description,
				disabled,
				leading: <Icon className={`size-4 ${iconClassName}`} />,
			}),
		),
		{ kind: "separator" as const, id: "learn-separator" },
		...workspaceItemLearnCreateActions.map(
			({ type, label, Icon, iconClassName }) => ({
				kind: "item" as const,
				id: type,
				label,
				leading: <Icon className={`size-4 ${iconClassName}`} />,
				onSelect: () => onCreateItem({ type, parentId }),
			}),
		),
	];
}
