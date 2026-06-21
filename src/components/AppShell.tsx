import { Link } from "@tanstack/react-router";

import ThinkExLogo from "#/components/ThinkExLogo";
import UserProfileDropdown from "#/components/UserProfileDropdown";

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
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
			<header className="z-40 shrink-0 bg-muted">
				<div className="flex h-12 w-full items-center gap-3 px-4">
					<Link
						to="/home"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					<div className="flex min-w-0 flex-1 items-center justify-center gap-2">
						{navbarControls}
					</div>

					<nav
						className="flex shrink-0 items-center justify-end"
						aria-label="Site"
					>
						<UserProfileDropdown />
					</nav>
				</div>
			</header>

			<div
				data-scroll-root
				className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
			>
				<main className="flex-1 min-h-0 p-4">
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
