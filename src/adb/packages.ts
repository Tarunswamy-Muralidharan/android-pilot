import { adb, adbShell } from "./client.js";

export async function launchApp(
  packageName: string,
  activity?: string
): Promise<string> {
  if (activity) {
    const result = await adbShell(
      "am",
      "start",
      "-n",
      `${packageName}/${activity}`
    );
    return result;
  }
  // Use monkey to launch the default activity
  const result = await adbShell(
    "monkey",
    "-p",
    packageName,
    "-c",
    "android.intent.category.LAUNCHER",
    "1"
  );
  return result;
}

export async function installApk(apkPath: string): Promise<string> {
  const { stdout } = await adb("install", "-r", apkPath);
  return stdout.trim();
}

export async function isPackageInstalled(packageName: string): Promise<boolean> {
  const result = await adbShell("pm", "list", "packages", packageName);
  return result.includes(`package:${packageName}`);
}

export async function clearAppData(packageName: string): Promise<string> {
  return adbShell("pm", "clear", packageName);
}

export async function forceStopApp(packageName: string): Promise<void> {
  await adbShell("am", "force-stop", packageName);
}
