import { useId, useMemo, useState } from "react";

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
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { getWorkspaceDescendantIds } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	useDeleteWorkspaceItemMutation,
	useRenameWorkspaceItemMutation,
} from "#/features/workspaces/use-workspace-kernel-items";

export function RenameWorkspaceItemDialog({
	item,
	onOpenChange,
}: {
	item: WorkspaceItem | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
			{item ? (
				<RenameWorkspaceItemDialogContent
					key={item.id}
					item={item}
					onOpenChange={onOpenChange}
				/>
			) : null}
		</Dialog>
	);
}

function RenameWorkspaceItemDialogContent({
	item,
	onOpenChange,
}: {
	item: WorkspaceItem;
	onOpenChange: (open: boolean) => void;
}) {
	const nameInputId = useId();
	const renameWorkspaceItemMutation = useRenameWorkspaceItemMutation();
	const [name, setName] = useState(item.name);
	const trimmedName = name.trim();

	return (
		<DialogContent>
			<form
				className="grid gap-6"
				onSubmit={(event) => {
					event.preventDefault();

					if (!trimmedName) {
						return;
					}

					if (trimmedName !== item.name) {
						renameWorkspaceItemMutation.mutate({
							workspaceId: item.workspaceId,
							itemId: item.id,
							name: trimmedName,
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
					<Button
						type="submit"
						disabled={!trimmedName || renameWorkspaceItemMutation.isPending}
					>
						Save
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
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
	const deleteWorkspaceItemMutation = useDeleteWorkspaceItemMutation();
	const descendantCount = useMemo(
		() => (item ? getWorkspaceDescendantIds(items, item.id).length : 0),
		[item, items],
	);
	const isFolderWithChildren = item?.type === "folder" && descendantCount > 0;

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
						{isFolderWithChildren
							? ` This also deletes ${descendantCount} nested ${
									descendantCount === 1 ? "item" : "items"
								}.`
							: ""}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={deleteWorkspaceItemMutation.isPending}
						onClick={() => {
							if (!item) {
								return;
							}

							deleteWorkspaceItemMutation.mutate({
								workspaceId: item.workspaceId,
								itemId: item.id,
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
