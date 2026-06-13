import { Trash2 } from "lucide-react";
import {
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Field, FieldGroup, FieldTitle } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import type {
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	workspaceColorOptions,
	workspaceIconOptions,
} from "#/features/workspaces/model/display";
import { useDeleteWorkspaceMutation } from "#/features/workspaces/use-delete-workspace";
import { useUpdateWorkspaceMutation } from "#/features/workspaces/use-update-workspace";
import { cn } from "#/lib/utils";

interface WorkspaceSettingsDialogProps {
	workspace: WorkspaceSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function WorkspaceSettingsDialog({
	workspace,
	open,
	onOpenChange,
}: WorkspaceSettingsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<WorkspaceSettingsDialogContent
				key={`${workspace.id}:${open ? "open" : "closed"}`}
				workspace={workspace}
				onOpenChange={onOpenChange}
			/>
		</Dialog>
	);
}

function WorkspaceSettingsDialogContent({
	workspace,
	onOpenChange,
}: {
	workspace: WorkspaceSummary;
	onOpenChange: (open: boolean) => void;
}) {
	const nameInputId = useId();
	const updateWorkspaceMutation = useUpdateWorkspaceMutation();
	const deleteWorkspaceMutation = useDeleteWorkspaceMutation();
	const [nameDraft, setNameDraft] = useState<string>();
	const [iconDraft, setIconDraft] = useState<WorkspaceIcon>();
	const [colorDraft, setColorDraft] = useState<WorkspaceColor>();
	const name = nameDraft ?? workspace.name;
	const icon = iconDraft ?? workspace.icon ?? "compass";
	const color = colorDraft ?? workspace.color ?? "sky";
	const normalizedName = name.trim();
	const canSave =
		normalizedName.length > 0 &&
		!updateWorkspaceMutation.isPending &&
		(normalizedName !== workspace.name ||
			icon !== (workspace.icon ?? "compass") ||
			color !== (workspace.color ?? "sky"));
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
			icon,
			color,
		});
	};

	return (
		<DialogContent className="sm:max-w-lg">
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
						value={name}
						onChange={(event) => setNameDraft(event.target.value)}
						maxLength={120}
						aria-invalid={normalizedName.length === 0}
					/>
				</Field>

				<Field>
					<FieldTitle>Icon</FieldTitle>
					<div className="grid grid-cols-4 gap-2">
						{workspaceIconOptions.map(({ value, label, Icon }) => (
							<button
								key={value}
								type="button"
								className={cn(
									"flex h-16 flex-col items-center justify-center gap-1 rounded-md border bg-background text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
									icon === value
										? "border-ring bg-muted text-foreground"
										: "border-border text-muted-foreground",
								)}
								aria-pressed={icon === value}
								onClick={() => setIconDraft(value)}
							>
								<Icon className="size-5" aria-hidden="true" />
								<span>{label}</span>
							</button>
						))}
					</div>
				</Field>

				<Field>
					<FieldTitle>Color</FieldTitle>
					<div className="grid grid-cols-4 gap-2">
						{workspaceColorOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								className={cn(
									"flex h-14 flex-col items-center justify-center gap-1 rounded-md border bg-background text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
									color === option.value
										? "border-ring bg-muted text-foreground"
										: "border-border text-muted-foreground",
								)}
								aria-pressed={color === option.value}
								onClick={() => setColorDraft(option.value)}
							>
								<span
									className={cn("size-4 rounded-full", option.bg)}
									aria-hidden="true"
								/>
								<span>{option.label}</span>
							</button>
						))}
					</div>
				</Field>

				{updateError || deleteError ? (
					<p className="text-destructive text-sm">
						{deleteError ?? updateError}
					</p>
				) : null}
			</FieldGroup>

			<DialogFooter className="items-center sm:justify-between">
				<HoldToDeleteButton
					workspace={workspace}
					disabled={deleteWorkspaceMutation.isPending}
					onDelete={() =>
						deleteWorkspaceMutation.mutate({
							workspaceId: workspace.id,
							confirmationName: workspace.name,
						})
					}
				/>
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button type="button" disabled={!canSave} onClick={handleSave}>
						Save
					</Button>
				</div>
			</DialogFooter>
		</DialogContent>
	);
}

function HoldToDeleteButton({
	workspace,
	disabled,
	onDelete,
}: {
	workspace: WorkspaceSummary;
	disabled: boolean;
	onDelete: () => void;
}) {
	const holdDurationMs = 1400;
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const completedRef = useRef(false);
	const [isHolding, setIsHolding] = useState(false);

	const resetHold = () => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		completedRef.current = false;
		setIsHolding(false);
	};

	const completeHold = () => {
		timeoutRef.current = null;
		completedRef.current = true;
		onDelete();
		setIsHolding(false);
	};

	const beginHold = () => {
		if (timeoutRef.current !== null) {
			return;
		}

		completedRef.current = false;
		setIsHolding(true);
		timeoutRef.current = setTimeout(() => {
			completedRef.current = true;
			completeHold();
		}, holdDurationMs);
	};

	useEffect(
		() => () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		},
		[],
	);

	const startHold = (event: PointerEvent<HTMLButtonElement>) => {
		if (disabled) {
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);
		beginHold();
	};

	const cancelHold = () => {
		if (!completedRef.current) {
			resetHold();
		}
	};

	const startKeyboardHold = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== " " && event.key !== "Enter") {
			return;
		}

		if (disabled || timeoutRef.current !== null) {
			return;
		}

		event.preventDefault();
		beginHold();
	};

	const cancelKeyboardHold = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== " " && event.key !== "Enter") {
			return;
		}

		event.preventDefault();
		cancelHold();
	};

	return (
		<button
			type="button"
			className={cn(
				"relative h-9 overflow-hidden rounded-md border border-destructive/30 px-2.5 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/20 disabled:pointer-events-none disabled:opacity-50",
				isHolding && "bg-destructive/10",
			)}
			disabled={disabled}
			aria-label={`Hold to delete ${workspace.name}`}
			onPointerDown={startHold}
			onPointerUp={cancelHold}
			onPointerCancel={cancelHold}
			onPointerLeave={cancelHold}
			onKeyDown={startKeyboardHold}
			onKeyUp={cancelKeyboardHold}
		>
			<span
				className="absolute inset-y-0 left-0 w-full origin-left bg-destructive/20 transition-transform ease-linear"
				style={{
					transform: isHolding ? "scaleX(1)" : "scaleX(0)",
					transitionDuration: `${holdDurationMs}ms`,
				}}
				aria-hidden="true"
			/>
			<span className="relative flex items-center gap-1.5">
				<Trash2 className="size-4" />
				{isHolding ? "Keep holding" : "Hold to delete"}
			</span>
		</button>
	);
}
