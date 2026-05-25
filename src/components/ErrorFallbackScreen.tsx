import type { ReactElement } from "react";

import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";

interface ErrorFallbackScreenProps {
	message: string;
	onReset: () => void;
	homeLink: ReactElement;
	stack?: string;
}

export default function ErrorFallbackScreen({
	message,
	onReset,
	homeLink,
	stack,
}: ErrorFallbackScreenProps) {
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
						<Button type="button" onClick={onReset}>
							Try again
						</Button>
						<Button
							render={homeLink}
							variant="ghost"
							className="text-muted-foreground hover:text-foreground"
						>
							Go home
						</Button>
					</div>

					{stack ? (
						<Collapsible className="flex w-full max-w-sm flex-col items-center text-center text-xs text-muted-foreground">
							<CollapsibleTrigger
								render={
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="mx-auto h-auto px-2 py-1 text-xs text-muted-foreground"
									/>
								}
							>
								Technical details
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-3 w-full overflow-hidden">
								<pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-card p-4 text-left leading-5">
									{stack}
								</pre>
							</CollapsibleContent>
						</Collapsible>
					) : null}
				</div>
			</main>
		</div>
	);
}
