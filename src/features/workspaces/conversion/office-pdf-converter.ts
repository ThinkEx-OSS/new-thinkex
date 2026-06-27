import { Container, getRandom } from "@cloudflare/containers";

const gotenbergPort = 3000;
const gotenbergLibreOfficeConvertPath = "/forms/libreoffice/convert";
const pdfContentType = "application/pdf";
const converterPoolSize = 1;

export class OfficePdfConverter extends Container {
	defaultPort = gotenbergPort;
	requiredPorts = [gotenbergPort];
	sleepAfter = "5m";
	enableInternet = false;
	envVars = {
		LIBREOFFICE_AUTO_START: "true",
		LIBREOFFICE_MAX_QUEUE_SIZE: "1",
		LIBREOFFICE_START_TIMEOUT: "60s",
	};
}

export interface ConvertOfficeFileToPdfInput {
	file: File;
	fileName: string;
}

export interface ConvertOfficeFileToPdfResult {
	bytes: ArrayBuffer;
	contentType: typeof pdfContentType;
	sizeBytes: number;
}

export class OfficePdfConversionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OfficePdfConversionError";
	}
}

export async function convertOfficeFileToPdf(
	env: Cloudflare.Env,
	input: ConvertOfficeFileToPdfInput,
): Promise<ConvertOfficeFileToPdfResult> {
	const converter = await getRandom(env.OFFICE_PDF_CONVERTER, converterPoolSize);
	await converter.startAndWaitForPorts({
		cancellationOptions: {
			portReadyTimeoutMS: 60_000,
		},
	});

	const formData = new FormData();
	formData.set("files", input.file, input.fileName);

	const response = await converter.fetch(
		new Request(`http://office-pdf-converter${gotenbergLibreOfficeConvertPath}`, {
			body: formData,
			method: "POST",
		}),
	);

	if (!response.ok) {
		throw new OfficePdfConversionError(await getConversionErrorMessage(response));
	}

	const bytes = await response.arrayBuffer();

	if (bytes.byteLength === 0) {
		throw new OfficePdfConversionError("Office file conversion returned an empty PDF.");
	}

	return {
		bytes,
		contentType: pdfContentType,
		sizeBytes: bytes.byteLength,
	};
}

async function getConversionErrorMessage(response: Response) {
	const fallback = `Office file conversion failed with status ${response.status}.`;
	const body = await response.text().catch(() => "");
	const message = body.trim();

	return message ? `${fallback} ${message}` : fallback;
}
