import { useEffect, useId, useMemo, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import type { DeleteWorkspaceItemMode } from "#/features/workspaces/contracts";
import {
	getWorkspaceChildren,
	getWorkspaceDescendantIds,
} from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { useDeleteWorkspaceItemMutation } from "#/features/workspaces/use-delete-workspace-item";
import { useUpdateWorkspaceItemMutation } from "#/features/workspaces/use-update-workspace-item";

export function RenameWorkspaceItemDialog({
	item,
	onOpenChange,
}: {
	item: WorkspaceItem | null;
	onOpenChange: (open: boolean) => void;
}) {
	const nameInputId = useId();
	const updateWorkspaceItemMutation = useUpdateWorkspaceItemMutation();
	const [name, setName] = useState(item?.name ?? "");

	useEffect(() => {
		if (item) {
			setName(item.name);
		}
	}, [item]);

	const trimmedName = name.trim();

	return (
		<Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
			<DialogContent>
				<form
					className="grid gap-6"
					onSubmit={(event) => {
						event.preventDefault();

						if (!item || !trimmedName) {
							return;
						}

						if (trimmedName !== item.name) {
							updateWorkspaceItemMutation.mutate({
								workspaceId: item.workspaceId,
								itemId: item.id,
								name: trimmedName,
								item,
							});
						}

						onOpenChange(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Rename item</DialogTitle>
						<DialogDescription>
							Update the item name shown in this workspace.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameInputId}>Name</FieldLabel>
							<Input
								id={nameInputId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoFocus
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!trimmedName}>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function DeleteWorkspaceItemAlert({
	open,
	item,
	items,
	onOpenChange,
	onClosed,
}: {
	open: boolean;
	item: WorkspaceItem | null;
	items: WorkspaceItem[];
	onOpenChange: (open: boolean) => void;
	onClosed: () => void;
}) {
	const folderOnlyId = useId();
	const folderAndContentsId = useId();
	const deleteWorkspaceItemMutation = useDeleteWorkspaceItemMutation();
	const [deleteMode, setDeleteMode] = useState<
		DeleteWorkspaceItemMode | undefined
	>();
	const directChildren = useMemo(
		() => (item ? getWorkspaceChildren(items, item.id) : []),
		[item, items],
	);
	const descendantIds = useMemo(
		() => (item ? getWorkspaceDescendantIds(items, item.id) : []),
		[item, items],
	);
	const isFolderWithChildren =
		item?.type === "folder" && directChildren.length > 0;
	const deleteEverythingCount = descendantIds.length + 1;

	useEffect(() => {
		if (item) {
			setDeleteMode(undefined);
		}
	}, [item]);

	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
			onOpenChangeComplete={(nextOpen) => {
				if (!nextOpen) {
					onClosed();
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete {item?.type === "folder" ? "folder" : "item"}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This cannot be undone.
						{item ? ` "${item.name}" will be removed from the workspace.` : ""}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{isFolderWithChildren ? (
					<FieldSet>
						<FieldLegend>Folder contents</FieldLegend>
						<RadioGroup
							value={deleteMode ?? ""}
							onValueChange={(value) =>
								setDeleteMode(value as DeleteWorkspaceItemMode)
							}
						>
							<Field orientation="horizontal">
								<RadioGroupItem id={folderOnlyId} value="folder-only" />
								<FieldContent>
									<FieldLabel htmlFor={folderOnlyId}>
										Delete folder only
									</FieldLabel>
									<FieldDescription>
										Keep {directChildren.length} direct{" "}
										{directChildren.length === 1 ? "item" : "items"} and move{" "}
										{directChildren.length === 1 ? "it" : "them"} up one level.
									</FieldDescription>
								</FieldContent>
							</Field>
							<Field orientation="horizontal">
								<RadioGroupItem
									id={folderAndContentsId}
									value="folder-and-contents"
								/>
								<FieldContent>
									<FieldLabel htmlFor={folderAndContentsId}>
										Delete folder and contents
									</FieldLabel>
									<FieldDescription>
										Delete {deleteEverythingCount} total{" "}
										{deleteEverythingCount === 1 ? "item" : "items"}, including
										nested contents.
									</FieldDescription>
								</FieldContent>
							</Field>
						</RadioGroup>
					</FieldSet>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={isFolderWithChildren && !deleteMode}
						onClick={() => {
							if (!item) {
								return;
							}

							if (isFolderWithChildren && !deleteMode) {
								return;
							}

							const mode = isFolderWithChildren ? deleteMode : undefined;
							const now = new Date().toISOString();

							deleteWorkspaceItemMutation.mutate({
								workspaceId: item.workspaceId,
								itemId: item.id,
								mode,
								optimisticDeletedItemIds:
									mode === "folder-and-contents"
										? [item.id, ...descendantIds]
										: [item.id],
								optimisticReparentedItems:
									mode === "folder-only"
										? directChildren.map((child) => ({
												...child,
												parentId: item.parentId,
												updatedAt: now,
											}))
										: [],
							});
							onOpenChange(false);
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
