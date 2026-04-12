import { z } from "zod";
import { getAppScopedHierarchy, formatHierarchy } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";

export const hierarchyTool = {
  name: "hierarchy" as const,
  description:
    "Get the filtered, compact UI hierarchy of the current screen. App-scoped by default (excludes system UI). Each element has an index for use with `tap({ index })`. Output is ~30 lines instead of Appium's 200K+ chars or Maestro's 400 lines.",
  parameters: z.object({
    filter: z
      .enum(["all", "clickable", "text"])
      .optional()
      .default("all")
      .describe("Filter: 'clickable' = interactive only, 'text' = elements with visible text, 'all' = everything"),
    includeSystemUi: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include system UI elements (default: false)"),
  }),
  execute: async (args: { filter?: "all" | "clickable" | "text"; includeSystemUi?: boolean }) => {
    const pkg = args.includeSystemUi ? undefined : await getForegroundPackage();
    const elements = await getAppScopedHierarchy(pkg);
    const output = formatHierarchy(elements, args.filter ?? "all");
    return `UI Hierarchy (${elements.length} elements, package: ${pkg ?? "all"}):\n${output}`;
  },
};
