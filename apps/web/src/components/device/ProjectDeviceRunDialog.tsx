import { useAtomValue, useAtomMount } from "@effect/atom-react";
import {
  AuthTerminalOperateScope,
  type ScopedThreadRef,
  type ProjectScript,
} from "@t3tools/contracts";
import {
  deviceRunPort,
  localRunDevices,
  type ProjectDeviceRunScript,
} from "@t3tools/shared/projectDeviceRun";
import { useRef, useState, useEffect } from "react";
import {
  deviceEnvironment,
  deviceHostProbeAtom,
  NO_DEVICE_PROBE_ATOM,
  useDeviceState,
} from "../../state/device";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "../ui/select";

export function ProjectDeviceRunDialog(props: {
  threadRef: ScopedThreadRef;
  script: ProjectDeviceRunScript;
  onRun: (script: ProjectScript, env: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const { environmentId, threadId } = props.threadRef;
  const { state, loaded, error: stateError } = useDeviceState(environmentId);
  useAtomMount(
    loaded && state.hostStatus !== "disabled"
      ? deviceHostProbeAtom(environmentId)
      : NO_DEVICE_PROBE_ATOM,
  );
  const open = useAtomCommand(deviceEnvironment.open, { reportFailure: false });
  const canOpen = useAtomValue(deviceEnvironment.open.permissionAtom(environmentId));
  const canRun = useEnvironmentScope(environmentId, AuthTerminalOperateScope);
  const devices = localRunDevices(state.devices, props.script.devicePlatform);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [port, setPort] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a completed device boot must not start a build after this thread's dialog unmounts
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const selected = devices.find((device) => device.id === selectedId);
  const resolvedPort = deviceRunPort(port);
  const run = async () => {
    if (!selected || resolvedPort === null || pending || !canOpen || !canRun) return;
    setPending(true);
    setError(null);
    const result = await open({
      environmentId,
      input: {
        threadId,
        hostId: selected.hostId,
        deviceId: selected.id,
        platform: selected.platform,
        boot: true,
      },
    });
    if (!active.current) return;
    if (result._tag === "Failure") {
      const cause = squashAtomCommandFailure(result);
      setError(cause instanceof Error ? cause.message : "Could not start device.");
      setPending(false);
      return;
    }
    await props.onRun(props.script, {
      SELECTED_DEVICE_ID: result.value.deviceId,
      SELECTED_DEVICE_NAME: selected.name,
      SELECTED_PORT: resolvedPort,
    });
    if (active.current) props.onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) props.onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{props.script.name}</DialogTitle>
          <DialogDescription>
            Choose a device on this thread's environment. Stopped devices start automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            id="project-device-run"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="run-device">Device</Label>
              <Select
                value={selectedId}
                onValueChange={setSelectedId}
                disabled={pending || !canOpen || !canRun}
                items={devices.map((device) => ({
                  value: device.id,
                  label: `${device.name} · ${device.version} · ${device.booted ? "Running" : "Stopped"}`,
                }))}
              >
                <SelectTrigger id="run-device">
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectPopup>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} · {device.version} · {device.booted ? "Running" : "Stopped"}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-device-port">Port (optional)</Label>
              <Input
                id="run-device-port"
                inputMode="numeric"
                placeholder="8081"
                value={port}
                disabled={pending}
                onChange={(event) => setPort(event.target.value)}
              />
            </div>
            {resolvedPort === null && <p role="alert">Enter a port from 1 to 65535.</p>}
            {state.hostStatus === "disabled" ? (
              <p>Enable Use devices in Settings → Devices first.</p>
            ) : loaded && devices.length === 0 ? (
              <p>
                No local{" "}
                {props.script.devicePlatform === "ios" ? "iOS simulators" : "Android emulators"}{" "}
                available.
              </p>
            ) : null}
            {(error || stateError) && <p role="alert">{error || stateError}</p>}
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-device-run"
            disabled={pending || !selected || resolvedPort === null || !canOpen || !canRun}
          >
            {pending ? "Starting device…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
