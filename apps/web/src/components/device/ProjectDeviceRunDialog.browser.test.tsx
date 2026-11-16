import { Atom, AsyncResult } from "effect/reactivity";
import * as Cause from "effect/Cause";
import { EnvironmentId, ThreadId, type DeviceServiceState } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render, act } from "../../../test/render";
import { ProjectDeviceRunDialog } from "./ProjectDeviceRunDialog";
import "~/index.css";

const mocks = vi.hoisted(() => ({ open: vi.fn(), state: null as DeviceServiceState | null }));
vi.mock("~/state/device", () => ({
  deviceEnvironment: { runProject: { permissionAtom: () => Atom.make(true) } },
  deviceHostProbeAtom: () => Atom.make(AsyncResult.initial<void, never>()),
  NO_DEVICE_PROBE_ATOM: Atom.make(AsyncResult.initial<void, never>()),
  useDeviceState: () => ({ state: mocks.state!, loaded: true, error: null }),
}));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => mocks.open }));

const threadRef = {
  environmentId: EnvironmentId.make("studio"),
  threadId: ThreadId.make("thread"),
};
const script = {
  id: "run-device-android",
  name: "Run on Android",
  command: 'build "$SELECTED_DEVICE_ID" "$SELECTED_PORT"',
  icon: "play",
  runOnWorktreeCreate: false,
  devicePlatform: "android",
} as const;
function setup() {
  vi.clearAllMocks();
  mocks.state = {
    hosts: [],
    hostStatus: "ready",
    hostStatuses: {},
    sessions: [],
    onboardingCompleted: true,
    agentAccessEnabled: false,
    hubBasePath: "/api/device-hub",
    revision: 1,
    devices: [
      {
        hostId: "local",
        id: "avd",
        name: "Resizable",
        platform: "android",
        version: "17",
        booted: false,
        physical: false,
      },
    ],
  };
}
async function chooseDevice() {
  await userEvent.click(page.getByRole("combobox", { name: "Device", exact: true }));
  await userEvent.click(page.getByRole("option", { name: /Resizable/ }));
}

describe("Run on device picker", () => {
  it("opens the returned build terminal after launching with the default port", async () => {
    setup();
    let finish!: (value: unknown) => void;
    mocks.open.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const started = vi.fn();
    const close = vi.fn();
    await using _screen = await render(
      <ProjectDeviceRunDialog
        threadRef={threadRef}
        script={script}
        onStarted={started}
        onClose={close}
      />,
    );
    await chooseDevice();
    await userEvent.click(page.getByRole("button", { name: "Run", exact: true }));
    expect(started).not.toHaveBeenCalled();
    expect(mocks.open).toHaveBeenCalledWith({
      environmentId: threadRef.environmentId,
      input: {
        threadId: threadRef.threadId,
        deviceId: "avd",
        platform: "android",
        port: 8081,
      },
    });
    await act(() => finish(AsyncResult.success({ terminalId: "device-terminal" })));
    await vi.waitFor(() => expect(started).toHaveBeenCalledWith("device-terminal"));
    expect(close).toHaveBeenCalled();
  });
  it("validates a custom port and keeps a boot failure visible without running the command", async () => {
    setup();
    mocks.open.mockResolvedValue(AsyncResult.failure(Cause.fail(new Error("Boot failed"))));
    const run = vi.fn();
    await using _screen = await render(
      <ProjectDeviceRunDialog
        threadRef={threadRef}
        script={script}
        onStarted={run}
        onClose={vi.fn()}
      />,
    );
    await chooseDevice();
    await userEvent.fill(page.getByRole("textbox", { name: "Port (optional)" }), "65536");
    await expect.element(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
    await userEvent.fill(page.getByRole("textbox", { name: "Port (optional)" }), "8090");
    await userEvent.click(page.getByRole("button", { name: "Run", exact: true }));
    await expect.element(page.getByRole("alert")).toHaveTextContent("Boot failed");
    expect(run).not.toHaveBeenCalled();
  });
  it("discards a launch result after switching away from the thread", async () => {
    setup();
    let finish!: (value: unknown) => void;
    mocks.open.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const run = vi.fn();
    await using screen = await render(
      <ProjectDeviceRunDialog
        threadRef={threadRef}
        script={script}
        onStarted={run}
        onClose={vi.fn()}
      />,
    );
    await chooseDevice();
    await userEvent.click(page.getByRole("button", { name: "Run", exact: true }));
    await screen.unmount();
    await act(() => finish(AsyncResult.success({ terminalId: "device-terminal" })));
    expect(run).not.toHaveBeenCalled();
  });
});
