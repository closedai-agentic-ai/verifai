import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

interface InvokeBedrockAgentParams {
  sessionId: string;
  prompt: string;
}

export default class Bedrock {
  private bedrock: BedrockAgentRuntimeClient;
  constructor() {
    this.bedrock = new BedrockAgentRuntimeClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });
  }

  async invokeBedrockAgent({ sessionId, prompt }: InvokeBedrockAgentParams) {
    const MAX_RETRIES = 4;
    const RETRY_DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const command = new InvokeAgentCommand({
          agentId: process.env.AWS_AGENT_ID!,
          agentAliasId: process.env.AWS_AGENT_ALIAS_ID!,
          sessionId,
          inputText: prompt,
        });

        let completion = "";
        const response = await this.bedrock.send(command);

        if (!response.completion) {
          console.error(`[Bedrock] No completion (${attempt}/${MAX_RETRIES})`);
          throw new Error("Completion is undefined");
        }

        // decode the response
        for await (const chunkEvent of response.completion) {
          const chunk = chunkEvent.chunk;
          const decodedResponse = new TextDecoder("utf-8").decode(chunk?.bytes);
          completion += decodedResponse;
        }

        return { sessionId, completion };
      } catch (err) {
        console.error(`[Bedrock] Error (${attempt}/${MAX_RETRIES})`);
        if (attempt === MAX_RETRIES) {
          console.error(`[Bedrock] Max retries reached (${MAX_RETRIES})`);
          console.error({
            sessionId,
            prompt,
            error: err,
            attempt,
            maxRetries: MAX_RETRIES,
          });
          return {
            completion: JSON.stringify({
              type: "terminate",
              message:
                err instanceof Error
                  ? err.message
                  : "Bedrock failed to respond.",
            }),
          };
        }
        // Wait before retrying (exponential backoff)`
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt)
        );
      }
    }
  }
}
