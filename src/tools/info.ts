import { z } from "zod";
import { getDeviceInfo } from "../adb/client.js";
import { isBridgeConnected } from "../bridge/compose-client.js";

export const infoTool = {
  name: "info" as const,
  description:
    "Get device info: model, Android version, screen size, current foreground app/activity, and Compose bridge status.",
  parameters: z.object({}),
  execute: async () => {
    const info = await getDeviceInfo();
    const bridgeStatus = isBridgeConnected() ? "CONNECTED (<10ms hierarchy)" : "not connected (using ADB, 2-5s)";
    return [
      `Device: ${info.model} (${info.serial})`,
      `Android: ${info.androidVersion}`,
      `Screen: ${info.screenSize.width}x${info.screenSize.height}`,
      `Foreground: ${info.foregroundPackage}`,
      `Activity: ${info.foregroundActivity}`,
      `Compose Bridge: ${bridgeStatus}`,
    ].join("\n");
  },
};
