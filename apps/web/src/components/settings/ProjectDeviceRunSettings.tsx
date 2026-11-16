import { useRef } from "react";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useScopedSettingsWriteAllowed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

function DeviceCommandSetting(props: {
  setting: "runOnDeviceIosCommand" | "runOnDeviceAndroidCommand";
}) {
  const { setting } = props;
  const settings = useScopedSettings();
  const { targets } = useSettingsScope();
  const update = useUpdateScopedSettings();
  const writable = useScopedSettingsWriteAllowed();
  const mixed = useScopedSettingsMixed([setting]);
  const edited = useRef(false);
  const scopeKey = targets.map((target) => `${target.environmentId}:${target.projectId}`).join(",");
  const label = setting === "runOnDeviceIosCommand" ? "iOS build command" : "Android build command";
  return (
    <SettingsRow serverScoped settingKeys={[setting]} title={label}>
      <div className="mt-3 pb-3.5">
        <div className="mt-1.5">
          <Textarea
            aria-label={label}
            id={`device-run-${setting}`}
            key={`${scopeKey}:${mixed}:${settings[setting]}`}
            rows={4}
            disabled={!writable}
            defaultValue={mixed ? "" : settings[setting]}
            placeholder={
              mixed
                ? "Mixed. Enter a command to apply to all selected checkouts."
                : "Enter a build command"
            }
            onChange={() => {
              edited.current = true;
            }}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (edited.current && (mixed || value !== settings[setting]))
                update({ [setting]: value });
              edited.current = false;
            }}
          />
        </div>
      </div>
    </SettingsRow>
  );
}

export function ProjectDeviceRunSettings() {
  const { scope } = useSettingsScope();
  const settings = useScopedSettings();
  const update = useUpdateScopedSettings();
  const writable = useScopedSettingsWriteAllowed();
  const mixed = useScopedSettingsMixed(["runOnDeviceEnabled"]);
  if (scope.kind !== "project" && scope.kind !== "checkout") return null;
  return (
    <SettingsSection id="project-device-run" title="Run on device">
      <SettingsRow
        serverScoped
        settingKeys={["runOnDeviceEnabled"]}
        mixed={mixed}
        title="Enable run on device"
        description="Run custom build commands on simulators and emulators local to the thread's environment."
        control={
          <Switch
            aria-label="Enable run on device"
            checked={settings.runOnDeviceEnabled}
            disabled={!writable}
            onCheckedChange={(enabled) => update({ runOnDeviceEnabled: enabled })}
          />
        }
      />
      {settings.runOnDeviceEnabled && (
        <>
          <DeviceCommandSetting setting="runOnDeviceIosCommand" />
          <DeviceCommandSetting setting="runOnDeviceAndroidCommand" />
          <SettingsRow
            title="Command variables"
            description={
              <>
                Use {"${SELECTED_DEVICE_ID}"} for iOS and {"${SELECTED_DEVICE_NAME}"} for Expo
                Android. {"${SELECTED_PORT}"} defaults to 8081. Commands run in the thread's
                checkout or worktree.
              </>
            }
          />
        </>
      )}
    </SettingsSection>
  );
}
