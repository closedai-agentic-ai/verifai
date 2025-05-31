import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Content } from "../utils/commandUtils";

export class MobileMCPService {
  private client: Client;

  constructor() {
    this.client = new Client({
      name: "mobile-mcp-client",
      version: "1.0.0",
    });
  }

  async connect() {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@mobilenext/mobile-mcp@latest"],
    });

    await this.client.connect(transport);
  }

  async listTools() {
    return this.client.listTools();
  }

  async callTool(name: string, args: Record<string, any> = {}) {
    return new Promise<Content[]>(async (resolve) => {
      try {
        const result = await this.client.callTool({
          name,
          arguments: args,
        });
        if (result.isError) throw new Error(result.error as string);
        resolve(result.content as any[]);
      } catch (error: any) {
        console.error(`[MobileMCPService] Tool error:`, error);
        resolve([{ type: "error", text: error?.message ?? error }]);
      }
    });
  }
}
