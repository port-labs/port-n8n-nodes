import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

/**
 * Parse Server-Sent Events (SSE) format response
 * @param sseText The raw SSE text response
 * @returns Parsed object with invocationIdentifier, events, and final data
 */
function parseSSEResponse(sseText: string): IDataObject {
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

async function getAccessToken(
	this: IExecuteFunctions,
	baseUrl: string,
	clientId: string,
	clientSecret: string,
): Promise<string> {
	// Base URL should not contain /v1/, remove it if present and clean trailing slashes
	let baseUrlCleaned = baseUrl.trim();
	if (baseUrlCleaned.endsWith('/')) {
		baseUrlCleaned = baseUrlCleaned.slice(0, -1);
	}
	if (baseUrlCleaned.endsWith('/v1')) {
		baseUrlCleaned = baseUrlCleaned.slice(0, -3);
	}
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

export class PortIo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Port.io',
		name: 'portIo',
		icon: 'file:port.svg',
		group: ['transform'],
		version: 1,
		description:
			'Invoke Port AI agents, call general AI interactions, and fetch invocation results',
		defaults: { name: 'Port.io' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'portIoApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Invoke a Specific Agent',
						value: 'invokeAgent',
						description: 'POST /v1/agent/:agentIdentifier/invoke',
						action: 'Post v1 agent agent identifier invoke',
					},
					{
						name: 'General-Purpose AI Interactions',
						value: 'generalInvoke',
						description: 'POST /v1/ai/invoke',
						action: 'Post v1 ai invoke',
					},
					{
						name: "Get an Invocation's Result",
						value: 'getInvocation',
						description: 'GET /v1/ai/invoke/:invocation_identifier',
						action: 'Get v1 ai invoke invocation identifier',
					},
				],
				default: 'invokeAgent',
			},

			{
				displayName: 'Additional Headers',
				name: 'additionalHeaders',
				type: 'fixedCollection',
				placeholder: 'Add Header',
				default: {},
				options: [
					{
						displayName: 'Headers',
						name: 'headers',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},

			// invokeAgent
			{
				displayName: 'Agent Identifier',
				name: 'agentIdentifier',
				type: 'string',
				default: '',
				required: true,
				description: 'The agent identifier to invoke',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'json',
				default: '{}',
				description: 'Optional context object',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				description: 'Optional prompt string',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},
			{
				displayName: 'Labels',
				name: 'labels',
				type: 'json',
				default: '{}',
				description: 'Optional labels object',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'string',
				default: 'port',
				description: 'Optional provider (e.g., "port")',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: '',
				description: 'Optional model (e.g., "gpt-5")',
				displayOptions: { show: { operation: ['invokeAgent'] } },
			},

			// generalInvoke
			{
				displayName: 'User Prompt',
				name: 'userPrompt',
				type: 'string',
				default: '',
				required: true,
				description: 'The user prompt (required)',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'Tools',
				name: 'tools',
				type: 'string',
				default: '',
				required: true,
				description: 'Array of tool names as JSON string (e.g., ["tool1", "tool2"])',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'Labels',
				name: 'generalLabels',
				type: 'json',
				default: '{}',
				description: 'Optional labels object',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'Provider',
				name: 'generalProvider',
				type: 'string',
				default: 'openai',
				description: 'Optional provider (e.g., "openai")',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'Model',
				name: 'generalModel',
				type: 'string',
				default: '',
				description: 'Optional model (e.g., "gpt-5")',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				default: '',
				description: 'Optional system prompt',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},
			{
				displayName: 'Execution Mode',
				name: 'executionMode',
				type: 'options',
				default: 'Automatic',
				options: [
					{ name: 'Automatic', value: 'Automatic' },
					{ name: 'Approval Required', value: 'Approval Required' },
				],
				description: 'Optional execution mode',
				displayOptions: { show: { operation: ['generalInvoke'] } },
			},

			// getInvocation
			{
				displayName: 'Invocation Identifier',
				name: 'invocationId',
				type: 'string',
				default: '',
				required: true,
				description: 'The invocation identifier to fetch',
				displayOptions: { show: { operation: ['getInvocation'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('portIoApi');
		// Base URL should not contain /v1/, remove it if present and clean trailing slashes
		let baseUrl = (credentials.baseUrl as string) || 'https://api.getport.io';
		baseUrl = baseUrl.trim();
		if (baseUrl.endsWith('/')) {
			baseUrl = baseUrl.slice(0, -1);
		}
		if (baseUrl.endsWith('/v1')) {
			baseUrl = baseUrl.slice(0, -3);
		}
		const clientId = credentials.clientId as string;
		const clientSecret = credentials.clientSecret as string;

		const accessToken = await getAccessToken.call(this, baseUrl, clientId, clientSecret);

		const headerPairs = this.getNodeParameter('additionalHeaders.headers', 0, []) as Array<{
			name: string;
			value: string;
		}>;
		const extraHeaders = (headerPairs || []).reduce<Record<string, string>>((acc, h) => {
			if (h.name) acc[h.name] = h.value ?? '';
			return acc;
		}, {});

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: IDataObject | IDataObject[] | string = {};

			if (operation === 'invokeAgent') {
				const agentIdentifier = this.getNodeParameter('agentIdentifier', i) as string;

				// Build payload from structured fields
				const payload: IDataObject = {};

				const contextParam = this.getNodeParameter('context', i, '{}') as string;
				if (contextParam && contextParam.trim() && contextParam !== '{}') {
					try {
						const parsed = JSON.parse(contextParam);
						if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
							payload.context = parsed;
						}
					} catch {
						// If parsing fails, skip context
					}
				}

				const prompt = this.getNodeParameter('prompt', i, '') as string;
				if (prompt) {
					payload.prompt = prompt;
				}

				const labelsParam = this.getNodeParameter('labels', i, '{}') as string;
				if (labelsParam && labelsParam.trim() && labelsParam !== '{}') {
					try {
						const parsed = JSON.parse(labelsParam);
						if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
							payload.labels = parsed;
						}
					} catch {
						// If parsing fails, skip labels
					}
				}

				const provider = this.getNodeParameter('provider', i, '') as string;
				if (provider) {
					payload.provider = provider;
				}

				const model = this.getNodeParameter('model', i, '') as string;
				if (model) {
					payload.model = model;
				}

				// The API returns Server-Sent Events (SSE) format, so we need to handle it as text first
				const rawResponse = (await this.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/v1/agent/${encodeURIComponent(agentIdentifier)}/invoke`,
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: 'application/json',
						'Content-Type': 'application/json',
						...extraHeaders,
					},
					body: payload,
					returnFullResponse: true,
					json: false, // Don't parse as JSON, we'll handle SSE format
				})) as { body: string | string[] | IDataObject; headers: IDataObject; statusCode: number };

				// Handle different response formats - could be string, array of strings, or already parsed
				let responseText: string;
				if (typeof rawResponse.body === 'string') {
					responseText = rawResponse.body;
				} else if (Array.isArray(rawResponse.body)) {
					// If it's an array, join all elements (usually just one element with all SSE data)
					responseText = rawResponse.body.join('\n\n');
				} else {
					// If it's already an object, stringify it
					responseText = JSON.stringify(rawResponse.body);
				}

				// Parse the SSE response
				responseData = parseSSEResponse(responseText);
			}

			if (operation === 'generalInvoke') {
				// Build payload from structured fields
				const payload: IDataObject = {};

				const userPrompt = this.getNodeParameter('userPrompt', i) as string;
				payload.userPrompt = userPrompt;

				const toolsParam = this.getNodeParameter('tools', i) as string;
				try {
					payload.tools = JSON.parse(toolsParam);
				} catch {
					throw new NodeOperationError(this.getNode(), {
						message: 'Tools must be a valid JSON array (e.g., ["tool1", "tool2"])',
					});
				}

				const labelsParam = this.getNodeParameter('generalLabels', i, '{}') as string;
				if (labelsParam && labelsParam.trim() && labelsParam !== '{}') {
					try {
						const parsed = JSON.parse(labelsParam);
						if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
							payload.labels = parsed;
						}
					} catch {
						// If parsing fails, skip labels
					}
				}

				const provider = this.getNodeParameter('generalProvider', i, '') as string;
				if (provider) {
					payload.provider = provider;
				}

				const model = this.getNodeParameter('generalModel', i, '') as string;
				if (model) {
					payload.model = model;
				}

				const systemPrompt = this.getNodeParameter('systemPrompt', i, '') as string;
				if (systemPrompt) {
					payload.systemPrompt = systemPrompt;
				}

				const executionMode = this.getNodeParameter('executionMode', i, '') as string;
				if (executionMode) {
					payload.executionMode = executionMode;
				}

				// The API returns Server-Sent Events (SSE) format, so we need to handle it as text first
				const rawResponse = (await this.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/v1/ai/invoke`,
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: 'application/json',
						'Content-Type': 'application/json',
						...extraHeaders,
					},
					body: payload,
					returnFullResponse: true,
					json: false, // Don't parse as JSON, we'll handle SSE format
				})) as { body: string | string[] | IDataObject; headers: IDataObject; statusCode: number };

				// Handle different response formats - could be string, array of strings, or already parsed
				let responseText: string;
				if (typeof rawResponse.body === 'string') {
					responseText = rawResponse.body;
				} else if (Array.isArray(rawResponse.body)) {
					// If it's an array, join all elements (usually just one element with all SSE data)
					responseText = rawResponse.body.join('\n\n');
				} else {
					// If it's already an object, stringify it
					responseText = JSON.stringify(rawResponse.body);
				}

				// Parse the SSE response
				responseData = parseSSEResponse(responseText);
			}

			if (operation === 'getInvocation') {
				const invocationId = this.getNodeParameter('invocationId', i) as string;

				responseData = (await this.helpers.httpRequest({
					method: 'GET',
					url: `${baseUrl}/v1/ai/invoke/${encodeURIComponent(invocationId)}`,
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: 'application/json',
						...extraHeaders,
					},
					json: true,
				})) as IDataObject;
			}

			returnData.push({ json: responseData as IDataObject });
		}

		return [returnData];
	}
}
