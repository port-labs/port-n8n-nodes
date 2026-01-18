import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
	Icon,
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
		{
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
				password: true,
			},
			default: '',
		},
	];

	async preAuthentication(
		this: IHttpRequestHelper,
		credentials: ICredentialDataDecryptedObject,
	) {
		// Normalize base URL (remove trailing slash and /v1)
		let baseUrl = (credentials.baseUrl as string) || 'https://api.getport.io';
		baseUrl = baseUrl.trim();
		if (baseUrl.endsWith('/')) {
			baseUrl = baseUrl.slice(0, -1);
		}
		if (baseUrl.endsWith('/v1')) {
			baseUrl = baseUrl.slice(0, -3);
		}

		const tokenUrl = `${baseUrl}/v1/auth/access_token`;

		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: tokenUrl,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: {
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
			},
			json: true,
		})) as { accessToken: string };

		return { sessionToken: response.accessToken };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
			},
		},
	};

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
