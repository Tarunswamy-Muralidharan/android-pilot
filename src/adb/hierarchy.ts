import { XMLParser } from "fast-xml-parser";
import { adbShell } from "./client.js";
import { filterByPackage } from "../filters/app-scope.js";
import { extractTestTag } from "../filters/compose.js";

export interface UiElement {
  index: number;
  text: string;
  contentDesc: string;
  testTag: string;
  resourceId: string;
  className: string;
  packageName: string;
  clickable: boolean;
  scrollable: boolean;
  bounds: { left: number; top: number; right: number; bottom: number };
  centerX: number;
  centerY: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "node",
});

function parseBounds(boundsStr: string): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: parseInt(match[1]),
    top: parseInt(match[2]),
    right: parseInt(match[3]),
    bottom: parseInt(match[4]),
  };
}

function flattenNodes(node: any, elements: UiElement[], counter: { i: number }): void {
  if (!node) return;

  const text = node["@_text"] ?? "";
  const contentDesc = node["@_content-desc"] ?? "";
  const resourceId = node["@_resource-id"] ?? "";
  const className = node["@_class"] ?? "";
  const packageName = node["@_package"] ?? "";
  const clickable = node["@_clickable"] === "true";
  const scrollable = node["@_scrollable"] === "true";
  const boundsStr = node["@_bounds"] ?? "[0,0][0,0]";
  const bounds = parseBounds(boundsStr);
  const testTag = extractTestTag(resourceId);

  const hasContent = text || contentDesc || testTag || clickable || scrollable;
  if (hasContent) {
    elements.push({
      index: counter.i++,
      text,
      contentDesc,
      testTag,
      resourceId,
      className,
      packageName,
      clickable,
      scrollable,
      bounds,
      centerX: Math.round((bounds.left + bounds.right) / 2),
      centerY: Math.round((bounds.top + bounds.bottom) / 2),
    });
  }

  // Recurse children
  const children = node.node;
  if (Array.isArray(children)) {
    for (const child of children) {
      flattenNodes(child, elements, counter);
    }
  }
}

async function disableAnimations(): Promise<void> {
  await Promise.all([
    adbShell("settings", "put", "global", "window_animation_scale", "0"),
    adbShell("settings", "put", "global", "transition_animation_scale", "0"),
    adbShell("settings", "put", "global", "animator_duration_scale", "0"),
  ]);
}

async function restoreAnimations(): Promise<void> {
  await Promise.all([
    adbShell("settings", "put", "global", "window_animation_scale", "1"),
    adbShell("settings", "put", "global", "transition_animation_scale", "1"),
    adbShell("settings", "put", "global", "animator_duration_scale", "1"),
  ]);
}

export async function getHierarchy(): Promise<UiElement[]> {
  const dumpPath = "/sdcard/android-pilot-dump.xml";
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await adbShell("uiautomator", "dump", dumpPath);

    if (result.includes("ERROR") || result.includes("error")) {
      if (attempt === 0) {
        // First failure — disable animations and retry
        await disableAnimations();
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      // All retries exhausted — restore animations before throwing
      await restoreAnimations();
      throw new Error(`uiautomator dump failed after ${maxRetries} attempts: ${result}`);
    }

    // Read the dumped XML from the file
    const xml = await adbShell("cat", dumpPath);

    // Restore animations now that we have the dump
    restoreAnimations().catch(() => {}); // fire-and-forget

    const xmlStart = xml.indexOf("<?xml");
    const cleanXml = xmlStart >= 0 ? xml.slice(xmlStart) : xml;

    const parsed = parser.parse(cleanXml);
    const root = parsed?.hierarchy?.node?.[0] ?? parsed?.hierarchy?.node ?? parsed?.hierarchy;

    const elements: UiElement[] = [];
    flattenNodes(root, elements, { i: 0 });
    return elements;
  }

  await restoreAnimations().catch(() => {});
  return [];
}

export async function getAppScopedHierarchy(
  appPackage?: string
): Promise<UiElement[]> {
  const all = await getHierarchy();
  if (!appPackage) return all;
  return filterByPackage(all, appPackage);
}

export async function findElement(
  selector: { testTag?: string; text?: string; index?: number },
  appPackage?: string
): Promise<UiElement | null> {
  const elements = await getAppScopedHierarchy(appPackage);

  if (selector.index !== undefined) {
    return elements.find((e) => e.index === selector.index) ?? null;
  }

  if (selector.testTag) {
    return (
      elements.find(
        (e) => e.testTag.toLowerCase() === selector.testTag!.toLowerCase()
      ) ?? null
    );
  }

  if (selector.text) {
    const search = selector.text.toLowerCase();
    // Exact match first
    const exact =
      elements.find((e) => e.text.toLowerCase() === search) ??
      elements.find((e) => e.contentDesc.toLowerCase() === search);
    if (exact) return exact;

    // Partial match
    return (
      elements.find((e) => e.text.toLowerCase().includes(search)) ??
      elements.find((e) => e.contentDesc.toLowerCase().includes(search)) ??
      null
    );
  }

  return null;
}

export function formatHierarchy(
  elements: UiElement[],
  filter?: "clickable" | "text" | "all"
): string {
  let filtered = elements;
  if (filter === "clickable") {
    filtered = elements.filter((e) => e.clickable);
  } else if (filter === "text") {
    filtered = elements.filter((e) => e.text || e.contentDesc);
  }

  if (filtered.length === 0) return "(no elements found)";

  return filtered
    .map((e) => {
      const parts: string[] = [`[${e.index}]`];
      if (e.testTag) parts.push(`tag:${e.testTag}`);
      if (e.text) parts.push(`"${e.text}"`);
      if (e.contentDesc && e.contentDesc !== e.text)
        parts.push(`desc:"${e.contentDesc}"`);
      if (e.clickable) parts.push("(clickable)");
      if (e.scrollable) parts.push("(scrollable)");
      parts.push(`@(${e.centerX},${e.centerY})`);
      return parts.join(" ");
    })
    .join("\n");
}
