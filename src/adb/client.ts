import { execFile, execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

let cachedAdbPath: string | null = null;
let cachedDeviceSerial: string | null = null;

function getAdbPath(): string {
  if (cachedAdbPath) return cachedAdbPath;
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome) {
    cachedAdbPath = path.join(androidHome, "platform-tools", "adb");
  } else {
    cachedAdbPath = "adb"; // rely on PATH
  }
  return cachedAdbPath;
}

async function getDeviceSerial(): Promise<string | undefined> {
  if (cachedDeviceSerial) return cachedDeviceSerial;
  const { stdout } = await execFileAsync(getAdbPath(), ["devices"]);
  const lines = stdout.trim().split("\n").slice(1); // skip header
  const devices = lines
    .map((l) => l.trim().split("\t"))
    .filter(([, state]) => state === "device");

  if (devices.length === 0) return undefined;
  cachedDeviceSerial = devices[0][0];
  return cachedDeviceSerial;
}

export function resetDeviceCache(): void {
  cachedDeviceSerial = null;
}

export interface AdbResult {
  stdout: string;
  stderr: string;
}

export async function adb(...args: string[]): Promise<AdbResult> {
  const serial = await getDeviceSerial();
  const fullArgs = serial ? ["-s", serial, ...args] : args;
  try {
    const { stdout, stderr } = await execFileAsync(getAdbPath(), fullArgs, {
      maxBuffer: 10 * 1024 * 1024, // 10MB for screencap
      timeout: 30_000,
    });
    return { stdout, stderr };
  } catch (err: any) {
    if (err.stdout || err.stderr) {
      return { stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
    throw new Error(`ADB command failed: adb ${fullArgs.join(" ")}\n${err.message}`);
  }
}

export async function adbShell(...args: string[]): Promise<string> {
  const { stdout } = await adb("shell", ...args);
  return stdout.trim();
}

export async function adbRawBuffer(...args: string[]): Promise<Buffer> {
  const serial = await getDeviceSerial();
  const fullArgs = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve, reject) => {
    execFileCb(
      getAdbPath(),
      fullArgs,
      { maxBuffer: 10 * 1024 * 1024, encoding: "buffer" as any, timeout: 30_000 },
      (err: any, stdout: any, stderr: any) => {
        if (err && !(stdout as Buffer)?.length) {
          reject(new Error(`ADB command failed: adb ${fullArgs.join(" ")}\n${err.message}`));
          return;
        }
        resolve(stdout as Buffer);
      }
    );
  });
}

export async function getDeviceInfo(): Promise<{
  serial: string;
  model: string;
  androidVersion: string;
  screenSize: { width: number; height: number };
  foregroundPackage: string;
  foregroundActivity: string;
}> {
  const serial = (await getDeviceSerial()) ?? "unknown";
  const [model, androidVersion, wmSize, activityDump] = await Promise.all([
    adbShell("getprop", "ro.product.model"),
    adbShell("getprop", "ro.build.version.release"),
    adbShell("wm", "size"),
    adbShell("dumpsys", "activity", "top"),
  ]);

  // Parse screen size: "Physical size: 1080x2400"
  const sizeMatch = wmSize.match(/(\d+)x(\d+)/);
  const width = sizeMatch ? parseInt(sizeMatch[1]) : 1080;
  const height = sizeMatch ? parseInt(sizeMatch[2]) : 2400;

  // Parse foreground activity from dumpsys
  const taskMatch = activityDump.match(/TASK\s+(\S+)/);
  const actMatch = activityDump.match(/ACTIVITY\s+(\S+)/);
  const foregroundPackage = taskMatch?.[1]?.split("/")?.[0] ?? "unknown";
  const foregroundActivity = actMatch?.[1] ?? "unknown";

  return {
    serial,
    model,
    androidVersion,
    screenSize: { width, height },
    foregroundPackage,
    foregroundActivity,
  };
}

export async function getForegroundPackage(): Promise<string> {
  const dump = await adbShell("dumpsys", "activity", "top");
  const match = dump.match(/TASK\s+(\S+)/);
  return match?.[1]?.split("/")?.[0] ?? "unknown";
}
