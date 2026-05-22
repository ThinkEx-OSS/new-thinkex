import type * as React from "react";

import { cn } from "#/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex min-h-64 flex-col items-center justify-center gap-6 rounded-md p-8 text-center",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn("flex flex-col items-center gap-3", className)}
			{...props}
		/>
	);
}

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "icon" }) {
	return (
		<div
			data-slot="empty-media"
			data-variant={variant}
			className={cn(
				"flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
				variant === "icon" && "bg-transparent [&_svg]:size-8",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
	return (
		<h3
			data-slot="empty-title"
			className={cn("font-heading text-base font-medium", className)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-description"
			className={cn("max-w-sm text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
};
