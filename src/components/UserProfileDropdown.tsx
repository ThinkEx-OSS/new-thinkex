import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
	Laptop,
	LogOut,
	MessageSquarePlus,
	Moon,
	Settings,
	Sun,
	SunMoon,
} from "lucide-react";
import { toast } from "sonner";

import { type Theme, useTheme } from "#/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/lib/auth-client";
import { getErrorMessage } from "#/lib/error-message";
import { removeAuthSession } from "#/lib/session-query";

const userMenuTriggerClassName =
	"size-8 rounded-full p-0 hover:bg-muted focus-visible:ring-2 active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-input/50";

const themeOptions = [
	{
		value: "light",
		label: "Light",
		icon: Sun,
	},
	{
		value: "dark",
		label: "Dark",
		icon: Moon,
	},
	{
		value: "system",
		label: "System",
		icon: Laptop,
	},
] as const;

export default function UserProfileDropdown() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { theme, setTheme } = useTheme();
	const { data: session, isPending, refetch } = authClient.useSession();
	const handleSignOut = async () => {
		try {
			await authClient.signOut();
			await refetch();
			removeAuthSession(queryClient);
			await router.invalidate();
			await navigate({ to: "/" });
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to sign out right now."));
		}
	};

	if (isPending) {
		return <Skeleton className="size-8 shrink-0 rounded-full" />;
	}

	if (session?.user) {
		const displayName = session.user.name || session.user.email || "User";

		return (
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							className={userMenuTriggerClassName}
							aria-label="Open account menu"
						/>
					}
				>
					<Avatar className="size-full">
						<AvatarImage src={session.user.image ?? undefined} alt="" />
						<AvatarFallback>
							{displayName.charAt(0).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuGroup>
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
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<SunMoon className="size-4" />
								Theme
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuRadioGroup
									value={theme}
									onValueChange={(value) => setTheme(value as Theme)}
								>
									{themeOptions.map(({ value, label, icon: Icon }) => (
										<DropdownMenuRadioItem key={value} value={value}>
											<Icon className="size-4" />
											{label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuItem
							onClick={() => {
								// Placeholder until the feedback flow is wired up.
							}}
						>
							<MessageSquarePlus className="size-4" />
							Feedback
						</DropdownMenuItem>
						<DropdownMenuItem>
							<Settings className="size-4" />
							Settings
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								void handleSignOut();
							}}
						>
							<LogOut className="size-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	return (
		<Button
			nativeButton={false}
			render={<Link to="/login" />}
			variant="outline"
		>
			Sign in
		</Button>
	);
}
