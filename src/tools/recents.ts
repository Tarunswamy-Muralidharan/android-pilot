import { z } from "zod";
import { pressRecents } from "../adb/input.js";

export const recentsTool = {
  name: "recents" as const,
  description: "Open the Android app switcher / recent apps view.",
  parameters: z.object({}),
  execute: async () => {
    await pressRecents();
    return "Opened recent apps";
  },
};
