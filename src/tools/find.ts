import { z } from "zod";
import { getAppScopedHierarchy, formatHierarchy } from "../adb/hierarchy.js";
import { getForegroundPackage } from "../adb/client.js";

export const findTool = {
  name: "find" as const,
  description:
    "Search for UI elements in the current screen. Results are app-scoped (system UI excluded). Returns compact indexed list — use the index with `tap` to interact. Much smaller output than raw hierarchy (~30 lines vs 200K+ chars).",
  parameters: z.object({
    text: z
      .string()
      .optional()
      .describe("Search for elements containing this text"),
    testTag: z
      .string()
      .optional()
      .describe("Search for Compose testTag"),
    clickable: z
      .boolean()
      .optional()
      .describe("Only return clickable elements"),
  }),
  execute: async (args: { text?: string; testTag?: string; clickable?: boolean }) => {
    const pkg = await getForegroundPackage();
    let elements = await getAppScopedHierarchy(pkg);

    if (args.text) {
      const search = args.text.toLowerCase();
      elements = elements.filter(
        (e) =>
          e.text.toLowerCase().includes(search) ||
          e.contentDesc.toLowerCase().includes(search)
      );
    }

    if (args.testTag) {
      const search = args.testTag.toLowerCase();
      elements = elements.filter((e) =>
        e.testTag.toLowerCase().includes(search)
      );
    }

    if (args.clickable) {
      elements = elements.filter((e) => e.clickable);
    }

    if (elements.length === 0) {
      return `No elements found matching ${JSON.stringify(args)} in ${pkg}`;
    }

    return `Found ${elements.length} elements in ${pkg}:\n${formatHierarchy(elements)}`;
  },
};
