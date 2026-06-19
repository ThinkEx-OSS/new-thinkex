import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import {
	acceptWorkspaceInviteFn,
	getWorkspaceInvitePreviewFn,
} from "#/features/workspaces/invites/workspace-invite-functions";
import { getAuthSessionQueryOptions } from "#/lib/session-query";

export const Route = createFileRoute("/invite/$token")({
	loader: async ({ context, params }) => {
		const session = await context.queryClient.ensureQueryData(
			getAuthSessionQueryOptions(),
		);

		if (session) {
			const result = await acceptWorkspaceInviteFn({
				data: { token: params.token },
			});

			throw redirect({
				to: "/workspaces/$workspaceId",
				params: { workspaceId: result.workspaceId },
				search: {
					tab: undefined,
					view: undefined,
				},
			});
		}

		try {
			return await getWorkspaceInvitePreviewFn({
				data: { token: params.token },
			});
		} catch {
			throw new Error("INVITE_UNAVAILABLE");
		}
	},
	component: InviteLandingPage,
	errorComponent: InviteUnavailablePage,
});

function InviteLandingPage() {
	const { token } = Route.useParams();
	const preview = Route.useLoaderData();

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-6 py-12">
			<div className="space-y-2 text-center">
				<p className="text-sm text-muted-foreground">Workspace invite</p>
				<h1 className="text-3xl font-semibold tracking-tight">
					Join {preview.workspaceName}
				</h1>
				<p className="text-muted-foreground">
					{preview.inviterName} invited you as an{" "}
					<span className="font-medium text-foreground capitalize">
						{preview.role}
					</span>
					.
				</p>
				{preview.expiresAt ? (
					<p className="text-sm text-muted-foreground">
						Invite expires {new Date(preview.expiresAt).toLocaleString()}.
					</p>
				) : null}
			</div>
			<Button
				nativeButton={false}
				render={<Link to="/login" search={{ redirect: `/invite/${token}` }} />}
				className="w-full"
				size="lg"
			>
				Continue with Google
			</Button>
		</main>
	);
}

function InviteUnavailablePage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-6 py-12 text-center">
			<h1 className="text-2xl font-semibold">Invite unavailable</h1>
			<p className="text-muted-foreground">
				This invite link is invalid, expired, or has been revoked.
			</p>
			<Button
				nativeButton={false}
				render={<Link to="/login" />}
				variant="outline"
			>
				Sign in
			</Button>
		</main>
	);
}
