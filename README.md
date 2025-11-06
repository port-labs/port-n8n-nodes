# n8n-nodes-portio

Port.io n8n nodes, for interacting with Port through n8n. As of **November 2025** the focus is highly on supporting AI interactions (as opposed to other REST calls). As the project matures the number of node types may grow as we create an easy way for customers of n8n and Port to create workflows that bring together multiple tools.

## Installing on n8n

### Installation Pre-requisites

- `pnmp` intalled
- A working n8n instance (if you don't have this, there's a super simple guide using docker compose [here](https://medium.com/@learning.by.playing.2023/getting-started-n8n-with-dockercompose-eb602aaed5c0))

### Cloning

- Clone this repository in to $n8n_HOME/custom
- Create the folder if it doesn't exist, if using the guide suggested you'd do `mkdir -p ./n8n-data/custom && cd ./n8n-data/custom` and then `git clone` this repo

### Installing and building

Next we'll installed the required dependencies and compile the Typescript so it can be used by n8n.

```bash
pnpm install
pnpm build
```

If all was successful you'll now see a `dist` directory.

## Quick start

### Adding a node

1. On your running n8n instance create a new workflow.  

   ![Create workflow](docs/images/adding_node/1_create_workflow.png)

2. For testing purposes set the trigger to "Trigger Manually" and you'll be able to trigger by clicking.  

   ![Trigger workflow](docs/images/adding_node/2_trigger.png)

3. On the left hand side of the screen click the plus (+) button to add a new node, search for `port`.  

   ![Search for port](docs/images/adding_node/3_search.png)

4. Click the Port.io search result and select "General Purpose AI Interaction" (for ease of testing), it will pop up, close the popup and get back to your workflow.  

   ![Select node](docs/images/adding_node/4_general.png)

5. Connect your trigger with your AI node by dragging from the + icon on the trigger to the left side of the AI node.  

   ![Connect nodes](docs/images/adding_node/5_connect.png)

:partying_face: You've deployed your first Port n8n node! 🥳

### Adding your account

It's possible to store multiple account credentials in n8n for use with the Port nodes, but we'll just start with one.

#### Account Pre-requisites

It's possible to store multiple account credentials in n8n for use with the Port nodes, but we'll just start with one.

- A working Port.io account with AI features enabled
- Access to credentials

1. Double click your Port AI node and at the top you'll see a dropdown named "Credential to connect with", click this and then click "Create new credential".  

   ![Creating new credential](docs/images/adding_credentials/1_create.png)

2. Grab your `client id` and `client secret` from Port ([see here](https://docs.port.io/build-your-software-catalog/custom-integration/api/) if you're not sure how to do that) and enter it in to n8n, finally click "Save".  

   > [!NOTE]  
   > For now the Port n8n nodes do not support JWT authentication, it is not really suitable for long-term storage of credentials, whereas Oauth credentials are.

   ![Saving credentials](docs/images/adding_credentials/2_save.png)

### (Finally) Running the node

#### Pre-requisites for running the nodes

- Manual trigger node created and connected to Port node
- Port credentials saved in node
- AI must be enabled on the Port account

1. Double click your AI node and make sure the parameters match the below (feel free to change the user prompt if you like).  

   ![Adding parameters](docs/images/first_prompt/1_params.png)

2. Exit the node config screen, on the left click, on your trigger node click "Execute flow" and if successful you'll see a tick on your Port node, double click it to review the response. If everything went according to plan you should see a response to your prompt in the output which you can use in later nodes.  

   ![Results](docs/images/first_prompt/2_result.png)

🥳 You're now an AI expert! 🥳

## Implemented paths

> [!NOTE]  
> As of November 2025 the only supported prompts are AI prompts, please open issues and pull requests to add more n8n<->Port interactions.

| Method | Path | Purpose | Path Params (required) | Body – **required** | Body – optional / defaults | Notes & Allowed Values | Success Response |
|---|---|---|---|---|---|---|---|
| `POST` | `/v1/agent/:agentIdentifier/invoke` | Invoke a specific agent | `agentIdentifier` (string) | — | `context` (object), `prompt` (string), `labels` (object), `provider` (string), `model` (string) | **provider**: `openai` \| `azure-openai` \| `anthropic` \| `bedrock` \| `port` • **model**: `gpt-5` \| `claude-sonnet-4-20250514` | JSON result from agent invocation |
| `POST` | `/v1/ai/invoke` | General-purpose AI interaction | — | `invocation_identifier` (string), `userPrompt` (string), `tools` (string[]) | `labels` (object), `provider` (string), `model` (string), `systemPrompt` (string, default `""`), `executionMode` (string, default `Approval Required`) | **provider**: `openai` \| `azure-openai` \| `anthropic` \| `bedrock` \| `port` • **model**: `gpt-5` \| `claude-sonnet-4-20250514` • **executionMode**: `Automatic` \| `Approval Required` | JSON result for the invocation request |
| `GET` | `/v1/ai/invoke/:invocation_identifier` | Get an invocation’s result | `invocation_identifier` (string) | — | — | — | `{ "ok": boolean, "result": object }` |

## Known issues and todo list

### Known issues

- Tool names are not verified as valid
- Model provider and model names are not checked to see if they are supported
- AI requests only support streaming the full event before moving on, there is no async option
- The response contains superfluous data, this is due to the payload being modified so the user can retreive the full execution result, not just an array of tokens
- The Port search result does not use the Port.io icon (this is a known bug when adding via /custom, it will fix itself when deployed as an npm package)

### TODO's

- All input parameters should be checked against the API spec to ensure validity before calling
- Allow returning just the `invocation_identifier` and completing the rest of the call async (is this useful given n8n's very synchronous nature??)
- Clean up the API response, remove extra newlines, add line-by-line result to metadata if it's needed
- Submit to Port Community Hub
- Become verified on the Port Community Hub so our nodes appear without users having to install them
- Create build / publish pipeline for npm package
  - Use GitHub actions
  - Scan dependencies for vulnerabilities
  - Semantic version each release and publish to npm
- Use documentation generator to create docs if complexity of the tool reaches a threshold where manual management isn't feasible
- **Once approved**: Create marketing material to announce availability and a simple install guide / script
