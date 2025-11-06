import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class PortIoApi implements ICredentialType {
  name = 'portIoApi';
  displayName = 'Port.io API';
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
      description: 'API base without version. The node appends /v1 to routes. EU: https://api.getport.io, US: https://api.us.getport.io',
    },
  ];
}
