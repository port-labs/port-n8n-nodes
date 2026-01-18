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
	name: 'Invoke an AI Interaction',
	value: 'generalInvoke',
	description: 'POST /v1/ai/invoke',
	action: 'Invoke a General-Purpose AI Interaction',
};

const showOnlyForGeneralInvoke = {
	resource: ['aiInteraction'],
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
		default: '["^(list|get|search|track|describe|count|run_*)_.*"]',
		required: true,
		description: 'Array of tool names as JSON string. Supports regex patterns (e.g., ["tool1", "tool2"] or ["^(list|get|search|track|describe|run_*)_.*"]). The default matches multiple tool names using a regex.',
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForGeneralInvoke,
		},
		options: [
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
				default: 'claude-sonnet-4-20250514',
				description: 'Optional model',
				options: MODEL_OPTIONS,
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				default: 'openai',
				description: 'Optional provider',
				options: PROVIDER_OPTIONS,
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				default: '',
				description: 'Optional system prompt',
			},
		],
	},
];

export async function executeGeneralInvoke(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	accessToken: string,
): Promise<IDataObject> {
	const userPrompt = this.getNodeParameter('userPrompt', itemIndex) as string;
	const toolsParam = this.getNodeParameter('tools', itemIndex) as string;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

	// Build payload from structured fields
	const payload: IDataObject = {
		userPrompt,
	};

	// Parse tools JSON array (required)
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

	// Parse optional JSON parameters from additionalFields
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

	if (additionalFields.systemPrompt) {
		payload.systemPrompt = additionalFields.systemPrompt as string;
	}

	if (additionalFields.executionMode) {
		payload.executionMode = additionalFields.executionMode as string;
	}

	// Build query parameters from additionalFields
	const queryParams: Record<string, string | boolean> = {};
	if (additionalFields.invocation_identifier) {
		queryParams.invocation_identifier = additionalFields.invocation_identifier as string;
	}
	const queryString = buildQueryString(queryParams);

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
