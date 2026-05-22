import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import AuthScreen from "#/components/AuthScreen";

export const Route = createFileRoute("/signup")({
	validateSearch: z.object({
		redirect: z
			.string()
			.refine((value) => value.startsWith("/") && !value.startsWith("//"))
			.optional(),
	}),
	beforeLoad: async ({ context, search }) => {
		if (context.session) {
			throw redirect({ to: search.redirect || "/home" });
		}
	},
	head: () => ({
		meta: [
			{
				title: "ThinkEx | Create account",
			},
			{
				name: "description",
				content: "Create your ThinkEx account with Google.",
			},
		],
	}),
	component: SignupPage,
});

function SignupPage() {
	const { redirect: redirectTarget } = Route.useSearch();
	const callbackURL = redirectTarget || "/home";

	return <AuthScreen callbackURL={callbackURL} mode="signup" />;
}
