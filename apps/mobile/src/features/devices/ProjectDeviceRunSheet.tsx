import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Effect from "effect/Effect";
import { Atom } from "effect/reactivity";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { type EnvironmentId, type ScopedThreadRef } from "@t3tools/contracts";
import {
  deviceRunPort,
  localRunDevices,
  type ProjectDeviceRunScript,
} from "@t3tools/shared/projectDeviceRun";
import { Sheet } from "../../components/ui/Sheet";
import { ScreenScrollView } from "../../components/ui/ScreenScrollView";
import { AppText, AppTextInput } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { ListActionRow } from "../../components/ui/ListActionRow";
import { deviceEnvironment } from "../../state/device";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";

const probe = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get) =>
    Effect.promise(() =>
      runAtomCommand(
        get.registry,
        deviceEnvironment.list,
        { environmentId, input: {} },
        { reportFailure: false },
      ),
    ),
  ),
);

export function ProjectDeviceRunSheet(props: {
  threadRef: ScopedThreadRef;
  script: ProjectDeviceRunScript;
  onStarted: (terminalId: string) => void;
  onClose: () => void;
}) {
  const { environmentId, threadId } = props.threadRef;
  const query = useEnvironmentQuery(deviceEnvironment.state({ environmentId, input: {} }));
  useAtomMount(probe(environmentId));
  const runProject = useAtomCommand(deviceEnvironment.runProject, { reportFailure: false });
  const canRun = useAtomValue(deviceEnvironment.runProject.permissionAtom(environmentId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [port, setPort] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- ignore a launch result after the picker unmounts
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const devices = localRunDevices(query.data?.devices ?? [], props.script.devicePlatform);
  const selected = devices.find((device) => device.id === selectedId);
  const resolvedPort = deviceRunPort(port);
  const run = async () => {
    if (!selected || resolvedPort === null || pending || !canRun) return;
    setPending(true);
    setError(null);
    const result = await runProject({
      environmentId,
      input: {
        threadId,
        deviceId: selected.id,
        platform: selected.platform,
        port: Number(resolvedPort),
      },
    });
    if (!active.current) return;
    if (result._tag === "Failure") {
      const cause = squashAtomCommandFailure(result);
      setError(cause instanceof Error ? cause.message : "Could not start device.");
      setPending(false);
      return;
    }
    props.onStarted(result.value.terminalId);
    props.onClose();
  };
  return (
    <Sheet title={props.script.name} onClose={props.onClose} dismissDisabled={pending}>
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-5"
      >
        <AppText>
          Choose a device local to this thread's environment. Stopped devices start automatically.
        </AppText>
        <View>
          {devices.map((device) => (
            <ListActionRow
              key={device.id}
              label={device.name}
              icon="iphone"
              description={`${device.version} · ${device.booted ? "Running" : "Stopped"}${selectedId === device.id ? " · Selected" : ""}`}
              disabled={pending || !canRun}
              onPress={() => setSelectedId(device.id)}
            />
          ))}
        </View>
        {devices.length === 0 && (
          <AppText>
            {query.data?.hostStatus === "disabled"
              ? "Enable Use devices in Settings → Devices first."
              : "No local devices available."}
          </AppText>
        )}
        <AppText>Port (optional)</AppText>
        <AppTextInput
          accessibilityLabel="Port"
          placeholder="8081"
          keyboardType="number-pad"
          value={port}
          onChangeText={setPort}
          editable={!pending}
          className="min-h-11 rounded-xl bg-card px-3 text-foreground"
        />
        {resolvedPort === null && <AppText>Enter a port from 1 to 65535.</AppText>}
        {(error || query.error) && <AppText>{error || query.error}</AppText>}
        <Button
          label={pending ? "Starting device…" : "Run"}
          disabled={pending || !selected || resolvedPort === null || !canRun}
          onPress={() => void run()}
        />
      </ScreenScrollView>
    </Sheet>
  );
}
