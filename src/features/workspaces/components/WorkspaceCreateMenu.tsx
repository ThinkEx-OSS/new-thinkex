import { FilePlus2 } from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useWorkspaceFileUpload } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import {
	workspaceContextMenuRenderer,
	workspaceDropdownMenuRenderer,
} from "#/features/workspaces/components/WorkspaceMenuRenderers";
import { WorkspaceToolbarTextButton } from "#/features/workspaces/components/WorkspaceToolbar";
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
			<DropdownMenuTrigger render={<WorkspaceToolbarTextButton />}>
				<FilePlus2 />
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
	const { requestFileUpload } = useWorkspaceFileUpload();

	return renderWorkspaceMenuActions(
		getWorkspaceCreateMenuActions({
			parentId,
			onCreateItem,
			onUploadFile: requestFileUpload,
		}),
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
	onUploadFile,
}: WorkspaceCreateMenuProps & {
	onUploadFile: (parentId: string | null) => void;
}) {
	return [
		...workspaceItemPrimaryCreateActions.map(
			({ type, label, Icon, iconClassName }) => ({
				kind: "item" as const,
				id: type,
				label,
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
				onSelect:
					id === "upload-file" ? () => onUploadFile(parentId) : undefined,
			}),
		),
		...workspaceItemLearnCreateActions.map(
			({ type, label, Icon, iconClassName }) => ({
				kind: "item" as const,
				id: type,
				label,
				trailing: "Soon",
				disabled: true,
				leading: <Icon className={`size-4 ${iconClassName}`} />,
				onSelect: () => onCreateItem({ type, parentId }),
			}),
		),
	];
}
