/**
 * Compose Bridge Client — connects to the on-device PilotServer
 * running as a Compose instrumentation test.
 *
 * Fast path: <10ms hierarchy reads via direct SemanticsTree access
 * Fallback: ADB uiautomator dump (2-5 seconds) when bridge is not available
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as net from "node:net";

const execFileAsync = promisify(execFile);

const BRIDGE_PORT = 9008;
const CONNECT_TIMEOUT = 2000;
const COMMAND_TIMEOUT = 10000;

export interface BridgeNode {
  index: number;
  text?: string;
  contentDesc?: string;
  testTag?: string;
  editableText?: string;
  clickable?: boolean;
  scrollable?: boolean;
  centerX: number;
  centerY: number;
  bounds: { left: number; top: number; right: number; bottom: number };
}

export interface BridgeResponse {
  status: string;
  elapsed_ms?: number;
  message?: string;
  count?: number;
  nodes?: BridgeNode[];
  results?: Array<{ check: string; result: string; reason?: string }>;
  centerX?: number;
  centerY?: number;
}

let _connected = false;
let _forwarded = false;

/**
 * Check if the PilotServer is running and reachable
 */
export async function isBridgeAvailable(): Promise<boolean> {
  if (!_forwarded) {
    try {
      const adbPath = getAdbPath();
      // Set up port forwarding
      await execFileAsync(adbPath, ["forward", `tcp:${BRIDGE_PORT}`, `tcp:${BRIDGE_PORT}`]);
      _forwarded = true;
    } catch {
      return false;
    }
  }

  try {
    const response = await sendCommand({ cmd: "ping" });
    _connected = response.status === "ok";
    return _connected;
  } catch {
    _connected = false;
    return false;
  }
}

/**
 * Send a command to the PilotServer and get a response
 */
export async function sendCommand(command: Record<string, unknown>): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";

    socket.setTimeout(COMMAND_TIMEOUT);

    socket.connect(BRIDGE_PORT, "127.0.0.1", () => {
      socket.write(JSON.stringify(command) + "\n");
    });

    socket.on("data", (chunk) => {
      data += chunk.toString();
      // Response is a single JSON line terminated by newline
      if (data.includes("\n")) {
        try {
          const response = JSON.parse(data.trim());
          socket.destroy();
          resolve(response);
        } catch (e) {
          socket.destroy();
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Bridge command timed out"));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on("close", () => {
      if (data && !data.includes("\n")) {
        // Got data but no newline — try parsing anyway
        try {
          resolve(JSON.parse(data.trim()));
        } catch {
          reject(new Error(`Incomplete response: ${data}`));
        }
      }
    });
  });
}

/**
 * Check if bridge is currently connected (cached, fast)
 */
export function isBridgeConnected(): boolean {
  return _connected;
}

/**
 * Reset connection state (e.g., after launching a different app)
 */
export function resetBridge(): void {
  _connected = false;
  _forwarded = false;
}

// --- Bridge command helpers ---

export async function bridgeHierarchy(): Promise<BridgeNode[]> {
  const response = await sendCommand({ cmd: "hierarchy" });
  if (response.status !== "ok") {
    throw new Error(`Bridge hierarchy failed: ${response.message}`);
  }
  return (response.nodes ?? []) as BridgeNode[];
}

export async function bridgeFind(
  opts: { text?: string; testTag?: string }
): Promise<BridgeNode[]> {
  const response = await sendCommand({ cmd: "find", ...opts });
  if (response.status !== "ok") {
    throw new Error(`Bridge find failed: ${response.message}`);
  }
  return (response.nodes ?? []) as BridgeNode[];
}

export async function bridgeTap(
  opts: { text?: string; testTag?: string; x?: number; y?: number }
): Promise<string> {
  const response = await sendCommand({ cmd: "tap", ...opts });
  if (response.status !== "ok") {
    throw new Error(`Bridge tap failed: ${response.message}`);
  }
  return response.message ?? "tapped";
}

export async function bridgeAssert(
  opts: { textVisible?: string; textNotVisible?: string }
): Promise<BridgeResponse> {
  return sendCommand({ cmd: "assert", ...opts });
}

export async function bridgeWaitForText(
  text: string,
  timeout?: number
): Promise<BridgeResponse> {
  return sendCommand({ cmd: "waitForText", text, timeout: timeout ?? 5000 });
}

export async function bridgeWaitForGone(
  text: string,
  timeout?: number
): Promise<BridgeResponse> {
  return sendCommand({ cmd: "waitForGone", text, timeout: timeout ?? 5000 });
}

export async function bridgeScroll(
  opts: { direction?: string; untilText?: string }
): Promise<BridgeResponse> {
  return sendCommand({ cmd: "scroll", ...opts });
}

export async function bridgeInputText(
  text: string,
  opts?: { target?: string; targetTag?: string }
): Promise<BridgeResponse> {
  return sendCommand({ cmd: "inputText", text, ...opts });
}

// --- Utility ---

function getAdbPath(): string {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (androidHome) {
    return `${androidHome}/platform-tools/adb`;
  }
  return "adb";
}
