import { Component, type ErrorInfo, type ReactNode } from "react";

import ErrorFallbackScreen from "#/components/ErrorFallbackScreen";

interface ClientErrorBoundaryProps {
	children: ReactNode;
}

interface ClientErrorBoundaryState {
	error: Error | null;
}

export default class ClientErrorBoundary extends Component<
	ClientErrorBoundaryProps,
	ClientErrorBoundaryState
> {
	state: ClientErrorBoundaryState = {
		error: null,
	};

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Client render failed", error, errorInfo);
	}

	reset = () => {
		this.setState({ error: null });
	};

	render() {
		const { error } = this.state;

		if (!error) {
			return this.props.children;
		}

		return (
			<ErrorFallbackScreen
				message={
					error.message || "Something went wrong while loading this page."
				}
				onReset={this.reset}
				homeLink={<a href="/">Back to home</a>}
				stack={error.stack}
			/>
		);
	}
}
