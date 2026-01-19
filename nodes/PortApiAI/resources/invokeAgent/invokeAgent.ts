import type { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import {
	parseSSEResponse,
	parseJsonParameter,
	buildQueryString,
	extractResponseText,
	PROVIDER_OPTIONS,
	MODEL_OPTIONS,
} from '../../shared/utils';

export const invokeAgentOperation = {
	name: 'Invoke a Specific Agent',
	value: 'invokeAgent',
	description: 'POST /v1/agent/:agentIdentifier/invoke',
	action: 'Invoke an AI Interaction with a Specific Agent',
};

const showOnlyForInvokeAgent = {
	resource: ['agent'],
	operation: ['invokeAgent'],
};

export const invokeAgentDescription: INodeProperties[] = [
	{
		displayName: 'Agent Identifier',
		name: 'agentIdentifier',
		type: 'string',
		default: '',
		required: true,
		description: 'The agent identifier to invoke',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		default: '',
		required: true,
		description: 'Prompt string',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
		options: [
			{
				displayName: 'Context',
				name: 'context',
				type: 'json',
				default: '{}',
				description: 'Optional context object',
			},
			{
				displayName: 'Invocation Identifier',
				name: 'invocation_identifier',
				type: 'string',
				default: '',
				description: 'Optional invocation identifier',
			},
			{
				displayName: 'Labels',
				name: 'labels',
				type: 'json',
				default: '{}',
				description: 'Optional labels object',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'gpt-5',
				description: 'Model selection',
				options: MODEL_OPTIONS,
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				default: 'port',
				description: 'Optional provider',
				options: PROVIDER_OPTIONS,
			},
			{
				displayName: 'Stream',
				name: 'stream',
				type: 'boolean',
				default: false,
				description: 'Whether to stream the response',
			},
			{
				displayName: 'Use MCP',
				name: 'use_mcp',
				type: 'boolean',
				default: false,
				description: 'Whether to use MCP',
			},
		],
	},
];

export async function executeInvokeAgent(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
): Promise<IDataObject> {
	const agentIdentifier = this.getNodeParameter('agentIdentifier', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

	// Build payload from structured fields
	const payload: IDataObject = {
		prompt,
	};

	// Parse optional JSON parameters from additionalFields
	if (additionalFields.context) {
		const context = parseJsonParameter(
			additionalFields.context as string,
			this.getNode(),
			'context',
		);
		if (context) {
			payload.context = context;
		}
	}

	if (additionalFields.labels) {
		const labels = parseJsonParameter(
			additionalFields.labels as string,
			this.getNode(),
			'labels',
		);
		if (labels) {
			payload.labels = labels;
		}
	}

	if (additionalFields.provider) {
		payload.provider = additionalFields.provider as string;
	}

	if (additionalFields.model) {
		payload.model = additionalFields.model as string;
	}

	// Build query parameters from additionalFields
	const queryParams: Record<string, string | boolean> = {};
	if (additionalFields.invocation_identifier) {
		queryParams.invocation_identifier = additionalFields.invocation_identifier as string;
	}
	if (typeof additionalFields.stream === 'boolean') {
		queryParams.stream = additionalFields.stream;
	}
	if (typeof additionalFields.use_mcp === 'boolean') {
		queryParams.use_mcp = additionalFields.use_mcp;
	}
	const queryString = buildQueryString(queryParams);

	const url = `${baseUrl}/v1/agent/${encodeURIComponent(agentIdentifier)}/invoke${queryString}`;

	try {
		// The API returns Server-Sent Events (SSE) format, so we need to handle it as text first
		const rawResponse = (await this.helpers.httpRequestWithAuthentication.call(this, 'portApi', {
			method: 'POST',
			url,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: payload,
			returnFullResponse: true,
			json: false, // Don't parse as JSON, we'll handle SSE format
		})) as { body: string | string[] | IDataObject; headers: IDataObject; statusCode: number };

		// Extract and parse the SSE response
		const responseText = extractResponseText(rawResponse.body);
		return parseSSEResponse(responseText);
	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new NodeApiError(this.getNode(), {
			message: `Failed to invoke agent: ${errorMessage}`,
			description: `Agent identifier: ${agentIdentifier}. Please verify the agent identifier and your credentials are correct.`,
		});
	}
}
