import AuthPanel from "#/components/AuthPanel";
import ThinkExLogo from "#/components/ThinkExLogo";

type AuthMode = "signin" | "signup";

interface AuthScreenProps {
	callbackURL: string;
	mode: AuthMode;
}

export default function AuthScreen({ callbackURL, mode }: AuthScreenProps) {
	const title = mode === "signin" ? "Welcome back" : "Create an account";

	return (
		<div className="min-h-screen bg-background text-foreground">
			<main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
				<div className="flex w-full max-w-md flex-col items-center gap-8 px-8 text-center sm:px-12">
					<ThinkExLogo size={36} />
					<h1 className="text-2xl font-medium tracking-tight">{title}</h1>
					<div className="w-full">
						<AuthPanel callbackURL={callbackURL} mode={mode} />
					</div>
				</div>
			</main>
		</div>
	);
}
