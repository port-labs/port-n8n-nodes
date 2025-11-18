import {
	IDataObject,
	IExecuteFunctions,
	NodeApiError,
	type INodePropertyOptions,
} from 'n8n-workflow';

/**
 * Provider options for AI operations
 */
export const PROVIDER_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Anthropic',
		value: 'anthropic',
	},
	{
		name: 'Azure OpenAI',
		value: 'azure-openai',
	},
	{
		name: 'Bedrock',
		value: 'bedrock',
	},
	{
		name: 'OpenAI',
		value: 'openai',
	},
	{
		name: 'Port',
		value: 'port',
	},
];

/**
 * Model options for AI operations
 */
export const MODEL_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'GPT-5',
		value: 'gpt-5',
	},
	{
		name: 'Claude Sonnet 4',
		value: 'claude-sonnet-4-20250514',
	},
	{
		name: 'Claude Haiku 4.5',
		value: 'claude-haiku-4-5-20251001',
	},
];

/**
 * Parse Server-Sent Events (SSE) format response
 * @param sseText The raw SSE text response
 * @returns Parsed object with invocationIdentifier, events, and final data
 */
export function parseSSEResponse(sseText: string): IDataObject {
	const events: Array<{ type: string; data: string }> = [];
	const executionMessages: string[] = [];
	let invocationIdentifier: string | null = null;
	let finalData: IDataObject | string | null = null;

	// Split by double newlines to get individual events
	const eventBlocks = sseText.split('\n\n').filter((block) => block.trim());

	for (const block of eventBlocks) {
		const lines = block.split('\n');
		let eventType: string | null = null;
		const dataLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith('event: ')) {
				eventType = line.substring(7).trim();
			} else if (line.startsWith('data: ')) {
				// Collect all data lines - multiple data lines should be concatenated
				dataLines.push(line.substring(6).trim());
			}
		}

		// Concatenate all data lines with newlines (SSE spec)
		const eventData = dataLines.join('\n');

		if (eventType && eventData) {
			if (eventType === 'invocationIdentifier') {
				invocationIdentifier = eventData;
			} else if (eventType === 'execution') {
				executionMessages.push(eventData);
			} else if (eventType === 'done') {
				try {
					finalData = JSON.parse(eventData) as IDataObject;
				} catch {
					finalData = eventData;
				}
			}
			events.push({ type: eventType, data: eventData });
		}
	}

	// Concatenate all data from all events into a single string
	const allData = events.map((e) => e.data).join('\n');

	return {
		invocationIdentifier,
		events,
		executionMessages,
		finalData,
		// For convenience, also include concatenated execution messages
		executionMessage: executionMessages.join('\n'),
		// Single concatenated string of all data from all events
		data: allData,
	};
}

/**
 * Normalize base URL by removing trailing slashes and /v1 suffix
 * @param baseUrl The base URL to normalize
 * @returns Normalized base URL
 */
export function normalizeBaseUrl(baseUrl: string): string {
	let normalized = baseUrl.trim();
	if (normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}
	if (normalized.endsWith('/v1')) {
		normalized = normalized.slice(0, -3);
	}
	return normalized;
}

/**
 * Parse JSON parameter safely, returning null if invalid or empty
 * @param jsonString The JSON string to parse
 * @returns Parsed object or null if invalid/empty
 */
export function parseJsonParameter(jsonString: string): IDataObject | null {
	if (!jsonString || !jsonString.trim() || jsonString === '{}') {
		return null;
	}
	try {
		const parsed = JSON.parse(jsonString);
		if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Build query string from parameters
 * @param params Object with parameter names and values
 * @returns Query string (e.g., "?param1=value1&param2=value2") or empty string
 */
export function buildQueryString(params: Record<string, string | boolean>): string {
	const queryParams: string[] = [];
	for (const [key, value] of Object.entries(params)) {
		if (typeof value === 'boolean') {
			if (value) {
				queryParams.push(`${key}=true`);
			}
		} else if (value) {
			queryParams.push(`${key}=${encodeURIComponent(value)}`);
		}
	}
	return queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
}

/**
 * Extract response text from HTTP response body
 * Handles different response formats (string, array, or object)
 * @param body The response body from httpRequest
 * @returns Extracted text string
 */
export function extractResponseText(
	body: string | string[] | IDataObject,
): string {
	if (typeof body === 'string') {
		return body;
	}
	if (Array.isArray(body)) {
		// If it's an array, join all elements (usually just one element with all SSE data)
		return body.join('\n\n');
	}
	// If it's already an object, stringify it
	return JSON.stringify(body);
}

export async function getAccessToken(
	this: IExecuteFunctions,
	baseUrl: string,
	clientId: string,
	clientSecret: string,
): Promise<string> {
	const baseUrlCleaned = normalizeBaseUrl(baseUrl);
	const tokenUrl = `${baseUrlCleaned}/v1/auth/access_token`;

	try {
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: tokenUrl,
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: { clientId, clientSecret },
			json: true,
		})) as IDataObject;

		// According to Swagger, response has accessToken (camelCase)
		const accessToken = response.accessToken as string;

		if (!accessToken) {
			throw new NodeApiError(this.getNode(), {
				message: `Failed to obtain access token. Response: ${JSON.stringify(response)}`,
			});
		}

		return accessToken;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new NodeApiError(this.getNode(), {
			message:
				`Failed to obtain access token from ${tokenUrl}. Error: ${errorMessage}. ` +
				`Please verify your base URL (${baseUrl}) and credentials are correct.`,
		});
	}
}

