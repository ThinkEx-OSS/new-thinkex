import { Link } from "@tanstack/react-router";

import { ModeToggle } from "#/components/mode-toggle";
import ThinkExLogo from "#/components/ThinkExLogo";
import BetterAuthHeader from "#/integrations/better-auth/header-user";

interface AppShellProps {
	title: string;
	subtitle: string;
	children: React.ReactNode;
}

export default function AppShell({ title, subtitle, children }: AppShellProps) {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border bg-background">
				<div className="flex h-18 w-full items-center justify-between px-4">
					<Link
						to="/home"
						className="flex items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					<nav className="flex items-center gap-2" aria-label="Site">
						<ModeToggle className="shrink-0" />
						<BetterAuthHeader />
					</nav>
				</div>
			</header>

			<div className="flex min-h-[calc(100vh-4.5rem)] w-full flex-col">
				<main className="flex-1 px-6 py-10 md:px-8">
					<section className="space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
							{title}
						</h1>
						<p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
							{subtitle}
						</p>
					</section>

					<div className="mt-8">{children}</div>
				</main>
			</div>
		</div>
	);
}
