import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import AuthScreen from "#/components/AuthScreen";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		redirect: z
			.string()
			.refine((value) => value.startsWith("/") && !value.startsWith("//"))
			.optional(),
	}),
	beforeLoad: async ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/home" });
		}
	},
	head: () => ({
		meta: [
			{
				title: "Thinkex | Sign in",
			},
			{
				name: "description",
				content: "Sign in to ThinkEx with Google.",
			},
		],
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect: redirectTarget } = Route.useSearch();
	const callbackURL = redirectTarget || "/home";

	return <AuthScreen callbackURL={callbackURL} mode="signin" />;
}
