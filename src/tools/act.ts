import { z } from "zod";
import { imageContent } from "fastmcp";
import { tap as adbTap } from "../adb/input.js";
import { findElement } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";
import { captureScreenshot } from "../adb/screenshot.js";
import { pollUntil } from "../util/poll.js";

const stepSchema = z.object({
  action: z.enum(["tap", "wait", "back", "scroll"]),
  text: z.string().optional(),
  testTag: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  timeout: z.number().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
});

export const actTool = {
  name: "act" as const,
  description:
    "Execute a batch of actions in sequence: tap, wait, back, scroll — then optionally take a screenshot. Replaces 6+ individual tool calls with ONE. Example: tap 'CA Marks' → wait for 'Subject' → screenshot.",
  parameters: z.object({
    steps: z
      .array(stepSchema)
      .describe(
        "Array of steps. Each step: { action: 'tap'|'wait'|'back'|'scroll', text?, testTag?, x?, y?, timeout?, direction? }"
      ),
    screenshotAfter: z
      .boolean()
      .optional()
      .default(true)
      .describe("Take a screenshot after all steps complete (default: true)"),
  }),
  execute: async (args: {
    steps: Array<{
      action: "tap" | "wait" | "back" | "scroll";
      text?: string;
      testTag?: string;
      x?: number;
      y?: number;
      timeout?: number;
      direction?: "up" | "down" | "left" | "right";
    }>;
    screenshotAfter?: boolean;
  }) => {
    const pkg = await getForegroundPackage();
    const log: string[] = [];

    for (let i = 0; i < args.steps.length; i++) {
      const step = args.steps[i];
      const prefix = `Step ${i + 1}/${args.steps.length}`;

      switch (step.action) {
        case "tap": {
          if (step.x !== undefined && step.y !== undefined) {
            await adbTap(step.x, step.y);
            log.push(`${prefix}: Tapped (${step.x}, ${step.y})`);
          } else {
            const selector = step.testTag
              ? { testTag: step.testTag }
              : step.text
                ? { text: step.text }
                : null;
            if (!selector) {
              log.push(`${prefix}: ERROR — tap needs text, testTag, or x/y`);
              break;
            }
            const el = await findElement(selector, pkg);
            if (el) {
              await adbTap(el.centerX, el.centerY);
              log.push(
                `${prefix}: Tapped "${el.text || el.testTag}" at (${el.centerX}, ${el.centerY})`
              );
            } else {
              log.push(
                `${prefix}: ERROR — element not found: ${JSON.stringify(selector)}`
              );
            }
          }
          break;
        }

        case "wait": {
          const timeout = step.timeout ?? 5000;
          const selector = step.testTag
            ? { testTag: step.testTag }
            : step.text
              ? { text: step.text }
              : null;

          if (selector) {
            const { result, elapsed } = await pollUntil(
              () => findElement(selector, pkg),
              { timeoutMs: timeout }
            );
            if (result) {
              log.push(`${prefix}: Found "${step.text || step.testTag}" after ${elapsed}ms`);
            } else {
              log.push(
                `${prefix}: TIMEOUT waiting for "${step.text || step.testTag}" (${timeout}ms)`
              );
            }
          } else {
            // Simple delay
            await new Promise((r) => setTimeout(r, timeout));
            log.push(`${prefix}: Waited ${timeout}ms`);
          }
          break;
        }

        case "back": {
          const { keyevent } = await import("../adb/input.js");
          await keyevent(4);
          log.push(`${prefix}: Pressed back`);
          break;
        }

        case "scroll": {
          const { swipe } = await import("../adb/input.js");
          const { getDeviceInfo } = await import("../adb/client.js");
          const { screenSize } = await getDeviceInfo();
          const cx = Math.round(screenSize.width / 2);
          const cy = Math.round(screenSize.height / 2);
          const dy = Math.round(screenSize.height * 0.4);
          const dir = step.direction ?? "down";

          if (dir === "down") {
            await swipe(cx, cy + dy / 2, cx, cy - dy / 2, 300);
          } else if (dir === "up") {
            await swipe(cx, cy - dy / 2, cx, cy + dy / 2, 300);
          }
          log.push(`${prefix}: Scrolled ${dir}`);
          break;
        }
      }

      // Small pause between steps for UI to settle
      if (i < args.steps.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Screenshot after all steps
    if (args.screenshotAfter !== false) {
      const { buffer } = await captureScreenshot();
      const img = await imageContent({ buffer });
      return {
        content: [
          { type: "text" as const, text: log.join("\n") },
          img,
        ],
      };
    }

    return log.join("\n");
  },
};
