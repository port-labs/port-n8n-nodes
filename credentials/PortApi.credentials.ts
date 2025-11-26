import type {
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PortApi implements ICredentialType {
	name = 'portApi';

	displayName = 'Port API';

	icon: Icon = { light: 'file:../icons/port.svg', dark: 'file:../icons/port.dark.svg' };

	documentationUrl = 'https://docs.port.io/api-reference/';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Port Client ID',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Port Client Secret',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.getport.io',
			description:
				'API base without version. The node appends /v1 to routes. EU: https://api.getport.io, US: https://api.us.getport.io',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl || "https://api.getport.io" }}',
			url: '/v1/auth/access_token',
			method: 'POST',
			body: {
				clientId: '={{ $credentials.clientId }}',
				clientSecret: '={{ $credentials.clientSecret }}',
			},
		},
	};
}
