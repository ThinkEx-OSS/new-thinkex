import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import ErrorFallbackScreen from "#/components/ErrorFallbackScreen";

function getErrorMessage(error: ErrorComponentProps["error"]) {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Something went wrong while loading this page.";
}

export default function AppErrorScreen({ error, reset }: ErrorComponentProps) {
	const message = getErrorMessage(error);

	return (
		<ErrorFallbackScreen
			message={message}
			onReset={() => reset()}
			homeLink={<Link to="/">Back to home</Link>}
			stack={error instanceof Error ? error.stack : undefined}
		/>
	);
}
