import { z } from "zod";
import { swipe } from "../adb/input.js";

export const swipeTool = {
  name: "swipe" as const,
  description: "Perform a custom swipe gesture with exact coordinates.",
  parameters: z.object({
    x1: z.number().describe("Start X coordinate"),
    y1: z.number().describe("Start Y coordinate"),
    x2: z.number().describe("End X coordinate"),
    y2: z.number().describe("End Y coordinate"),
    duration: z
      .number()
      .optional()
      .default(300)
      .describe("Swipe duration in ms (default: 300)"),
  }),
  execute: async (args: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    duration?: number;
  }) => {
    await swipe(args.x1, args.y1, args.x2, args.y2, args.duration ?? 300);
    return `Swiped from (${args.x1}, ${args.y1}) to (${args.x2}, ${args.y2})`;
  },
};
