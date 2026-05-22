import { Link } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";

import { ModeToggle } from "#/components/mode-toggle";
import ThinkExLogo from "#/components/ThinkExLogo";
import UserProfileDropdown from "#/components/UserProfileDropdown";
import { Button } from "#/components/ui/button";

interface AppShellProps {
	title?: string;
	subtitle?: string;
	navbarControls?: React.ReactNode;
	children: React.ReactNode;
}

export default function AppShell({
	title,
	subtitle,
	navbarControls,
	children,
}: AppShellProps) {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border/70 bg-background/95">
				<div className="grid h-12 w-full grid-cols-[minmax(0,1fr)_minmax(0,26rem)_minmax(0,1fr)] items-center gap-3 px-4">
					<Link
						to="/home"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					{navbarControls ? (
						<div className="flex min-w-0 items-center justify-center gap-2">
							{navbarControls}
						</div>
					) : null}

					<nav
						className="flex shrink-0 items-center justify-end gap-2"
						aria-label="Site"
					>
						<Button
							variant="outline"
							size="sm"
							type="button"
							className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
							aria-label="Send feedback"
							onClick={() => {
								// Placeholder until the feedback flow is wired up.
							}}
						>
							<MessageSquarePlus className="size-3.5" />
							<span>Feedback</span>
						</Button>
						<ModeToggle className="shrink-0" />
						<UserProfileDropdown />
					</nav>
				</div>
			</header>

			<div className="flex min-h-[calc(100vh-3rem)] w-full flex-col">
				<main className="flex-1 px-4 py-4">
					{title || subtitle ? (
						<section className="space-y-2">
							{title ? (
								<h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
									{title}
								</h1>
							) : null}
							{subtitle ? (
								<p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
									{subtitle}
								</p>
							) : null}
						</section>
					) : null}

					<div className={title || subtitle ? "mt-8" : undefined}>
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
