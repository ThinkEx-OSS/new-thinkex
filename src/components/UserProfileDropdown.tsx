import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Laptop, LogOut, Moon, Settings, Sun } from "lucide-react";
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/lib/auth-client";
import { getErrorMessage } from "#/lib/error-message";
import { removeAuthSession } from "#/lib/session-query";

const userMenuTriggerClassName =
	"size-8 overflow-hidden rounded-full border-border bg-background p-0 shadow-xs hover:bg-muted focus-visible:ring-2 active:not-aria-[haspopup]:translate-y-0 dark:border-input dark:bg-input/30 dark:hover:bg-input/50";
const userMenuAvatarClassName = "size-full after:border-0";
const userMenuAvatarFallbackClassName = "bg-transparent";

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

const themeOptionsByValue = Object.fromEntries(
	themeOptions.map((option) => [option.value, option]),
) as Record<Theme, (typeof themeOptions)[number]>;

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
		const activeThemeOption = themeOptionsByValue[theme];
		const ActiveThemeIcon = activeThemeOption.icon;

		return (
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="icon-sm"
							className={userMenuTriggerClassName}
							aria-label="Open account menu"
						/>
					}
				>
					<Avatar className={userMenuAvatarClassName}>
						<AvatarImage src={session.user.image ?? undefined} alt="" />
						<AvatarFallback className={userMenuAvatarFallbackClassName}>
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
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<div className="flex flex-col gap-1.5 px-2 py-1.5">
							<div className="text-xs font-medium text-muted-foreground">
								Theme
							</div>
							<Select
								items={themeOptions}
								value={theme}
								onValueChange={(value) => setTheme(value as Theme)}
							>
								<SelectTrigger
									className="w-full justify-between bg-background"
									aria-label="Theme"
								>
									<SelectValue>
										<ActiveThemeIcon className="size-4" />
										{activeThemeOption.label}
									</SelectValue>
								</SelectTrigger>
								<SelectContent alignItemWithTrigger={false} sideOffset={0}>
									<SelectGroup>
										{themeOptions.map(({ value, label, icon: Icon }) => (
											<SelectItem key={value} value={value}>
												<Icon className="size-4" />
												{label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
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
