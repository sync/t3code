import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { DeviceId, ThreadId, type DeviceServiceState } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as DeviceService from "../device/DeviceService.ts";
import { liveThreadShell } from "../mcp/McpToolAccess.testkit.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProjectDeviceRunner from "./ProjectDeviceRunner.ts";
import * as ProjectService from "./ProjectService.ts";
import * as ProjectSetupScriptRunner from "./ProjectSetupScriptRunner.ts";

const thread = {
  ...liveThreadShell(ThreadId.make("thread-device")),
  worktreePath: "/repo/feature",
};
const project = {
  id: thread.projectId,
  title: "Device project",
  workspaceRoot: "/repo/main",
  defaultModelSelection: null,
  scripts: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};
const avd = {
  id: "avd:Resizable",
  hostId: "local",
  platform: "android",
  name: "Resizable",
  version: "Android 17",
  booted: false,
  physical: false,
} as const;
const state = {
  hosts: [],
  hostStatus: "ready",
  hostStatuses: {},
  devices: [avd, { ...avd, id: "remote-avd", hostId: "remote" }],
  sessions: [],
  onboardingCompleted: true,
  agentAccessEnabled: true,
  hubBasePath: "/api/device-hub",
  revision: 1,
} satisfies DeviceServiceState;

it.effect("runs the saved project override in the worktree against the booted Android serial", () =>
  Effect.gen(function* () {
    const launched: Array<
      Parameters<
        ProjectSetupScriptRunner.ProjectSetupScriptRunner["Service"]["launchScriptTerminal"]
      >[0]
    > = [];
    const command = 'pnpm expo run:android --device "$SELECTED_DEVICE_NAME"';
    const runner = yield* ProjectDeviceRunner.ProjectDeviceRunner.pipe(
      Effect.provide(
        ProjectDeviceRunner.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.mock(ProjectionStore.ProjectionStoreV2)({
                getThreadShell: () => Effect.succeed(thread),
              }),
              Layer.mock(ProjectService.ProjectService)({
                getById: () => Effect.succeedSome(project),
              }),
              ServerSettings.layerTest({
                runOnDeviceAndroidCommand: "environment default",
                projectSettingsOverrides: {
                  [project.id]: { runOnDeviceEnabled: true, runOnDeviceAndroidCommand: command },
                },
              }),
              Layer.mock(DeviceService.DeviceService)({
                list: Effect.succeed(state),
                open: (input, context) =>
                  Effect.sync(() => {
                    expect(input).toMatchObject({ hostId: "local", deviceId: avd.id, boot: true });
                    expect(context?.workspaceRoot).toBe(thread.worktreePath);
                    return {
                      ...input,
                      hostId: avd.hostId,
                      deviceId: DeviceId.make("emulator-5554"),
                      openedAt: project.createdAt,
                    };
                  }),
              }),
              Layer.mock(ProjectSetupScriptRunner.ProjectSetupScriptRunner)({
                launchScriptTerminal: (input) =>
                  Effect.sync(() => {
                    launched.push(input);
                    return {
                      status: "started",
                      scriptId: input.script.id,
                      scriptName: input.script.name,
                      scriptCommand: command,
                      terminalId: input.terminalId,
                      cwd: input.cwd,
                      async: true,
                    } as const;
                  }),
              }),
              NodeCrypto.layer,
            ),
          ),
        ),
      ),
    );

    expect(
      yield* runner
        .run({ threadId: thread.id, platform: "android", deviceId: "remote-avd" })
        .pipe(Effect.flip),
    ).toMatchObject({ reason: "Choose a local simulator or emulator for the selected platform." });
    const result = yield* runner.run({
      threadId: thread.id,
      platform: "android",
      deviceId: avd.id,
    });
    expect(result).toEqual({
      status: "started",
      terminalId: expect.stringMatching(/^device-android-/),
      deviceId: "emulator-5554",
      port: 8081,
    });
    expect(launched).toEqual([
      expect.objectContaining({
        threadId: thread.id,
        cwd: thread.worktreePath,
        worktreePath: thread.worktreePath,
        terminalId: result.terminalId,
        script: expect.objectContaining({ command }),
        env: {
          T3CODE_PROJECT_ROOT: project.workspaceRoot,
          T3CODE_WORKTREE_PATH: thread.worktreePath,
          SELECTED_DEVICE_ID: "emulator-5554",
          SELECTED_DEVICE_NAME: "Resizable",
          SELECTED_PORT: "8081",
        },
      }),
    ]);
  }),
);
