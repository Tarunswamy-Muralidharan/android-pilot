import { z } from "zod";
import { getDeviceInfo } from "../adb/client.js";

export const infoTool = {
  name: "info" as const,
  description:
    "Get device info: model, Android version, screen size, and current foreground app/activity.",
  parameters: z.object({}),
  execute: async () => {
    const info = await getDeviceInfo();
    return [
      `Device: ${info.model} (${info.serial})`,
      `Android: ${info.androidVersion}`,
      `Screen: ${info.screenSize.width}x${info.screenSize.height}`,
      `Foreground: ${info.foregroundPackage}`,
      `Activity: ${info.foregroundActivity}`,
    ].join("\n");
  },
};
