import {
	FilePen,
	Folder,
	type LucideIcon,
	Sparkles,
	Upload,
} from "lucide-react";

import { Button } from "#/components/ui/button";
import { useWorkspaceFileUpload } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import { WorkspaceViewerRoleBadge } from "#/features/workspaces/components/workspace-viewer-ui";
import type {
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import { workspaceColors } from "#/features/workspaces/model/workspace-colors";
import { workspaceItemTypeColors } from "#/features/workspaces/model/workspace-item-colors";
import { cn } from "#/lib/utils";

interface WorkspaceEmptyBrowseStateProps {
	workspace: WorkspaceSummary;
	parentId: string | null;
	isRoot: boolean;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
}

interface EmptyActionTileDef {
	id: string;
	label: string;
	description: string;
	Icon: LucideIcon;
	iconClassName: string;
	surfaceClassName: string;
	onSelect: () => void;
}

const comingSoonCapabilities: {
	label: string;
	iconClassName: string;
	surfaceClassName: string;
}[] = [
	{
		label: "Flashcards",
		iconClassName:
			workspaceColors[workspaceItemTypeColors.flashcard].iconClassName,
		surfaceClassName:
			workspaceColors[workspaceItemTypeColors.flashcard].surfaceClassName,
	},
	{
		label: "Quizzes",
		iconClassName: workspaceColors[workspaceItemTypeColors.quiz].iconClassName,
		surfaceClassName:
			workspaceColors[workspaceItemTypeColors.quiz].surfaceClassName,
	},
];

export default function WorkspaceEmptyBrowseState({
	workspace,
	parentId,
	isRoot,
	onCreateItem,
}: WorkspaceEmptyBrowseStateProps) {
	const { capabilities } = useWorkspaceMutationAccess();
	const { requestFileUpload } = useWorkspaceFileUpload();

	if (!capabilities.canMutateContent) {
		return <WorkspaceEmptyViewerState isRoot={isRoot} />;
	}

	const tiles: EmptyActionTileDef[] = [
		{
			id: "document",
			label: "New document",
			description: "Write notes, summaries, and ideas.",
			Icon: FilePen,
			iconClassName:
				workspaceColors[workspaceItemTypeColors.document].iconClassName,
			surfaceClassName:
				workspaceColors[workspaceItemTypeColors.document].surfaceClassName,
			onSelect: () => onCreateItem({ type: "document", parentId }),
		},
		{
			id: "folder",
			label: "New folder",
			description: "Group related items together.",
			Icon: Folder,
			iconClassName:
				workspaceColors[workspaceItemTypeColors.folder].iconClassName,
			surfaceClassName:
				workspaceColors[workspaceItemTypeColors.folder].surfaceClassName,
			onSelect: () => onCreateItem({ type: "folder", parentId }),
		},
		{
			id: "upload",
			label: "Upload files",
			description: "Drag files here or browse from your device.",
			Icon: Upload,
			iconClassName:
				workspaceColors[workspaceItemTypeColors.file].iconClassName,
			surfaceClassName:
				workspaceColors[workspaceItemTypeColors.file].surfaceClassName,
			onSelect: () => requestFileUpload(parentId),
		},
	];

	return (
		<EmptyOnboarding
			workspace={workspace}
			isRoot={isRoot}
			tiles={tiles}
			comingSoon={comingSoonCapabilities}
		/>
	);
}

function EmptyOnboarding({
	workspace,
	isRoot,
	tiles,
	comingSoon,
}: {
	workspace: WorkspaceSummary;
	isRoot: boolean;
	tiles: EmptyActionTileDef[];
	comingSoon: {
		label: string;
		iconClassName: string;
		surfaceClassName: string;
	}[];
}) {
	const { Icon: WorkspaceIcon, color } = getWorkspaceDisplay(workspace);
	const heading = isRoot
		? `Welcome to ${workspace.name}`
		: "This folder is empty";
	const description = isRoot
		? "Add your notes, files, and study materials to get started. Pick an option below, drag files in, or right-click anywhere to add."
		: "Add items here to keep things organized. Pick an option below, drag files in, or right-click anywhere to add.";

	return (
		<div className="flex w-full min-w-0 flex-col items-center gap-6 rounded-lg border border-dashed bg-muted/20 p-8 text-center sm:p-12">
			<div className="flex max-w-md flex-col items-center gap-3">
				<div
					className={cn(
						"flex size-12 shrink-0 items-center justify-center rounded-xl",
						color.bg,
					)}
				>
					<WorkspaceIcon
						className={cn("size-6", color.text)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</div>
				<h2 className="font-heading text-lg font-medium tracking-tight text-foreground">
					{heading}
				</h2>
				<p className="text-balance text-sm/relaxed text-muted-foreground">
					{description}
				</p>
			</div>

			<div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
				{tiles.map((tile) => (
					<EmptyActionTile key={tile.id} tile={tile} />
				))}
			</div>

			{comingSoon.length > 0 ? (
				<div className="flex flex-col items-center gap-2">
					<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						<Sparkles className="size-3.5" aria-hidden="true" />
						<span>More coming soon</span>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-2">
						{comingSoon.map((capability) => (
							<span
								key={capability.label}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground",
									capability.surfaceClassName,
								)}
							>
								<span
									className={cn(
										"size-1.5 rounded-full",
										capability.iconClassName,
									)}
									aria-hidden="true"
								/>
								{capability.label}
							</span>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

function EmptyActionTile({ tile }: { tile: EmptyActionTileDef }) {
	const {
		Icon,
		label,
		description,
		iconClassName,
		surfaceClassName,
		onSelect,
	} = tile;

	return (
		<Button
			type="button"
			variant="outline"
			className="h-auto w-full flex-col items-start gap-2 rounded-lg border-dashed px-4 py-4 text-left whitespace-normal"
			onClick={onSelect}
		>
			<span
				className={cn(
					"flex size-9 shrink-0 items-center justify-center rounded-lg",
					surfaceClassName,
				)}
			>
				<Icon
					className={cn("size-5", iconClassName)}
					strokeWidth={1.75}
					aria-hidden="true"
				/>
			</span>
			<span className="flex flex-col gap-0.5">
				<span className="text-sm font-medium text-foreground">{label}</span>
				<span className="text-xs text-muted-foreground">{description}</span>
			</span>
		</Button>
	);
}

function WorkspaceEmptyViewerState({ isRoot }: { isRoot: boolean }) {
	return (
		<div className="flex w-full min-w-0 flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/20 p-12 text-center">
			<div className="flex max-w-sm flex-col items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
					<Folder className="size-6" strokeWidth={1.75} aria-hidden="true" />
				</div>
				<h2 className="font-heading text-lg font-medium tracking-tight text-foreground">
					{isRoot ? "Nothing here yet" : "This folder is empty"}
				</h2>
				<p className="text-sm/relaxed text-muted-foreground">
					You have view-only access to this workspace. Ask an editor to add
					content, or explore what's already here.
				</p>
				<WorkspaceViewerRoleBadge />
			</div>
		</div>
	);
}
