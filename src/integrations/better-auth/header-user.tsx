import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
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

const userMenuTriggerClassName =
	"size-7 overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-none hover:scale-105 hover:bg-transparent focus-visible:ring-2 active:not-aria-[haspopup]:translate-y-0";
const userMenuAvatarClassName =
	"size-full after:border-transparent after:shadow-[inset_0_0_0_1px_var(--border)]";

export default function BetterAuthHeader() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending, refetch } = authClient.useSession();
	const handleSignOut = async () => {
		await authClient.signOut();
		await refetch();
		removeAuthSession(queryClient);
		await router.invalidate();
		await navigate({ to: "/" });
	};

	if (isPending) {
		return <div className="size-7 animate-pulse rounded-full bg-muted" />;
	}

	if (session?.user) {
		const displayName = session.user.name || session.user.email || "User";

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className={userMenuTriggerClassName}
						aria-label="Open account menu"
					>
						<Avatar className={userMenuAvatarClassName}>
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
