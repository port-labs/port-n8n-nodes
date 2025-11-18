import type { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeOperationError, NodeApiError } from 'n8n-workflow';
import {
	parseSSEResponse,
	parseJsonParameter,
	buildQueryString,
	extractResponseText,
	PROVIDER_OPTIONS,
	MODEL_OPTIONS,
} from '../../shared/utils';

export const generalInvokeOperation = {
	name: 'General-Purpose AI Interactions',
	value: 'generalInvoke',
	description: 'POST /v1/ai/invoke',
	action: 'Invoke a General-Purpose AI Interaction',
};

const showOnlyForGeneralInvoke = {
	operation: ['generalInvoke'],
};

export const generalInvokeDescription: INodeProperties[] = [
	{
		displayName: 'User Prompt',
		name: 'userPrompt',
		type: 'string',
		default: '',
		required: true,
		description: 'The user prompt (required)',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Tools',
		name: 'tools',
		type: 'string',
		default: '["^(list|get|search|track|describe|run_*)_.*"]',
		required: true,
		description: 'Array of tool names as JSON string (e.g., ["tool1", "tool2"])',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Labels',
		name: 'generalLabels',
		type: 'json',
		default: '{}',
		description: 'Optional labels object',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Provider',
		name: 'generalProvider',
		type: 'options',
		default: 'openai',
		description: 'Optional provider',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
		options: PROVIDER_OPTIONS,
	},
	{
		displayName: 'Model',
		name: 'generalModel',
		type: 'options',
		default: 'gpt-5',
		description: 'Optional model',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
		options: MODEL_OPTIONS,
	},
	{
		displayName: 'System Prompt',
		name: 'systemPrompt',
		type: 'string',
		default: '',
		description: 'Optional system prompt',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Execution Mode',
		name: 'executionMode',
		type: 'options',
		default: 'Approval Required',
		options: [
			{ name: 'Automatic', value: 'Automatic' },
			{ name: 'Approval Required', value: 'Approval Required' },
		],
		description: 'Optional execution mode',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Invocation Identifier',
		name: 'invocation_identifier',
		type: 'string',
		default: '',
		description: 'Optional invocation identifier',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
];

export async function executeGeneralInvoke(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	accessToken: string,
): Promise<IDataObject> {
	// Build payload from structured fields
	const payload: IDataObject = {};

	const userPrompt = this.getNodeParameter('userPrompt', itemIndex) as string;
	payload.userPrompt = userPrompt;

	// Parse tools JSON array (required)
	const toolsParam = this.getNodeParameter('tools', itemIndex) as string;
	try {
		const parsed = JSON.parse(toolsParam);
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(this.getNode(), {
				message: 'Tools must be a valid JSON array',
				description:
					'The Tools field must contain a JSON array of tool names. Example: ["tool1", "tool2"] or ["^(list|get|search|track|describe|run_*)_.*"]',
			});
		}
		payload.tools = parsed;
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}
		throw new NodeOperationError(this.getNode(), {
			message: 'Invalid JSON format for Tools field',
			description:
				'The Tools field must be a valid JSON array. Example: ["tool1", "tool2"] or ["^(list|get|search|track|describe|run_*)_.*"]',
		});
	}

	// Parse optional JSON parameters
	const labels = parseJsonParameter(
		this.getNodeParameter('generalLabels', itemIndex, '{}') as string,
	);
	if (labels) {
		payload.labels = labels;
	}

	const provider = this.getNodeParameter('generalProvider', itemIndex, '') as string;
	if (provider) {
		payload.provider = provider;
	}

	const model = this.getNodeParameter('generalModel', itemIndex, '') as string;
	if (model) {
		payload.model = model;
	}

	const systemPrompt = this.getNodeParameter('systemPrompt', itemIndex, '') as string;
	if (systemPrompt) {
		payload.systemPrompt = systemPrompt;
	}

	const executionMode = this.getNodeParameter('executionMode', itemIndex, '') as string;
	if (executionMode) {
		payload.executionMode = executionMode;
	}

	// Build query parameters
	const queryString = buildQueryString({
		invocation_identifier: this.getNodeParameter('invocation_identifier', itemIndex, '') as string,
	});

	const url = `${baseUrl}/v1/ai/invoke${queryString}`;

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
			message: `Failed to invoke general AI interaction: ${errorMessage}`,
			description: 'Please verify your credentials and that the required fields (User Prompt and Tools) are correctly formatted.',
		});
	}
}
