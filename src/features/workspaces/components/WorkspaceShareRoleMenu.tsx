import { ChevronDown } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { WorkspaceMembershipRole } from "#/features/workspaces/contracts";
import { workspaceRoleLabels } from "#/features/workspaces/contracts";

export function WorkspaceShareRoleMenu({
	align = "end",
	onValueChange,
	roles,
	value,
}: {
	align?: "end" | "start";
	onValueChange: (role: WorkspaceMembershipRole) => void;
	roles: WorkspaceMembershipRole[];
	value: WorkspaceMembershipRole;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-muted-foreground hover:text-foreground"
					/>
				}
			>
				{workspaceRoleLabels[value]}
				<ChevronDown className="size-4 opacity-60" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} side="bottom" className="min-w-28">
				{roles.map((role) => (
					<DropdownMenuItem key={role} onClick={() => onValueChange(role)}>
						{workspaceRoleLabels[role]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
