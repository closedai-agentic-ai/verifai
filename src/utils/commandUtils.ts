// Represents a command to be executed by the Mobile MCP
export interface MCPCommand {
  action: string;
  arguments?: Record<string, any>;
}

// Represents raw content/text returned from MCP or used as step input
export interface Content {
  type: string;
  text: string;
}

// ✳️ New: Planning response structure from Bedrock
export interface BedrockPlanResponse {
  type: "plan";
  title: string;
  app: string;
  objective: string;
  steps: string[];
}

// ✳️ New: Response from Bedrock when analyzing MCP result
export type BedrockDecisionResponse =
  | {
      type: "continue";
      message: string;
      failed?: boolean;
    }
  | {
      type: "terminate";
      message: string;
    }
  | {
      type: "mcp_command";
      message: string;
      command: MCPCommand;
    };

export type BedrockResponse = BedrockPlanResponse | BedrockDecisionResponse;

export const safeJSONParse = (json: string) => {
  try {
    return JSON.parse(json);
  } catch (e) {
    return json;
  }
};
