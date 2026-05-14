import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";

import AppShell from "#/components/AppShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { listMockWorkspaces } from "#/services/workspaces";

const protectedRouteApi = getRouteApi("/_protected");

export const Route = createFileRoute("/_protected/home")({
	beforeLoad: async () => {
		return {
			workspaces: listMockWorkspaces(),
		};
	},
	head: () => ({
		meta: [
			{
				title: "Thinkex | Home",
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	const { session } = protectedRouteApi.useRouteContext();
	const { workspaces } = Route.useRouteContext();

	return (
		<AppShell
			title={`Welcome back, ${session.user.name ?? "there"}.`}
			subtitle="A minimal protected workspace shell with mocked data for Phase 1."
		>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{workspaces.map((workspace) => (
					<Card
						key={workspace.id}
						className="border-border/40 bg-card/85 py-0 shadow-xl"
					>
						<CardHeader className="gap-3 border-b border-border/40 py-5">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<CardTitle>{workspace.name}</CardTitle>
									<CardDescription>{workspace.description}</CardDescription>
								</div>
								<Badge
									variant={
										workspace.status === "ready" ? "secondary" : "outline"
									}
									className="uppercase"
								>
									{workspace.status}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="py-4">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock3 className="size-3.5" />
								<span>{workspace.updatedAt}</span>
							</div>
						</CardContent>
						<CardFooter className="justify-end border-t border-border/40 py-4">
							<Dialog>
								<DialogTrigger asChild>
									<Button size="sm" variant="outline">
										View details
									</Button>
								</DialogTrigger>
								<DialogContent className="border border-border/40 bg-card shadow-2xl">
									<DialogHeader>
										<DialogTitle>{workspace.name}</DialogTitle>
										<DialogDescription>
											{workspace.description}
										</DialogDescription>
									</DialogHeader>
									<div className="text-sm text-muted-foreground">
										<p>{workspace.updatedAt}</p>
										<p className="mt-2 capitalize">
											Status: {workspace.status}
										</p>
									</div>
									<DialogFooter showCloseButton />
								</DialogContent>
							</Dialog>
						</CardFooter>
					</Card>
				))}
			</section>
		</AppShell>
	);
}
