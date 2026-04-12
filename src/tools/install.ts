import { z } from "zod";
import { installApk } from "../adb/packages.js";

export const installTool = {
  name: "install" as const,
  description: "Install an APK file onto the connected device.",
  parameters: z.object({
    apkPath: z.string().describe("Path to the APK file on the host machine"),
  }),
  execute: async (args: { apkPath: string }) => {
    const result = await installApk(args.apkPath);
    return `Install result: ${result}`;
  },
};
