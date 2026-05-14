import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ context, location }) => {
		const session = context.session;

		if (!session) {
			throw redirect({
				to: "/login",
				search: {
					redirect: location.href,
				},
			});
		}

		return { session };
	},
	component: ProtectedLayout,
});

function ProtectedLayout() {
	return <Outlet />;
}
