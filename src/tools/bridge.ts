import { z } from "zod";
import {
  isBridgeAvailable,
  isBridgeConnected,
  resetBridge,
  sendCommand,
} from "../bridge/compose-client.js";
import { adbShell } from "../adb/client.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getAdbPath(): string {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (androidHome) {
    return `${androidHome}/platform-tools/adb`;
  }
  return "adb";
}

export const bridgeTool = {
  name: "bridge" as const,
  description:
    "Manage the Compose Bridge — a fast on-device server that gives <10ms hierarchy reads (vs 2-5s with ADB). Actions: 'start' launches the PilotServer instrumentation test, 'connect' checks if bridge is reachable, 'status' shows current state, 'stop' kills the bridge.",
  parameters: z.object({
    action: z
      .enum(["start", "connect", "status", "stop"])
      .describe("Action: 'start' = launch PilotServer, 'connect' = check connection, 'status' = show state, 'stop' = kill bridge"),
    package: z
      .string()
      .optional()
      .default("com.example.attendancewidgetlaudea")
      .describe("App package name (default: JustPass)"),
  }),
  execute: async (args: { action: string; package?: string }) => {
    const pkg = args.package ?? "com.example.attendancewidgetlaudea";
    const testPkg = `${pkg}.test`;
    const runner = "androidx.test.runner.AndroidJUnitRunner";
    const testClass = `${pkg}.PilotServer`;

    switch (args.action) {
      case "start": {
        // Launch the instrumentation test in background
        // am instrument runs the test which starts the socket server
        try {
          // Start in background using shell &
          await adbShell(
            "am", "instrument", "-w",
            "-e", "class", testClass,
            `${testPkg}/${runner}`,
            "&"
          );
        } catch {
          // The command may "hang" because the test runs forever — that's expected
          // We started it in background with &
        }

        // Give it a moment to start
        await new Promise((r) => setTimeout(r, 2000));

        // Set up port forwarding and check connection
        const available = await isBridgeAvailable();
        if (available) {
          return `Compose Bridge started and connected!\nPackage: ${pkg}\nMode: <10ms hierarchy via SemanticsTree\nAll hierarchy-dependent tools (find, tap, wait, assert, scroll) now use the fast path.`;
        }
        return `Bridge process started but connection failed. The test APK may not be installed.\nInstall it from Android Studio: Run > Run 'PilotServer' (androidTest)\nOr: ./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=${testClass}`;
      }

      case "connect": {
        const available = await isBridgeAvailable();
        if (available) {
          // Get timing info
          const start = Date.now();
          const response = await sendCommand({ cmd: "hierarchy" });
          const elapsed = Date.now() - start;
          const count = response.count ?? 0;
          return `Bridge connected! Hierarchy: ${count} nodes in ${elapsed}ms (vs 2-5 seconds with ADB)`;
        }
        return "Bridge not available. Run bridge({ action: 'start' }) or start PilotServer from Android Studio.";
      }

      case "status": {
        const connected = isBridgeConnected();
        if (connected) {
          try {
            const response = await sendCommand({ cmd: "ping" });
            const respPkg = (response as unknown as Record<string, unknown>).package ?? pkg;
            return `Bridge: CONNECTED\nPackage: ${respPkg}\nLatency: ${response.elapsed_ms ?? "?"}ms\nAll tools using fast path.`;
          } catch {
            return "Bridge: WAS CONNECTED but ping failed. May need reconnect.";
          }
        }
        return "Bridge: NOT CONNECTED\nTools using ADB path (2-5s per hierarchy dump).\nRun bridge({ action: 'start' }) to enable fast mode.";
      }

      case "stop": {
        resetBridge();
        try {
          // Kill the instrumentation process
          await adbShell("am", "force-stop", testPkg);
        } catch { }
        return "Bridge stopped. Tools will use ADB path.";
      }

      default:
        return `Unknown action: ${args.action}. Use: start, connect, status, stop.`;
    }
  },
};
