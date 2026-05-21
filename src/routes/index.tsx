import {
	createFileRoute,
	Link,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { Check, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { ModeToggle } from "#/components/mode-toggle";
import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";
import { getAuthSessionQueryOptions } from "#/lib/session-query";
import { smoothScrollViewportTop } from "#/lib/smooth-scroll";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const session =
			typeof window === "undefined"
				? context.session
				: await context.queryClient.fetchQuery({
						...getAuthSessionQueryOptions(),
						staleTime: 0,
					});

		if (session) {
			throw redirect({ to: "/home" });
		}
	},
	head: () => ({
		meta: [
			{
				title: "ThinkEx",
			},
			{
				name: "description",
				content:
					"ThinkEx is an AI workspace for documents, media, notes, and persistent context.",
			},
			{
				property: "og:title",
				content: "ThinkEx",
			},
			{
				property: "og:description",
				content:
					"Turn AI into a workspace instead of a chat tab with context that stays visible.",
			},
		],
	}),
	component: LandingPage,
});

function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			fill="currentColor"
			aria-hidden="true"
			{...props}
		>
			<title>Discord</title>
			<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
		</svg>
	);
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			fill="currentColor"
			aria-hidden="true"
			{...props}
		>
			<title>GitHub</title>
			<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
		</svg>
	);
}

function RedditIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			fill="currentColor"
			aria-hidden="true"
			{...props}
		>
			<title>Reddit</title>
			<path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" />
		</svg>
	);
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			fill="currentColor"
			aria-hidden="true"
			{...props}
		>
			<title>X</title>
			<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
		</svg>
	);
}

const CONTACT_EMAIL = "hello@thinkex.app";

function FooterEmailLink() {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const id = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(id);
	}, [copied]);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(CONTACT_EMAIL);
			setCopied(true);
		} catch {
			// Clipboard API unavailable; leave label unchanged.
		}
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="flex items-center gap-3 transition-colors hover:text-foreground"
			aria-label={copied ? "Email copied" : `Copy ${CONTACT_EMAIL}`}
		>
			{copied ? (
				<>
					<Check className="size-5" />
					<span>Copied</span>
				</>
			) : (
				<>
					<Mail className="size-5" />
					<span>Email</span>
				</>
			)}
		</button>
	);
}

function LandingPage() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	function handleHomeLogoClick(event: React.MouseEvent<HTMLAnchorElement>) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		if (pathname === "/") {
			event.preventDefault();
			smoothScrollViewportTop();
		}
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border bg-background">
				<div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-6">
					<Link
						to="/"
						onClick={handleHomeLogoClick}
						className="flex items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					<nav className="flex items-center gap-2" aria-label="Site">
						<Button
							variant="ghost"
							size="default"
							className="hidden text-muted-foreground md:inline-flex"
						>
							Pricing
						</Button>
						<Button
							variant="ghost"
							size="default"
							className="hidden text-muted-foreground md:inline-flex"
						>
							Blog
						</Button>
						<ModeToggle className="shrink-0" />
						<div aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
						<div className="flex items-center gap-2">
							<Button
								asChild
								variant="ghost"
								size="default"
								className="text-muted-foreground"
							>
								<Link to="/login">Sign in</Link>
							</Button>
							<Button asChild size="default">
								<Link to="/signup">Get started</Link>
							</Button>
						</div>
					</nav>
				</div>
			</header>

			<main>
				<section className="border-b border-border">
					<div className="mx-auto w-full max-w-7xl px-6 py-16 lg:py-20">
						<div className="max-w-3xl">
							<h1 className="text-5xl font-medium tracking-tight text-balance sm:text-6xl lg:text-7xl">
								The workspace that thinks with you.
							</h1>
							<p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
								ThinkEx gives documents, notes, media, and reasoning a shared
								surface. Compare sources, focus the model on the right inputs,
								and keep important context available over time.
							</p>
						</div>

						<div className="mt-16 overflow-hidden rounded-md border border-border bg-card shadow-2xl">
							<div className="aspect-[16/10] bg-background p-6 sm:p-8">
								<div className="flex h-full flex-col justify-between">
									<div className="flex items-center justify-end">
										<p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
											Screenshot placeholder
										</p>
									</div>

									<div className="space-y-4">
										<p className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
											Coming soon
										</p>
										<p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
											A full product capture will live here once the first
											marketing-ready workspace screenshot is available.
										</p>
									</div>

									<div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_260px]">
										<div className="h-44 border border-border" />
										<div className="h-44 border border-border" />
										<div className="h-44 border border-border" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>
			</main>

			<footer className="bg-background text-foreground">
				<div className="mx-auto w-full max-w-7xl px-6 py-16">
					<div className="flex flex-col items-center">
						<ThinkExLogo size={32} />

						<div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 text-base text-muted-foreground">
							<FooterEmailLink />
							<a
								href="https://github.com/thinkex-oss/thinkex"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 transition-colors hover:text-foreground"
							>
								<GitHubIcon className="size-5" />
								<span>GitHub</span>
							</a>
							<a
								href="https://discord.gg/p56ZZDYf"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 transition-colors hover:text-foreground"
							>
								<DiscordIcon className="size-5" />
								<span>Discord</span>
							</a>
							<a
								href="https://www.reddit.com/r/thinkex"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 transition-colors hover:text-foreground"
							>
								<RedditIcon className="size-5" />
								<span>Reddit</span>
							</a>
							<a
								href="https://x.com/trythinkex"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 transition-colors hover:text-foreground"
							>
								<XIcon className="size-[18px]" />
								<span>Twitter / X</span>
							</a>
						</div>

						<div className="mt-14 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground/55 sm:mt-16 sm:text-sm">
							<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-x-5">
								<span>Terms of Service</span>
								<span>Privacy Policy</span>
								<span>Cookie Policy</span>
							</div>
							<p>© 2026 ThinkEx Inc. All rights reserved.</p>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
