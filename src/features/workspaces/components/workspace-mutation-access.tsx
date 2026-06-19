import { createContext, type ReactNode, useContext } from "react";

import type { WorkspaceMembershipRole } from "#/features/workspaces/contracts";
import {
	getWorkspaceMemberCapabilities,
	type WorkspaceMemberCapabilities,
} from "#/features/workspaces/workspace-member-capabilities";

interface WorkspaceMutationAccessContextValue {
	capabilities: WorkspaceMemberCapabilities;
}

const WorkspaceMutationAccessContext =
	createContext<WorkspaceMutationAccessContextValue | null>(null);

export function WorkspaceMutationAccessProvider({
	membershipRole,
	children,
}: {
	membershipRole: WorkspaceMembershipRole;
	children: ReactNode;
}) {
	const value = {
		capabilities: getWorkspaceMemberCapabilities(membershipRole),
	};

	return (
		<WorkspaceMutationAccessContext value={value}>
			{children}
		</WorkspaceMutationAccessContext>
	);
}

export function useWorkspaceMutationAccess() {
	const value = useContext(WorkspaceMutationAccessContext);

	if (!value) {
		throw new Error(
			"useWorkspaceMutationAccess must be used within WorkspaceMutationAccessProvider",
		);
	}

	return value;
}
