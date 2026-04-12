import { z } from "zod";
import { inputText } from "../adb/input.js";

export const typeTool = {
  name: "type" as const,
  description: "Type text into the currently focused input field. Supports Unicode characters.",
  parameters: z.object({
    text: z.string().describe("Text to type"),
  }),
  execute: async (args: { text: string }) => {
    await inputText(args.text);
    return `Typed: "${args.text}"`;
  },
};
