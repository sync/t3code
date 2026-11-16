import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SERVER_SETTINGS, type DeviceSummary } from "@t3tools/contracts";
import {
  deviceRunPort,
  isProjectDeviceRunScript,
  localRunDevices,
  projectDeviceRunScripts,
} from "./projectDeviceRun.ts";

describe("run on device", () => {
  it("hides disabled or unconfigured platform actions", () => {
    expect(projectDeviceRunScripts(DEFAULT_SERVER_SETTINGS)).toEqual([]);
    const config = {
      runOnDeviceEnabled: true,
      runOnDeviceIosCommand: "build-ios",
      runOnDeviceAndroidCommand: "  ",
    };
    const scripts = projectDeviceRunScripts(config);
    expect(scripts.map((script) => script.devicePlatform)).toEqual(["ios"]);
    expect(isProjectDeviceRunScript(scripts[0]!)).toBe(true);
    expect(isProjectDeviceRunScript({ ...scripts[0]!, devicePlatform: undefined } as never)).toBe(
      false,
    );
    expect(projectDeviceRunScripts({ ...config, runOnDeviceEnabled: false })).toEqual([]);
  });
  it("lists only simulators local to the environment for the chosen platform", () => {
    const phone: DeviceSummary = {
      hostId: "local",
      id: "phone",
      platform: "ios",
      name: "Phone",
      version: "26",
      booted: false,
      physical: false,
    };
    const devices = [
      phone,
      { ...phone, hostId: "simlock" },
      { ...phone, hostId: "ssh" },
      { ...phone, physical: true },
      { ...phone, platform: "android" as const },
    ];
    expect(localRunDevices(devices, "ios")).toEqual([phone]);
    expect(localRunDevices(devices, "android")).toEqual([devices[4]]);
  });
  it.each([
    ["", "8081"],
    ["  ", "8081"],
    [" 8082 ", "8082"],
    ["0001", "1"],
    ["65535", "65535"],
    ["0", null],
    ["65536", null],
    ["8.5", null],
    ["1e3", null],
    ["8081; echo bad", null],
  ])("validates port %j", (input, expected) => {
    expect(deviceRunPort(input!)).toBe(expected);
  });
});
