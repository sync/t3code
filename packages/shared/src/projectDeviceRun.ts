import {
  LOCAL_DEVICE_HOST_ID,
  type DevicePlatform,
  type DeviceSummary,
  type ServerSettings,
  type ProjectScript,
} from "@t3tools/contracts";

export type ProjectDeviceRunScript = ProjectScript & { readonly devicePlatform: DevicePlatform };

export function projectDeviceRunScripts(
  config: Pick<
    ServerSettings,
    "runOnDeviceEnabled" | "runOnDeviceIosCommand" | "runOnDeviceAndroidCommand"
  >,
): ProjectDeviceRunScript[] {
  if (!config.runOnDeviceEnabled) return [];
  return (["ios", "android"] as const).flatMap((platform) => {
    const command =
      platform === "ios" ? config.runOnDeviceIosCommand : config.runOnDeviceAndroidCommand;
    return command.trim()
      ? [
          {
            id: `run-device-${platform}`,
            name: `Run on ${platform === "ios" ? "iOS" : "Android"}`,
            command,
            icon: "play" as const,
            runOnWorktreeCreate: false,
            devicePlatform: platform,
          },
        ]
      : [];
  });
}

export function isProjectDeviceRunScript(script: ProjectScript): script is ProjectDeviceRunScript {
  return (
    "devicePlatform" in script &&
    (script.devicePlatform === "ios" || script.devicePlatform === "android")
  );
}

export function localRunDevices(devices: readonly DeviceSummary[], platform: DevicePlatform) {
  return devices.filter(
    (device) =>
      device.hostId === LOCAL_DEVICE_HOST_ID && device.platform === platform && !device.physical,
  );
}

export function deviceRunPort(input: string): string | null {
  const value = input.trim();
  if (!value) return "8081";
  if (!/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port >= 1 && port <= 65535 ? String(port) : null;
}
