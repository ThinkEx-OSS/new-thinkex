import { ChevronDown, Search, Trash2 } from "lucide-react";
import {
	type Dispatch,
	type ReactElement,
	type SetStateAction,
	useId,
	useState,
} from "react";

import { Button } from "#/components/ui/button";
import { ColorSwatchPicker } from "#/components/ui/color-swatch-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldTitle } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import type {
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	filterWorkspaceIconOptions,
	workspaceColorOptions,
	workspaceColors,
	workspaceIconOptions,
} from "#/features/workspaces/model/display";
import { useDeleteWorkspaceMutation } from "#/features/workspaces/use-delete-workspace";
import { useUpdateWorkspaceMutation } from "#/features/workspaces/use-update-workspace";
import type { WorkspaceMemberCapabilities } from "#/features/workspaces/workspace-member-capabilities";
import { cn } from "#/lib/utils";

interface WorkspaceSettingsDialogProps {
	workspace: WorkspaceSummary;
	trigger: ReactElement;
	capabilities: WorkspaceMemberCapabilities;
}

interface WorkspaceSettingsDraft {
	name: string;
	icon: WorkspaceIcon;
	color: WorkspaceColor;
}

const getWorkspaceSettingsDraft = (
	workspace: WorkspaceSummary,
): WorkspaceSettingsDraft => ({
	name: workspace.name,
	icon: workspace.icon ?? "compass",
	color: workspace.color ?? "sky",
});

export default function WorkspaceSettingsDialog({
	workspace,
	trigger,
	capabilities,
}: WorkspaceSettingsDialogProps) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(() =>
		getWorkspaceSettingsDraft(workspace),
	);
	const deleteWorkspaceMutation = useDeleteWorkspaceMutation();

	if (!capabilities.canMutateContent) {
		return null;
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (deleteWorkspaceMutation.isPending) {
			return;
		}

		if (nextOpen) {
			setDraft(getWorkspaceSettingsDraft(workspace));
			deleteWorkspaceMutation.reset();
		}

		setOpen(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger render={trigger} />
			<WorkspaceSettingsDialogContent
				canDelete={capabilities.canDeleteWorkspace}
				deleteWorkspaceMutation={deleteWorkspaceMutation}
				draft={draft}
				setDraft={setDraft}
				workspace={workspace}
				onOpenChange={handleOpenChange}
			/>
		</Dialog>
	);
}

function WorkspaceSettingsDialogContent({
	canDelete,
	deleteWorkspaceMutation,
	draft,
	setDraft,
	workspace,
	onOpenChange,
}: {
	canDelete: boolean;
	deleteWorkspaceMutation: ReturnType<typeof useDeleteWorkspaceMutation>;
	draft: WorkspaceSettingsDraft;
	setDraft: Dispatch<SetStateAction<WorkspaceSettingsDraft>>;
	workspace: WorkspaceSummary;
	onOpenChange: (open: boolean) => void;
}) {
	const nameInputId = useId();
	const [iconPickerOpen, setIconPickerOpen] = useState(false);
	const [colorPickerOpen, setColorPickerOpen] = useState(false);
	const updateWorkspaceMutation = useUpdateWorkspaceMutation();
	const workspaceDraft = getWorkspaceSettingsDraft(workspace);
	const normalizedName = draft.name.trim();
	const canSave =
		normalizedName.length > 0 &&
		!updateWorkspaceMutation.isPending &&
		(normalizedName !== workspace.name ||
			draft.icon !== workspaceDraft.icon ||
			draft.color !== workspaceDraft.color);
	const updateError =
		updateWorkspaceMutation.error instanceof Error
			? updateWorkspaceMutation.error.message
			: null;
	const deleteError =
		deleteWorkspaceMutation.error instanceof Error
			? deleteWorkspaceMutation.error.message
			: null;

	const handleSave = () => {
		if (!canSave) {
			return;
		}

		onOpenChange(false);
		updateWorkspaceMutation.mutate({
			workspaceId: workspace.id,
			name: normalizedName,
			icon: draft.icon,
			color: draft.color,
		});
	};

	return (
		<DialogContent
			className="sm:max-w-lg"
			showCloseButton={!deleteWorkspaceMutation.isPending}
		>
			<DialogHeader>
				<DialogTitle>Workspace settings</DialogTitle>
				<DialogDescription>
					Update this workspace's name, icon, and color.
				</DialogDescription>
			</DialogHeader>

			<FieldGroup className="gap-5">
				<Field>
					<Label htmlFor={nameInputId}>Name</Label>
					<Input
						id={nameInputId}
						value={draft.name}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								name: event.target.value,
							}))
						}
						maxLength={120}
						aria-invalid={normalizedName.length === 0}
					/>
				</Field>

				<div className="grid gap-3 sm:grid-cols-2">
					<Field>
						<FieldTitle>Icon</FieldTitle>
						<WorkspaceIconDropdown
							open={iconPickerOpen}
							value={draft.icon}
							onOpenChange={setIconPickerOpen}
							onValueChange={(icon) => {
								setDraft((current) => ({ ...current, icon }));
								setIconPickerOpen(false);
							}}
						/>
					</Field>

					<Field>
						<FieldTitle>Color</FieldTitle>
						<WorkspaceColorDropdown
							open={colorPickerOpen}
							value={draft.color}
							onOpenChange={setColorPickerOpen}
							onValueChange={(color) => {
								setDraft((current) => ({ ...current, color }));
								setColorPickerOpen(false);
							}}
						/>
					</Field>
				</div>

				{updateError ? (
					<p className="text-destructive text-sm">{updateError}</p>
				) : null}
			</FieldGroup>

			<DialogFooter className="items-center sm:justify-between">
				{canDelete ? (
					<DeleteWorkspaceButton
						disabled={deleteWorkspaceMutation.isPending}
						errorMessage={deleteError}
						onResetError={() => deleteWorkspaceMutation.reset()}
						onDelete={() =>
							deleteWorkspaceMutation.mutate({
								workspaceId: workspace.id,
								confirmationName: workspace.name,
							})
						}
					/>
				) : (
					<div />
				)}
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						type="button"
						variant="outline"
						disabled={deleteWorkspaceMutation.isPending}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={!canSave || deleteWorkspaceMutation.isPending}
						onClick={handleSave}
					>
						Save
					</Button>
				</div>
			</DialogFooter>
		</DialogContent>
	);
}

