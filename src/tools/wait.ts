import { z } from "zod";
import { pollUntil } from "../util/poll.js";
import { getAppScopedHierarchy, findElement } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";
import { isBridgeConnected, bridgeWaitForText, bridgeWaitForGone } from "../bridge/compose-client.js";

export const waitTool = {
  name: "wait" as const,
  description:
    "Wait for a condition on screen: element to appear (by text/testTag), element to disappear, or screen to become idle. Built-in polling — no more repeated screenshots hoping data has loaded.",
  parameters: z.object({
    forText: z
      .string()
      .optional()
      .describe("Wait for text to appear on screen"),
    forTestTag: z
      .string()
      .optional()
      .describe("Wait for Compose testTag to appear"),
    forGone: z
      .string()
      .optional()
      .describe("Wait for text to disappear from screen"),
    timeout: z
      .number()
      .optional()
      .default(5000)
      .describe("Timeout in ms (default: 5000)"),
    interval: z
      .number()
      .optional()
      .default(500)
      .describe("Poll interval in ms (default: 500)"),
  }),
  execute: async (args: {
    forText?: string;
    forTestTag?: string;
    forGone?: string;
    timeout?: number;
    interval?: number;
  }) => {
    const timeout = args.timeout ?? 5000;
    const interval = args.interval ?? 500;

    // Fast path: bridge-native wait (event-driven, not polling)
    if (isBridgeConnected()) {
      try {
        if (args.forText) {
          const resp = await bridgeWaitForText(args.forText, timeout);
          if (resp.status === "ok") {
            return `Found "${args.forText}" at (${resp.centerX}, ${resp.centerY}) [bridge, ${resp.elapsed_ms ?? "?"}ms]`;
          }
          return { content: [{ type: "text" as const, text: `Timeout: "${args.forText}" not found after ${timeout}ms` }], isError: true };
        }
        if (args.forGone) {
          const resp = await bridgeWaitForGone(args.forGone, timeout);
          if (resp.status === "ok") {
            return `"${args.forGone}" disappeared [bridge, ${resp.elapsed_ms ?? "?"}ms]`;
          }
          return { content: [{ type: "text" as const, text: `Timeout: "${args.forGone}" still visible after ${timeout}ms` }], isError: true };
        }
      } catch {
        // Fall through to ADB path
      }
    }

    // Slow path: polling via ADB hierarchy dump
    const pkg = await getForegroundPackage();

    if (args.forText) {
      const { result, elapsed } = await pollUntil(
        () => findElement({ text: args.forText }, pkg),
        { timeoutMs: timeout, intervalMs: interval }
      );
      if (result) {
        return `Found "${args.forText}" after ${elapsed}ms at (${result.centerX}, ${result.centerY})`;
      }
      return {
        content: [{ type: "text" as const, text: `Timeout: "${args.forText}" not found after ${timeout}ms` }],
        isError: true,
      };
    }

    if (args.forTestTag) {
      const { result, elapsed } = await pollUntil(
        () => findElement({ testTag: args.forTestTag }, pkg),
        { timeoutMs: timeout, intervalMs: interval }
      );
      if (result) {
        return `Found testTag "${args.forTestTag}" after ${elapsed}ms`;
      }
      return {
        content: [{ type: "text" as const, text: `Timeout: testTag "${args.forTestTag}" not found after ${timeout}ms` }],
        isError: true,
      };
    }

    if (args.forGone) {
      const { result, elapsed } = await pollUntil(
        async () => {
          const found = await findElement({ text: args.forGone }, pkg);
          return found === null ? true : null;
        },
        { timeoutMs: timeout, intervalMs: interval }
      );
      if (result) {
        return `"${args.forGone}" disappeared after ${elapsed}ms`;
      }
      return {
        content: [{ type: "text" as const, text: `Timeout: "${args.forGone}" still visible after ${timeout}ms` }],
        isError: true,
      };
    }

    // Default: wait for idle (no hierarchy changes)
    let lastCount = -1;
    const { result, elapsed } = await pollUntil(
      async () => {
        const elements = await getAppScopedHierarchy(pkg);
        const count = elements.length;
        if (count === lastCount) return true;
        lastCount = count;
        return null;
      },
      { timeoutMs: timeout, intervalMs: interval }
    );

    if (result) {
      return `Screen idle after ${elapsed}ms (${lastCount} elements stable)`;
    }
    return `Screen still changing after ${timeout}ms (last: ${lastCount} elements)`;
  },
};
