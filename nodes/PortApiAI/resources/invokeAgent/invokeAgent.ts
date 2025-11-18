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
		displayName: 'Context',
		name: 'context',
		type: 'json',
		default: '{}',
		description: 'Optional context object',
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
		displayName: 'Labels',
		name: 'labels',
		type: 'json',
		default: '{}',
		description: 'Optional labels object',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'options',
		default: 'port',
		description: 'Optional provider',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
		options: PROVIDER_OPTIONS,
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		default: 'gpt-5',
		description: 'Model selection',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
		options: MODEL_OPTIONS,
	},
	{
		displayName: 'Invocation Identifier',
		name: 'invocation_identifier',
		type: 'string',
		default: '',
		description: 'Optional invocation identifier',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
	{
		displayName: 'Stream',
		name: 'stream',
		type: 'boolean',
		default: false,
		description: 'Whether to stream the response',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
	{
		displayName: 'Use MCP',
		name: 'use_mcp',
		type: 'boolean',
		default: false,
		description: 'Whether to use MCP',
		displayOptions: {
			show: showOnlyForInvokeAgent,
		},
	},
];

export async function executeInvokeAgent(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	accessToken: string,
): Promise<IDataObject> {
	const agentIdentifier = this.getNodeParameter('agentIdentifier', itemIndex) as string;

	// Build payload from structured fields
	const payload: IDataObject = {};

	// Parse optional JSON parameters
	const context = parseJsonParameter(
		this.getNodeParameter('context', itemIndex, '{}') as string,
	);
	if (context) {
		payload.context = context;
	}

	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	payload.prompt = prompt;

	const labels = parseJsonParameter(
		this.getNodeParameter('labels', itemIndex, '{}') as string,
	);
	if (labels) {
		payload.labels = labels;
	}

	const provider = this.getNodeParameter('provider', itemIndex, '') as string;
	if (provider) {
		payload.provider = provider;
	}

	const model = this.getNodeParameter('model', itemIndex, '') as string;
	if (model) {
		payload.model = model;
	}

	// Build query parameters
	const queryString = buildQueryString({
		invocation_identifier: this.getNodeParameter('invocation_identifier', itemIndex, '') as string,
		stream: this.getNodeParameter('stream', itemIndex, false) as boolean,
		use_mcp: this.getNodeParameter('use_mcp', itemIndex, false) as boolean,
	});

	const url = `${baseUrl}/v1/agent/${encodeURIComponent(agentIdentifier)}/invoke${queryString}`;

	try {
		// The API returns Server-Sent Events (SSE) format, so we need to handle it as text first
		const rawResponse = (await this.helpers.httpRequest({
			method: 'POST',
			url,
			headers: {
				Authorization: `Bearer ${accessToken}`,
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
