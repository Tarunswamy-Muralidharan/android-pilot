import { z } from "zod";
import { findElement, getAppScopedHierarchy } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";

export const assertTool = {
  name: "assert" as const,
  description:
    "Verify that a condition is true on the current screen. Returns PASS or FAIL with details.",
  parameters: z.object({
    textVisible: z
      .string()
      .optional()
      .describe("Assert this text is visible on screen"),
    textNotVisible: z
      .string()
      .optional()
      .describe("Assert this text is NOT visible"),
    testTagExists: z
      .string()
      .optional()
      .describe("Assert this Compose testTag exists"),
    elementCount: z
      .number()
      .optional()
      .describe("Assert at least this many elements are on screen"),
  }),
  execute: async (args: {
    textVisible?: string;
    textNotVisible?: string;
    testTagExists?: string;
    elementCount?: number;
  }) => {
    const pkg = await getForegroundPackage();
    const results: string[] = [];
    let allPassed = true;

    if (args.textVisible) {
      const found = await findElement({ text: args.textVisible }, pkg);
      if (found) {
        results.push(`PASS: "${args.textVisible}" is visible at (${found.centerX}, ${found.centerY})`);
      } else {
        results.push(`FAIL: "${args.textVisible}" not found`);
        allPassed = false;
      }
    }

    if (args.textNotVisible) {
      const found = await findElement({ text: args.textNotVisible }, pkg);
      if (!found) {
        results.push(`PASS: "${args.textNotVisible}" is not visible`);
      } else {
        results.push(`FAIL: "${args.textNotVisible}" is still visible at (${found.centerX}, ${found.centerY})`);
        allPassed = false;
      }
    }

    if (args.testTagExists) {
      const found = await findElement({ testTag: args.testTagExists }, pkg);
      if (found) {
        results.push(`PASS: testTag "${args.testTagExists}" exists`);
      } else {
        results.push(`FAIL: testTag "${args.testTagExists}" not found`);
        allPassed = false;
      }
    }

    if (args.elementCount !== undefined) {
      const elements = await getAppScopedHierarchy(pkg);
      if (elements.length >= args.elementCount) {
        results.push(`PASS: ${elements.length} elements >= ${args.elementCount}`);
      } else {
        results.push(`FAIL: ${elements.length} elements < ${args.elementCount}`);
        allPassed = false;
      }
    }

    const status = allPassed ? "ALL PASS" : "SOME FAILED";
    return `${status}\n${results.join("\n")}`;
  },
};
