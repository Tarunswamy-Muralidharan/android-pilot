import { z } from "zod";
import { pressBack } from "../adb/input.js";

export const backTool = {
  name: "back" as const,
  description: "Press the Android back button.",
  parameters: z.object({}),
  execute: async () => {
    await pressBack();
    return "Pressed back button";
  },
};
