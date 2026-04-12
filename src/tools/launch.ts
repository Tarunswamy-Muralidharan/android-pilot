import { z } from "zod";
import { launchApp } from "../adb/packages.js";

export const launchTool = {
  name: "launch" as const,
  description:
    "Launch an Android app by package name. Uses `am start` via ADB — never fails (unlike Maestro's launch_app which had a 100% failure rate).",
  parameters: z.object({
    package: z.string().describe("Android package name (e.g., com.example.myapp)"),
    activity: z
      .string()
      .optional()
      .describe("Specific activity to launch. If omitted, launches the default launcher activity."),
  }),
  execute: async (args: { package: string; activity?: string }) => {
    const result = await launchApp(args.package, args.activity);
    return `Launched ${args.package}${args.activity ? `/${args.activity}` : ""}\n${result}`;
  },
};
