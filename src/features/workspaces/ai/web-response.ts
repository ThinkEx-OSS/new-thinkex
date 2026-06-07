export interface ResponseBodyText {
	text: string;
	truncated: boolean;
}

export async function readResponseText(
	response: Response,
	maxBytes: number,
): Promise<ResponseBodyText> {
	if (!response.body) {
		return { text: "", truncated: false };
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	let truncated = false;

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		const remaining = maxBytes - received;

		if (remaining <= 0) {
			truncated = true;
			break;
		}

		const chunk =
			value.byteLength > remaining ? value.slice(0, remaining) : value;
		chunks.push(chunk);
		received += chunk.byteLength;

		if (value.byteLength > remaining) {
			truncated = true;
			break;
		}
	}

	await reader.cancel().catch(() => undefined);

	return {
		text: new TextDecoder().decode(concatBytes(chunks, received)),
		truncated,
	};
}

export function responseMetadata(response: Response, url?: URL) {
	return {
		browserMsUsed: response.headers.get("x-browser-ms-used"),
		contentLength: getContentLength(response),
		contentType: response.headers.get("content-type"),
		status: response.status,
		statusText: response.statusText,
		url: url?.toString() ?? response.url,
	};
}

export function isRedirect(status: number) {
	return status >= 300 && status < 400;
}

export function isTextLikeContentType(contentType: string) {
	const normalized = contentType.toLowerCase();

	return (
		normalized.startsWith("text/") ||
		normalized.includes("json") ||
		normalized.includes("xml") ||
		normalized.includes("javascript") ||
		normalized.includes("x-www-form-urlencoded")
	);
}

function concatBytes(chunks: Uint8Array[], length: number) {
	const bytes = new Uint8Array(length);
	let offset = 0;

	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes;
}

function getContentLength(response: Response) {
	const contentLength = response.headers.get("content-length");
	const parsed = contentLength ? Number(contentLength) : undefined;

	return Number.isFinite(parsed) ? parsed : undefined;
}
