import { z } from "zod";
import { adbShell } from "../adb/client.js";
import { truncateOutput } from "../util/token-budget.js";

export const shellTool = {
  name: "shell" as const,
  description:
    "Run a raw ADB shell command. Escape hatch for anything not covered by other tools. Output is truncated to stay within token budget.",
  parameters: z.object({
    command: z.string().describe("The shell command to run (e.g., 'ls /sdcard')"),
  }),
  execute: async (args: { command: string }) => {
    const parts = args.command.split(/\s+/);
    const result = await adbShell(...parts);
    return truncateOutput(result);
  },
};
