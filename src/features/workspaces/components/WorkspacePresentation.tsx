import type { ReactNode } from "react";

export function WorkspaceMaximizedPresentation({ children }: { children: ReactNode }) {
	return <div className="h-screen overflow-hidden bg-background text-foreground">{children}</div>;
}
