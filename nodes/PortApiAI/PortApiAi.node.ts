import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionTypes,
	NodeOperationError,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import {
	invokeAgentDescription,
	executeInvokeAgent,
} from './resources/invokeAgent/invokeAgent';
import {
	generalInvokeDescription,
	executeGeneralInvoke,
} from './resources/generalInvoke/generalInvoke';
import {
	getInvocationDescription,
	executeGetInvocation,
} from './resources/getInvocation/getInvocation';
import { getAccessToken, normalizeBaseUrl } from './shared/utils';

/**
 * Map of operation values to their execution functions
 */
const operationMap: Record<
	string,
	(
		this: IExecuteFunctions,
		itemIndex: number,
		baseUrl: string,
		accessToken: string,
	) => Promise<IDataObject>
> = {
	invokeAgent: executeInvokeAgent,
	generalInvoke: executeGeneralInvoke,
	getInvocation: executeGetInvocation,
};

export class PortApiAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Port API AI',
		name: 'portApiAi',
		icon: { light: 'file:../../icons/port.svg', dark: 'file:../../icons/port.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description:
			'Invoke Port AI agents, call general AI interactions, and fetch invocation results',
		defaults: {
			name: 'Port API AI',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'portApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Agent',
						value: 'agent',
						description: 'Interact with Port AI agents',
					},
					{
						name: 'AI Interaction',
						value: 'aiInteraction',
						description: 'General-purpose AI interactions and invocation results',
					},
				],
				default: 'agent',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['agent'],
					},
				},
				options: [
					{
						name: 'Invoke',
						value: 'invokeAgent',
						description: 'Invoke a specific agent',
						action: 'Invoke an agent',
					},
				],
				default: 'invokeAgent',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['aiInteraction'],
					},
				},
				options: [
					{
						name: 'Invoke',
						value: 'generalInvoke',
						description: 'General-purpose AI interaction',
						action: 'Invoke AI interaction',
					},
					{
						name: 'Get Result',
						value: 'getInvocation',
						description: 'Get invocation result',
						action: 'Get invocation result',
					},
				],
				default: 'generalInvoke',
			},
			...invokeAgentDescription,
			...generalInvokeDescription,
			...getInvocationDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('portApi');
		const baseUrl = normalizeBaseUrl(
			(credentials.baseUrl as string) || 'https://api.getport.io',
		);
		const clientId = credentials.clientId as string;
		const clientSecret = credentials.clientSecret as string;

		const accessToken = await getAccessToken.call(this, baseUrl, clientId, clientSecret);

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			const executeFunction = operationMap[operation];
			if (!executeFunction) {
				throw new NodeOperationError(this.getNode(), {
					message: `Unknown operation: ${operation}`,
					description: `Please select a valid operation. Available operations: ${Object.keys(operationMap).join(', ')}`,
				});
			}

			const responseData = await executeFunction.call(this, i, baseUrl, accessToken);
			returnData.push({ json: responseData });
		}

		return [returnData];
	}
}
