import {
  type DeviceRunProjectInput,
  type DeviceRunProjectResult,
  DeviceToolUnavailableError,
  LOCAL_DEVICE_HOST_ID,
} from "@t3tools/contracts";
import { localRunDevices, projectDeviceRunScripts } from "@t3tools/shared/projectDeviceRun";
import { projectScriptCwd, projectScriptRuntimeEnv } from "@t3tools/shared/projectScripts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as DeviceService from "../device/DeviceService.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProjectService from "./ProjectService.ts";
import * as ProjectSetupScriptRunner from "./ProjectSetupScriptRunner.ts";

export class ProjectDeviceRunner extends Context.Service<
  ProjectDeviceRunner,
  {
    readonly run: (
      input: DeviceRunProjectInput,
    ) => Effect.Effect<DeviceRunProjectResult, DeviceToolUnavailableError>;
  }
>()("t3/project/ProjectDeviceRunner") {}

const unavailable = (reason: string) => new DeviceToolUnavailableError({ reason });

const make = Effect.gen(function* () {
  const threads = yield* ProjectionStore.ProjectionStoreV2;
  const projects = yield* ProjectService.ProjectService;
  const settings = yield* ServerSettings.ServerSettingsService;
  const devices = yield* DeviceService.DeviceService;
  const scripts = yield* ProjectSetupScriptRunner.ProjectSetupScriptRunner;
  const random = yield* SecureRandom.SecureRandom;

  const run = Effect.fn("ProjectDeviceRunner.run")(
    function* ({ threadId, platform, deviceId, port = 8081 }: DeviceRunProjectInput) {
      const thread = yield* threads.getThreadShell(threadId);
      if (thread === null || thread.deletedAt !== null) {
        return yield* unavailable("The thread no longer exists.");
      }
      const project = Option.getOrUndefined(yield* projects.getById(thread.projectId));
      if (!project) return yield* unavailable("The thread's project no longer exists.");

      const config = resolveProjectSettings(yield* settings.getSettings, project.id, project);
      const script = projectDeviceRunScripts(config.settings).find(
        (candidate) => candidate.devicePlatform === platform,
      );
      if (!script) {
        return yield* unavailable(
          `Enable Run on Device and set a build command for ${platform} in Project Settings.`,
        );
      }

      const state = yield* devices.list;
      if (state.hostStatus === "disabled") return yield* unavailable("Device support is off.");
      const device = localRunDevices(state.devices, platform).find(
        (candidate) => candidate.id === deviceId,
      );
      if (!device) {
        return yield* unavailable(
          "Choose a local simulator or emulator for the selected platform.",
        );
      }

      const location = {
        project: { cwd: project.workspaceRoot },
        worktreePath: thread.worktreePath,
      };
      const cwd = projectScriptCwd(location);
      const opened = yield* devices.open(
        { threadId, hostId: LOCAL_DEVICE_HOST_ID, deviceId, platform, boot: true },
        { workspaceRoot: cwd },
      );
      const terminalId = `device-${platform}-${yield* random.uuidV4()}`;
      yield* scripts.launchScriptTerminal({
        threadId,
        terminalId,
        script,
        cwd,
        worktreePath: thread.worktreePath,
        env: projectScriptRuntimeEnv({
          ...location,
          extraEnv: {
            SELECTED_DEVICE_ID: opened.deviceId,
            SELECTED_DEVICE_NAME: device.name,
            SELECTED_PORT: String(port),
          },
        }),
      });
      return { status: "started", terminalId, deviceId: opened.deviceId, port } as const;
    },
    Effect.mapError((error) =>
      error._tag === "DeviceToolUnavailableError" ? error : unavailable(error.message),
    ),
  );

  return ProjectDeviceRunner.of({ run });
});

export const layer = Layer.effect(ProjectDeviceRunner, make);
