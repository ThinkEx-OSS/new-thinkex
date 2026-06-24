function normalizePostHogHost(host: string | undefined) {
	const value = host?.trim();

	if (!value) {
		return undefined;
	}

	return value.replace(/\/$/, "");
}

function resolvePostHogHostOrigin(host: string | undefined) {
	if (!host) {
		return undefined;
	}

	try {
		return new URL(host).origin;
	} catch {
		return undefined;
	}
}

export const posthogProjectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim() || undefined;

export const posthogHost = normalizePostHogHost(import.meta.env.VITE_POSTHOG_HOST);
export const posthogHostOrigin = resolvePostHogHostOrigin(posthogHost);
export const isPostHogEnabled = Boolean(posthogProjectToken && posthogHost);
