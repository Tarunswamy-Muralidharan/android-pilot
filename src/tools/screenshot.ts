import { z } from "zod";
import { imageContent } from "fastmcp";
import { captureScreenshot } from "../adb/screenshot.js";

export const screenshotTool = {
  name: "screenshot" as const,
  description:
    "Capture a screenshot of the device screen. Returns a compressed inline JPEG image (~20KB, ~27K base64 chars). One tool call — no token overflow, no temp files, no workarounds.",
  parameters: z.object({
    width: z
      .number()
      .optional()
      .default(540)
      .describe("Resize width in pixels (default: 540). Lower = smaller token cost."),
    quality: z
      .number()
      .optional()
      .default(60)
      .describe("JPEG quality 1-100 (default: 60). Lower = smaller but blurrier."),
  }),
  execute: async (args: { width?: number; quality?: number }) => {
    const { buffer } = await captureScreenshot(args.width ?? 540, args.quality ?? 60);
    return imageContent({ buffer });
  },
};