function WorkspaceIconDropdown({
	open,
	value,
	onOpenChange,
	onValueChange,
}: {
	open: boolean;
	value: WorkspaceIcon;
	onOpenChange: (open: boolean) => void;
	onValueChange: (value: WorkspaceIcon) => void;
}) {
	const searchInputId = useId();
	const [query, setQuery] = useState("");
	const selectedIcon = workspaceIconOptions.find(
		(option) => option.value === value,
	);
	const SelectedIcon = selectedIcon?.Icon ?? workspaceIconOptions[0].Icon;
	const filteredIconOptions = filterWorkspaceIconOptions(query);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setQuery("");
		}

		onOpenChange(nextOpen);
	};

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="outline"
						className="w-full justify-between"
					>
						<span className="flex min-w-0 items-center gap-2">
							<SelectedIcon className="size-4" aria-hidden="true" />
							<span className="truncate">{selectedIcon?.label ?? "Icon"}</span>
						</span>
						<ChevronDown className="size-4 text-muted-foreground" />
					</Button>
				}
			/>
			<DropdownMenuContent align="start" className="w-80 p-2">
				<div className="relative">
					<Search
						className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						id={searchInputId}
						value={query}
						aria-label="Search icons"
						placeholder="Search icons"
						className="h-9 pl-8"
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => event.stopPropagation()}
					/>
				</div>
				{filteredIconOptions.length > 0 ? (
					<div className="mt-2 grid max-h-72 grid-cols-7 gap-1.5 overflow-y-auto pr-1">
						{filteredIconOptions.map(
							({ value: optionValue, label, Icon, aliases }) => (
								<button
									key={optionValue}
									type="button"
									className={cn(
										"flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
										value === optionValue
											? "bg-muted text-foreground"
											: "text-muted-foreground",
									)}
									aria-label={`${label}. ${aliases.join(", ")}`}
									aria-pressed={value === optionValue}
									onClick={() => onValueChange(optionValue)}
								>
									<Icon className="size-5" aria-hidden="true" />
								</button>
							),
						)}
					</div>
				) : (
					<p className="px-2 py-6 text-center text-muted-foreground text-sm">
						No icons found.
					</p>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function WorkspaceColorDropdown({
	open,
	value,
	onOpenChange,
	onValueChange,
}: {
	open: boolean;
	value: WorkspaceColor;
	onOpenChange: (open: boolean) => void;
	onValueChange: (value: WorkspaceColor) => void;
}) {
	const selectedColor = workspaceColors[value];

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="outline"
						className="w-full justify-between"
					>
						<span className="flex min-w-0 items-center gap-2">
							<span
								className={cn(
									"size-4 rounded-[4px]",
									selectedColor?.swatchClassName ??
										workspaceColors.sky.swatchClassName,
								)}
								aria-hidden="true"
							/>
							<span className="truncate">
								{selectedColor?.label ?? "Color"}
							</span>
						</span>
						<ChevronDown className="size-4 text-muted-foreground" />
					</Button>
				}
			/>
			<DropdownMenuContent
				align="end"
				className="max-w-[calc(100vw-2rem)] w-fit overflow-x-auto p-2"
			>
				<ColorSwatchPicker
					aria-label="Workspace color"
					value={value}
					options={workspaceColorOptions.map((option) => ({
						value: option.value,
						label: option.label,
						swatchClassName: option.swatchClassName,
						checkClassName:
							"checkClassName" in option ? option.checkClassName : undefined,
					}))}
					onValueChange={onValueChange}
					showLabels={false}
					className="grid-flow-col grid-rows-4 gap-1.5"
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DeleteWorkspaceButton({
	disabled,
	errorMessage,
	onResetError,
	onDelete,
}: {
	disabled: boolean;
	errorMessage: string | null;
	onResetError: () => void;
	onDelete: () => void;
}) {
	const [isConfirming, setIsConfirming] = useState(false);

	const beginConfirm = () => {
		onResetError();
		setIsConfirming(true);
	};

	const cancelConfirm = () => {
		if (disabled) {
			return;
		}

		onResetError();
		setIsConfirming(false);
	};

	return (
		<div className="flex flex-col gap-2">
			{errorMessage ? (
				<p className="text-destructive text-sm">{errorMessage}</p>
			) : null}
			{isConfirming ? (
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={disabled}
						onClick={cancelConfirm}
					>
						Keep workspace
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={disabled}
						onClick={onDelete}
					>
						<Trash2 className="size-4" />
						Delete workspace
					</Button>
				</div>
			) : (
				<Button type="button" variant="destructive" onClick={beginConfirm}>
					<Trash2 className="size-4" />
					Delete workspace
				</Button>
			)}
		</div>
	);
}
