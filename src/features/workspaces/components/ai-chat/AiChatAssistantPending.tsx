import { ClientOnly } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { lazy, Suspense } from "react";

import { Message, MessageContent } from "#/components/ai-elements/message";
import { Shimmer } from "#/components/ai-elements/shimmer";
import { useTheme } from "#/components/theme-provider";
import type { AssistantPendingKind } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";

const THINKING_LOTTIE_BY_THEME = {
	dark: "/logo.lottie",
	light: "/thinkexlight.lottie",
} as const;
const DOTLOTTIE_WASM_SRC = "/vendor/dotlottie/dotlottie-player.wasm";
const THINKING_LOTTIE_PREFETCHES = [
	{
		href: DOTLOTTIE_WASM_SRC,
		crossOrigin: "anonymous",
		type: "application/wasm",
	},
	{ href: THINKING_LOTTIE_BY_THEME.dark },
	{ href: THINKING_LOTTIE_BY_THEME.light },
];

let dotLottieModulePromise:
	| Promise<typeof import("@lottiefiles/dotlottie-react")>
	| undefined;

const LazyDotLottieReact = lazy(async () => ({
	default: (await loadDotLottieReact()).DotLottieReact,
}));

export function scheduleAiChatThinkingLoaderPrewarm() {
	if (typeof window === "undefined") {
		return;
	}

	let cancelled = false;
	const prewarm = () => {
		if (cancelled) {
			return;
		}

		prewarmAiChatThinkingLoader();
	};

	if ("requestIdleCallback" in window) {
		const callbackId = window.requestIdleCallback(prewarm, { timeout: 3000 });

		return () => {
			cancelled = true;
			window.cancelIdleCallback(callbackId);
		};
	}

	const timeoutId = globalThis.setTimeout(prewarm, 1500);

	return () => {
		cancelled = true;
		globalThis.clearTimeout(timeoutId);
	};
}

function prewarmAiChatThinkingLoader() {
	void loadDotLottieReact();
	THINKING_LOTTIE_PREFETCHES.forEach(prefetchStaticAsset);
}

function loadDotLottieReact() {
	dotLottieModulePromise ??= import("@lottiefiles/dotlottie-react").then(
		(module) => {
			module.setWasmUrl(
				new URL(DOTLOTTIE_WASM_SRC, window.location.origin).href,
			);

			return module;
		},
	);

	return dotLottieModulePromise;
}

function prefetchStaticAsset({
	crossOrigin,
	href,
	type,
}: {
	crossOrigin?: string;
	href: string;
	type?: string;
}) {
	const url = new URL(href, window.location.origin).href;

	if (document.head.querySelector(`link[href="${url}"]`)) {
		return;
	}

	const link = document.createElement("link");
	link.rel = "prefetch";
	link.href = url;
	link.as = "fetch";
	if (crossOrigin) {
		link.crossOrigin = crossOrigin;
	}
	if (type) {
		link.type = type;
	}
	document.head.appendChild(link);
}

export function AiChatAssistantPending({
	pending,
}: {
	pending: AssistantPendingKind;
}) {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<AiChatAssistantPendingBody pending={pending} />
			</MessageContent>
		</Message>
	);
}

function AiChatAssistantPendingBody({
	pending,
}: {
	pending: AssistantPendingKind;
}) {
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
