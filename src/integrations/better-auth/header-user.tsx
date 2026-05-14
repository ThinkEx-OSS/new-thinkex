import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { authClient } from "#/lib/auth-client";
import { removeAuthSession } from "#/lib/session-query";

export default function BetterAuthHeader() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const handleSignOut = async () => {
		await authClient.signOut();
		removeAuthSession(queryClient);
		await navigate({ to: "/" });
	};

	if (isPending) {
		return <div className="size-9 animate-pulse rounded-full bg-muted" />;
	}

	if (session?.user) {
		const displayName = session.user.name || session.user.email || "User";

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="rounded-full p-0"
						aria-label="Open account menu"
					>
						<Avatar>
							<AvatarImage src={session.user.image ?? undefined} alt="" />
							<AvatarFallback>
								{displayName.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel>
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								{displayName}
							</p>
							<p className="text-xs font-normal text-muted-foreground">
								{session.user.email}
							</p>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault();
						}}
					>
						<Settings className="size-4" />
						Settings
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onSelect={(event) => {
							event.preventDefault();
							void handleSignOut();
						}}
					>
						<LogOut className="size-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	return (
		<Button asChild variant="outline">
			<Link to="/login">Sign in</Link>
		</Button>
	);
}
