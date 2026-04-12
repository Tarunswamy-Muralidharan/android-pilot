import { z } from "zod";
import { pressHome } from "../adb/input.js";

export const homeTool = {
  name: "home" as const,
  description:
    "Press the system Home button (goes to Android home screen). Clearly named to avoid confusion — this is the SYSTEM Home, not an in-app 'Home' tab. Use `tap({ text: 'Home' })` for in-app Home navigation.",
  parameters: z.object({}),
  execute: async () => {
    await pressHome();
    return "Pressed system Home button";
  },
};
