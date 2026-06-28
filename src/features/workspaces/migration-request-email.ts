import {
	escapeHtml,
	getEmailSender,
	getTransactionalFromEmail,
	TRANSACTIONAL_FROM_NAME,
} from "#/lib/transactional-email";

const MIGRATION_REQUEST_INBOX = "hello@thinkx.app";

export type WorkspaceMigrationRequestEmailFailureReason = "missing_binding" | "send_failed";

export interface WorkspaceMigrationRequestEmailSuccess {
	ok: true;
}

export interface WorkspaceMigrationRequestEmailFailure {
	ok: false;
	reason: WorkspaceMigrationRequestEmailFailureReason;
}

export type WorkspaceMigrationRequestEmailOutcome =
	| WorkspaceMigrationRequestEmailSuccess
	| WorkspaceMigrationRequestEmailFailure;

export function buildWorkspaceMigrationRequestEmailContent(input: {
	userId: string;
	userEmail: string;
	userName: string | null;
	workspaceCount: number;
}) {
	const displayName = input.userName?.trim() || "No name on account";
	const subject = `ThinkEx migration request: ${input.userEmail}`;
	const text = [
		"A signed-in ThinkEx user requested a manual workspace migration.",
		"",
		`Email: ${input.userEmail}`,
		`Name: ${displayName}`,
		`User ID: ${input.userId}`,
		`Current workspace count: ${input.workspaceCount}`,
	].join("\n");
	const html = [
		"<p>A signed-in ThinkEx user requested a manual workspace migration.</p>",
		"<ul>",
		`<li><strong>Email:</strong> ${escapeHtml(input.userEmail)}</li>`,
		`<li><strong>Name:</strong> ${escapeHtml(displayName)}</li>`,
		`<li><strong>User ID:</strong> ${escapeHtml(input.userId)}</li>`,
		`<li><strong>Current workspace count:</strong> ${input.workspaceCount}</li>`,
		"</ul>",
	].join("");

	return { subject, text, html };
}

export async function sendWorkspaceMigrationRequestEmail(input: {
	userId: string;
	userEmail: string;
	userName: string | null;
	workspaceCount: number;
}): Promise<WorkspaceMigrationRequestEmailOutcome> {
	const emailSender = getEmailSender();

	if (!emailSender) {
		console.warn("[WorkspaceMigrationRequestEmail] EMAIL binding is not configured");
		return { ok: false, reason: "missing_binding" };
	}

	const content = buildWorkspaceMigrationRequestEmailContent(input);

	try {
		await emailSender.send({
			to: MIGRATION_REQUEST_INBOX,
			from: {
				email: getTransactionalFromEmail(),
				name: TRANSACTIONAL_FROM_NAME,
			},
			replyTo: input.userEmail,
			subject: content.subject,
			html: content.html,
			text: content.text,
		});
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown send error";
		const code = error instanceof Error && "code" in error ? String(error.code) : undefined;

		console.warn("[WorkspaceMigrationRequestEmail] Send failed", {
			email: input.userEmail,
			code,
			message,
		});

		return { ok: false, reason: "send_failed" };
	}
}
