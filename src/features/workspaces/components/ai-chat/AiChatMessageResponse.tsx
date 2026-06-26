import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import type { ComponentProps } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";
import { MarkdownCodeBlock } from "#/features/workspaces/components/ai-chat/ai-chat-code-block";
import { cn } from "#/lib/utils";

type AiChatMessageResponseProps = ComponentProps<typeof Streamdown> & {
	isStreaming?: boolean;
};

// Safety interstitial disabled — it adds friction on every link click in a chat
// context. Instead, all external links are rendered with target="_blank" and
// rel="noopener noreferrer" via the custom anchor component below.
const streamdownLinkSafety = { enabled: false };

function SafeAnchor({ href, children, ...props }: ComponentProps<"a">) {
	const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
	return (
		<a
			href={href}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			{...props}
		>
			{children}
		</a>
	);
}

const streamdownPlugins = { cjk, math };
const streamdownComponents = { code: MarkdownCodeBlock, a: SafeAnchor };
const streamdownAnimation = {
	animation: "fadeIn",
	duration: 160,
	easing: "cubic-bezier(0.16, 1, 0.3, 1)",
	sep: "word",
	stagger: 8,
} satisfies NonNullable<StreamdownProps["animated"]>;

export function AiChatMessageResponse({
	className,
	components,
	isStreaming = false,
	...props
}: AiChatMessageResponseProps) {
	return (
		<Streamdown
			animated={streamdownAnimation}
			className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
			components={{ ...streamdownComponents, ...components }}
			isAnimating={isStreaming}
			linkSafety={streamdownLinkSafety}
			mode="streaming"
			plugins={streamdownPlugins}
			{...props}
		/>
	);
}
