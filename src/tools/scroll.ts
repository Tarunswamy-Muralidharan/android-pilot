import { z } from "zod";
import { swipe } from "../adb/input.js";
import { getDeviceInfo, getForegroundPackage } from "../adb/client.js";
import { findElement } from "../adb/hierarchy.js";
import { pollUntil } from "../util/poll.js";

export const scrollTool = {
  name: "scroll" as const,
  description:
    "Scroll the screen. Supports directional scroll and 'scroll until text visible'. Uses ADB swipe — always works (unlike Maestro's broken direction param).",
  parameters: z.object({
    direction: z
      .enum(["up", "down", "left", "right"])
      .optional()
      .default("down")
      .describe("Scroll direction (default: down). 'down' scrolls content up to see more below."),
    untilText: z
      .string()
      .optional()
      .describe("Keep scrolling until this text is visible on screen"),
    maxScrolls: z
      .number()
      .optional()
      .default(10)
      .describe("Max number of scroll gestures (default: 10, used with untilText)"),
    amount: z
      .number()
      .optional()
      .default(0.5)
      .describe("Scroll amount as fraction of screen (default: 0.5 = half screen)"),
  }),
  execute: async (args: {
    direction?: "up" | "down" | "left" | "right";
    untilText?: string;
    maxScrolls?: number;
    amount?: number;
  }) => {
    const { screenSize } = await getDeviceInfo();
    const w = screenSize.width;
    const h = screenSize.height;
    const dir = args.direction ?? "down";
    const amount = args.amount ?? 0.5;

    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const dx = Math.round(w * amount);
    const dy = Math.round(h * amount);

    // Calculate swipe coordinates based on direction
    // "down" = scroll content up = swipe from bottom to top
    const swipeCoords: Record<string, [number, number, number, number]> = {
      down: [cx, cy + dy / 2, cx, cy - dy / 2],
      up: [cx, cy - dy / 2, cx, cy + dy / 2],
      left: [cx + dx / 2, cy, cx - dx / 2, cy],
      right: [cx - dx / 2, cy, cx + dx / 2, cy],
    };

    if (args.untilText) {
      const pkg = await getForegroundPackage();
      const maxScrolls = args.maxScrolls ?? 10;

      for (let i = 0; i < maxScrolls; i++) {
        const found = await findElement({ text: args.untilText }, pkg);
        if (found) {
          return `Found "${args.untilText}" after ${i} scroll(s) at (${found.centerX}, ${found.centerY})`;
        }
        const [x1, y1, x2, y2] = swipeCoords[dir];
        await swipe(x1, y1, x2, y2, 300);
        // Small pause for UI to settle
        await new Promise((r) => setTimeout(r, 300));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `"${args.untilText}" not found after ${args.maxScrolls} scrolls`,
          },
        ],
        isError: true,
      };
    }

    // Single scroll
    const [x1, y1, x2, y2] = swipeCoords[dir];
    await swipe(x1, y1, x2, y2, 300);
    return `Scrolled ${dir}`;
  },
};
