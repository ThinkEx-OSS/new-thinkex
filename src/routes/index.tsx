import { createFileRoute, redirect } from "@tanstack/react-router";

import LandingPage from "#/components/LandingPage";
import { getAuthSessionQueryOptions } from "#/lib/session-query";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.ensureQueryData(
			getAuthSessionQueryOptions(),
		);

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
