import AppShell from "#/components/AppShell";
import CreateWorkspaceCard from "#/features/workspaces/components/CreateWorkspaceCard";
import WorkspaceCardSkeleton from "#/features/workspaces/components/WorkspaceCardSkeleton";
import { WorkspaceHomeSearchControl } from "#/features/workspaces/components/WorkspaceHomeSearchControl";

const homeWorkspaceSkeletonCardIds = ["recent", "research", "notes"] as const;

export function WorkspaceHomePageSkeleton() {
	return (
		<AppShell
			navbarControls={
				<WorkspaceHomeSearchControl
					value=""
					onChange={() => {}}
					disabled={true}
				/>
			}
		>
			<div className="space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard disabled={true} />
					{homeWorkspaceSkeletonCardIds.map((id) => (
						<WorkspaceCardSkeleton key={id} />
					))}
				</section>
			</div>
		</AppShell>
	);
}
