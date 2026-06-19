import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

// import PostHogProvider from '../integrations/posthog/provider'

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { WorkspacePersistedStoresHydrator } from "#/features/workspaces/state/persisted-store-hydration";
import type { AuthSession } from "#/lib/auth.functions";
import { AppHotkeysProvider } from "#/lib/hotkeys";
import { getAuthSessionQueryOptions } from "#/lib/session-query";
import { ThemeProvider } from "../components/theme-provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	session?: AuthSession | null;
}

const faviconLinks = import.meta.env.DEV
	? [
			{
				rel: "icon",
				href: "/favicon-dev.svg",
				type: "image/svg+xml",
				sizes: "any",
			},
		]
	: [
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon",
				sizes: "16x16 32x32 64x64",
			},
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
				sizes: "any",
			},
		];

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Thinkex",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			...faviconLinks,
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{import.meta.env.DEV ? (
					<script
						src="https://unpkg.com/react-grab/dist/index.global.js"
						crossOrigin="anonymous"
					/>
				) : null}
			</head>
			<body>
				<ThemeProvider defaultTheme="system" storageKey="theme">
					<AppHotkeysProvider>
						<TooltipProvider>
							{/* <PostHogProvider> */}
							<WorkspacePersistedStoresHydrator />
							<AuthSessionRefresher />
							{children}
							<Toaster />
							{import.meta.env.DEV ? (
								<TanStackDevtools
									config={{
										position: "bottom-right",
									}}
									plugins={[
										{
											name: "Tanstack Router",
											render: <TanStackRouterDevtoolsPanel />,
										},
										TanStackQueryDevtools,
									]}
								/>
							) : null}
							{/* </PostHogProvider> */}
						</TooltipProvider>
					</AppHotkeysProvider>
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}

function AuthSessionRefresher() {
	useQuery(getAuthSessionQueryOptions());
	return null;
}
