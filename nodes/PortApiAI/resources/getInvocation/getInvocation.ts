import type { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const getInvocationOperation = {
	name: "Get an Invocation's Result",
	value: 'getInvocation',
	description: 'GET /v1/ai/invoke/:invocation_identifier',
	action: 'Get The Result of an AI Interaction Invocation',
};

const showOnlyForGetInvocation = {
	operation: ['getInvocation'],
};

export const getInvocationDescription: INodeProperties[] = [
	{
		displayName: 'Invocation Identifier',
		name: 'invocation_identifier',
		type: 'string',
		default: '',
		required: true,
		description: 'The invocation identifier to fetch',
		displayOptions: {
			show: showOnlyForGetInvocation,
		},
	},
];

export async function executeGetInvocation(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	accessToken: string,
): Promise<IDataObject> {
	const invocationIdentifier = this.getNodeParameter('invocation_identifier', itemIndex) as string;

	try {
		return (await this.helpers.httpRequest({
			method: 'GET',
			url: `${baseUrl}/v1/ai/invoke/${encodeURIComponent(invocationIdentifier)}`,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
			},
			json: true,
		})) as IDataObject;
	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new NodeApiError(this.getNode(), {
			message: `Failed to get invocation result: ${errorMessage}`,
			description: `Invocation identifier: ${invocationIdentifier}. Please verify the invocation identifier exists and your credentials are correct.`,
		});
	}
}
