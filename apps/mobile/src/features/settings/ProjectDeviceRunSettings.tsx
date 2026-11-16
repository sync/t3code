import { useState } from "react";
import { View } from "react-native";
import { AuthSettingsWriteScope, type ServerSettingsPatch } from "@t3tools/contracts";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { AppText, AppTextInput } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { useEnvironmentsWithScope } from "../../state/session";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";
import {
  planMobileScopedSettingsPatch,
  resolveMobileSettingsTargets,
} from "./settings-scoped-server";
import type { SettingsTarget } from "./settings-environment-filter";
import { useSettingsWriter } from "./useSettingsWriter";

export function ProjectDeviceRunSettings(props: {
  members: readonly EnvironmentProject[];
  environments: readonly SettingsTarget[];
}) {
  const targets = resolveMobileSettingsTargets(props.environments, props.members);
  const config = targets[0]?.settings;
  const allowed = useEnvironmentsWithScope(props.members, AuthSettingsWriteScope);
  const writable = props.members.every((member) => allowed.has(member.environmentId));
  const write = useSettingsWriter();
  const [draft, setDraft] = useState<
    Pick<ServerSettingsPatch, "runOnDeviceIosCommand" | "runOnDeviceAndroidCommand">
  >({});
  const [saving, setSaving] = useState(false);
  if (!config) return null;
  const save = async (patch: ServerSettingsPatch) => {
    setSaving(true);
    await write(targets, planMobileScopedSettingsPatch(targets, true, patch));
    setSaving(false);
  };
  return (
    <SettingsSection title="Run on device">
      <SettingsSwitchRow
        icon="iphone"
        label="Enable run on device"
        value={config.runOnDeviceEnabled}
        disabled={saving || !writable}
        subtitle="Use simulators and emulators local to the thread's environment."
        onValueChange={(enabled) => void save({ runOnDeviceEnabled: enabled })}
      />
      {config.runOnDeviceEnabled && (
        <View className="gap-3 p-4">
          {(["runOnDeviceIosCommand", "runOnDeviceAndroidCommand"] as const).map((key) => (
            <View key={key} className="gap-2">
              <AppText>
                {key === "runOnDeviceIosCommand" ? "iOS build command" : "Android build command"}
              </AppText>
              <AppTextInput
                accessibilityLabel={
                  key === "runOnDeviceIosCommand" ? "iOS build command" : "Android build command"
                }
                multiline
                value={draft[key] ?? config[key]}
                editable={writable && !saving}
                placeholder="Enter a build command"
                onChangeText={(value) => setDraft({ ...draft, [key]: value })}
                className="min-h-24 rounded-xl bg-card p-3 text-foreground"
              />
            </View>
          ))}
          <AppText>
            Use {"${SELECTED_DEVICE_ID}"} for iOS and {"${SELECTED_DEVICE_NAME}"} for Expo Android.
            {" ${SELECTED_PORT}"} defaults to 8081. Commands run in the thread's checkout or
            worktree.
          </AppText>
          {Object.entries(draft).some(
            ([key, value]) => config[key as keyof typeof draft] !== value,
          ) && (
            <Button
              label="Save commands"
              disabled={saving || !writable}
              onPress={() => {
                void save(draft);
              }}
            />
          )}
        </View>
      )}
    </SettingsSection>
  );
}
