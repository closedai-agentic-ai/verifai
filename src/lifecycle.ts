import Bedrock from "./services/bedrock";
import { MobileMCPService } from "./services/mobile-mcp";
import { v4 as uuidv4 } from "uuid";
import {
  composeTestPlanPrompt,
  composeStepToCommandPrompt,
  composeResponseAnalysisPrompt,
  composeToolsPrompt,
} from "./utils/promptUtils";
import {
  safeJSONParse,
  MCPCommand,
  BedrockResponse,
  BedrockPlanResponse,
  BedrockDecisionResponse,
} from "./utils/commandUtils";
import { uploadScreenshotToS3 } from "./services/s3";

export class Lifecycle {
  private bedrock = new Bedrock();
  private mcp = new MobileMCPService();
  private sessionId = uuidv4();
  private tools: any[] = [];

  public async initialize({ sessionId }: { sessionId: string }) {
    console.log("[INIT] Connecting to MCP...");
    this.sessionId = sessionId;

    // Connect to MCP
    await this.mcp.connect();
    const toolList = await this.mcp.listTools();
    this.tools = toolList?.tools ?? [];

    // get the tools prompt
    const toolsPrompt = composeToolsPrompt(this.tools);
    await this.sendToBedrock(toolsPrompt);
  }

  public async planTest(userInput: string) {
    console.log("[PLAN] Generating test plan from user input...");

    // Generate the test plan from the user input
    const prompt = composeTestPlanPrompt(userInput, this.tools);
    const response = await this.sendToBedrock<BedrockPlanResponse>(prompt);

    if (response.type !== "plan" || !Array.isArray(response.steps)) {
      console.error("[PLAN] Invalid plan structure from Bedrock.", response);
      throw new Error("Invalid plan structure from Bedrock.");
    }

    return response.steps;
  }

  public async executePlannedSteps(steps: string[]) {
    const results: any[] = [];

    let stepCount = 0;
    for (const step of steps) {
      stepCount++;
      console.log(`[STEP ${stepCount}] 🔹 Starting: ${step}`);

      // get the command for the step from bedrock
      let command = await this.getCommandForStep(step);
      if (!command) continue;

      // execute the command using the mcp
      let response = await this.executeMCPCommand(command);

      while (true) {
        // wait for 1 second before analyzing the response
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const decision = await this.analyzeMCPResponse(step, response);

        // if the decision is a terminate, add the result to the results
        if (decision.type === "terminate") {
          results.push({
            step,
            status: "terminated",
            message: decision.message,
          });
          return results;
        }

        // if the decision is not a retry, add the result to the results
        if (decision.type !== "mcp_command") {
          results.push({
            step,
            status: decision.failed ? "failed" : "success",
            message: decision.message,
          });
          break;
        }

        // execute the command again if the decision is a retry
        const { command } = decision;
        response = await this.executeMCPCommand(command);
      }
    }

    return results;
  }

  private async getCommandForStep(step: string): Promise<MCPCommand | null> {
    const prompt = composeStepToCommandPrompt(step, this.tools);
    const response = await this.sendToBedrock(prompt);

    if (response.type !== "mcp_command" || !response.command) {
      console.log(`Failed to get command for step: ${step}`, response);
      return null;
    }
    return response.command;
  }

  private async executeMCPCommand(command: MCPCommand): Promise<any> {
    const { action, arguments: args } = command;
    const response = await this.mcp.callTool(action, args);

    if (action === "mobile_take_screenshot") {
      const screenshot = (response[0] as any)?.data;
      if (!screenshot) throw new Error("Screenshot data missing.");
      const url = await uploadScreenshotToS3({
        buffer: Buffer.from(screenshot, "base64"),
        prefix: this.sessionId,
        extension: "png",
      });
      return url;
    }

    return response;
  }

  private async sendToBedrock<T = BedrockResponse>(prompt: string) {
    const result = await this.bedrock.invokeBedrockAgent({
      sessionId: this.sessionId,
      prompt,
    });

    if (result?.completion) {
      return safeJSONParse(result.completion) as T;
    }

    throw new Error("Bedrock failed to respond.");
  }

  private async analyzeMCPResponse(step: string, response: any) {
    const prompt = composeResponseAnalysisPrompt(step, response);
    return await this.sendToBedrock<BedrockDecisionResponse>(prompt);
  }
}
