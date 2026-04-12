import { z } from "zod";
import { tap as adbTap } from "../adb/input.js";
import { findElement } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";

export const tapTool = {
  name: "tap" as const,
  description:
    "Tap an element on screen. Supports multiple strategies: testTag (Compose), text match, index from hierarchy, or raw coordinates. All text/testTag/index lookups are APP-SCOPED — they only search within the foreground app, never system UI. This prevents the 'tap Home hits system Home button' bug from Maestro.",
  parameters: z.object({
    testTag: z
      .string()
      .optional()
      .describe("Compose testTag to find (from Modifier.testTag())"),
    text: z
      .string()
      .optional()
      .describe("Visible text to find (case-insensitive partial match)"),
    index: z
      .number()
      .optional()
      .describe("Element index from a previous `find` or `hierarchy` result"),
    x: z.number().optional().describe("Raw X coordinate"),
    y: z.number().optional().describe("Raw Y coordinate"),
  }),
  execute: async (args: {
    testTag?: string;
    text?: string;
    index?: number;
    x?: number;
    y?: number;
  }) => {
    // Strategy 1: Raw coordinates
    if (args.x !== undefined && args.y !== undefined) {
      await adbTap(args.x, args.y);
      return `Tapped at (${args.x}, ${args.y})`;
    }

    // Strategy 2-4: Element lookup (app-scoped)
    const pkg = await getForegroundPackage();
    const selector = args.testTag
      ? { testTag: args.testTag }
      : args.text
        ? { text: args.text }
        : args.index !== undefined
          ? { index: args.index }
          : null;

    if (!selector) {
      return {
        content: [{ type: "text" as const, text: "Error: provide testTag, text, index, or x/y coordinates" }],
        isError: true,
      };
    }

    const element = await findElement(selector, pkg);
    if (!element) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Element not found: ${JSON.stringify(selector)} (searched within package: ${pkg})`,
          },
        ],
        isError: true,
      };
    }

    await adbTap(element.centerX, element.centerY);
    return `Tapped "${element.text || element.testTag || `index:${element.index}`}" at (${element.centerX}, ${element.centerY}) [app-scoped to ${pkg}]`;
  },
};
