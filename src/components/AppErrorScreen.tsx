import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";

function getErrorMessage(error: ErrorComponentProps["error"]) {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Something went wrong while loading this page.";
}

export default function AppErrorScreen({ error, reset }: ErrorComponentProps) {
	const message = getErrorMessage(error);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
				<div className="flex w-full max-w-md flex-col items-center gap-8 px-8 text-center sm:px-12">
					<ThinkExLogo size={36} />
					<div className="space-y-3">
						<p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
							Unexpected error
						</p>
						<h1 className="text-2xl font-medium tracking-tight">
							This page couldn&apos;t load
						</h1>
						<p className="text-sm leading-6 text-muted-foreground">{message}</p>
					</div>

					<div className="flex w-full max-w-xs flex-col gap-3">
						<Button type="button" onClick={() => reset()}>
							Try again
						</Button>
						<Button
							asChild
							variant="ghost"
							className="text-muted-foreground hover:text-foreground"
						>
							<Link to="/">Back to home</Link>
						</Button>
					</div>

					{error instanceof Error && error.stack ? (
						<details className="w-full max-w-xs text-left text-xs text-muted-foreground">
							<summary className="cursor-pointer list-none text-center">
								Technical details
							</summary>
							<pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-card p-4 leading-5">
								{error.stack}
							</pre>
						</details>
					) : null}
				</div>
			</main>
		</div>
	);
}
