import type { UiElement } from "../adb/hierarchy.js";

/**
 * Filter UI elements to only include those belonging to the app package.
 * This is the core fix for Maestro's system UI collision bug —
 * when you tap({text: "Home"}), it should NEVER hit the system navigation bar.
 */
export function filterByPackage(
  elements: UiElement[],
  packageName: string
): UiElement[] {
  return elements.filter((e) => {
    // Include elements from the app package
    if (e.packageName === packageName) return true;
    // Include elements with no package (often Compose nodes)
    if (!e.packageName) return true;
    // Exclude system UI, launcher, statusbar, etc.
    return false;
  });
}
