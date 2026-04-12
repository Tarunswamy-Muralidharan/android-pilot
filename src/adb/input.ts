import { adbShell } from "./client.js";

export async function tap(x: number, y: number): Promise<void> {
  await adbShell("input", "tap", String(Math.round(x)), String(Math.round(y)));
}

export async function swipe(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  durationMs: number = 300
): Promise<void> {
  await adbShell(
    "input",
    "swipe",
    String(Math.round(x1)),
    String(Math.round(y1)),
    String(Math.round(x2)),
    String(Math.round(y2)),
    String(durationMs)
  );
}

export async function inputText(text: string): Promise<void> {
  // ADB input text: escape spaces as %s and shell-special chars
  const escaped = text.replace(/ /g, "%s").replace(/[&|<>(){}$`"\\!']/g, "\\$&");
  await adbShell("input", "text", escaped);
}

export async function keyevent(code: number | string): Promise<void> {
  await adbShell("input", "keyevent", String(code));
}

export async function pressBack(): Promise<void> {
  await keyevent(4);
}

export async function pressHome(): Promise<void> {
  await keyevent(3);
}

export async function pressRecents(): Promise<void> {
  await keyevent(187);
}
