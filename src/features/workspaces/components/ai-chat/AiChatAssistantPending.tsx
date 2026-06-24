import { ClientOnly } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { lazy, Suspense } from "react";

import { Message, MessageContent } from "#/components/ai-elements/message";
import { Shimmer } from "#/components/ai-elements/shimmer";
import { useTheme } from "#/components/theme-provider";
import type { AssistantPendingKind } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import { buildClientAbsoluteUrl } from "#/lib/client-url";

const THINKING_LOTTIE_BY_THEME = {
	dark: "/logo.lottie",
	light: "/thinkexlight.lottie",
} as const;
const DOTLOTTIE_WASM_SRC = "/vendor/dotlottie/dotlottie-player.wasm";

let dotLottieModulePromise: Promise<typeof import("@lottiefiles/dotlottie-react")> | undefined;

const LazyDotLottieReact = lazy(async () => ({
	default: (await loadDotLottieReact()).DotLottieReact,
}));

function loadDotLottieReact() {
	dotLottieModulePromise ??= import("@lottiefiles/dotlottie-react").then((module) => {
		module.setWasmUrl(buildClientAbsoluteUrl(DOTLOTTIE_WASM_SRC));

		return module;
	});

	return dotLottieModulePromise;
}

export function AiChatAssistantPending({ pending }: { pending: AssistantPendingKind }) {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<AiChatAssistantPendingBody pending={pending} />
			</MessageContent>
		</Message>
	);
}

function AiChatAssistantPendingBody({ pending }: { pending: AssistantPendingKind }) {
	if (pending === "recovering") {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
				<Shimmer duration={1.4}>{"Recovering response\u2026"}</Shimmer>
			</div>
		);
	}

	return <AiChatThinkingLoader />;
}

function AiChatThinkingLoader() {
	const { resolvedTheme } = useTheme();
	const lottieSrc = THINKING_LOTTIE_BY_THEME[resolvedTheme];

	return (
		<div className="flex items-center gap-3 py-2">
			<ClientOnly fallback={<ThinkingLottiePlaceholder />}>
				<Suspense fallback={<ThinkingLottiePlaceholder />}>
					<LazyDotLottieReact
						src={lottieSrc}
						loop
						autoplay
						mode="bounce"
						className="size-5 self-center"
					/>
				</Suspense>
			</ClientOnly>
			<span className="text-base text-muted-foreground">Thinking...</span>
		</div>
	);
}

function ThinkingLottiePlaceholder() {
	return (
		<span
			className="size-5 shrink-0 self-center rounded-full bg-muted/60 motion-safe:animate-pulse"
			aria-hidden="true"
		/>
	);
}
