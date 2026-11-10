import { useGT, useMessages } from "gt-react-native";

import { AppBar } from "../../components/ui/AppBar";
import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import { getSelectedModelSpeed } from "@t3tools/client-runtime/model-traits";
import { formatModelSelectionEffort } from "@t3tools/client-runtime/state/thread-execution";
import { formatModelSlugName } from "@t3tools/shared/model";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { ProviderIcon } from "../../components/ProviderIcon";
import type { AppBarAction, AppBarMenu } from "../../components/ui/AppBar.types";
import {
  useAdaptiveWorkspaceLayout,
  useWorkspacePaneState,
} from "../layout/AdaptiveWorkspaceLayout";
import type { ThreadInspectorMode } from "./thread-inspector-navigation";
import { useWorkspaceBackNavigation } from "../layout/workspace/useAndroidWorkspaceNavigation";
import {
  threadTerminalMenu,
  useThreadGitMenuDefinition,
  type ThreadGitControlsProps,
} from "./ThreadGitControls";

export function ThreadHeader(props: {
  readonly title: string;
  readonly lockedModel?: { selection: ModelSelection; provider: ServerProvider | undefined } | null;
  readonly subtitle: string;
  readonly gitControls: ThreadGitControlsProps;
  readonly onReturnToThread?: () => void;
  readonly draft?: boolean;
  readonly hasThreadCwd: boolean;
  readonly inspectorMode: ThreadInspectorMode | null;
  readonly onOpenFilesInspector: () => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const [modelExpanded, setModelExpanded] = useState(false);
  const goBack = useWorkspaceBackNavigation();
  const { toggleAuxiliaryPane, startNewTask } = useAdaptiveWorkspaceLayout();
  const { panes } = useWorkspacePaneState();
  const gitMenu = useThreadGitMenuDefinition(props.gitControls);
  const terminalMenu = threadTerminalMenu(props.gitControls, m);
  const filesVisible = props.inspectorMode === "files" && panes.auxiliaryPaneVisible;
  const actions: AppBarAction[] = props.hasThreadCwd
    ? [
        {
          accessibilityLabel: filesVisible ? gt("Close files") : gt("Open files"),
          icon: "folder",
          selected: filesVisible,
          disabled: !props.gitControls.canOpenFiles,
          separateBackground: false,
          onPress: filesVisible ? toggleAuxiliaryPane : props.onOpenFilesInspector,
        },
      ]
    : [];
  const menus = [gitMenu, terminalMenu].filter((menu): menu is AppBarMenu => menu !== null);
  const lockedModel = props.lockedModel;
  const catalogModel = lockedModel?.provider?.models.find(
    (model) => model.slug === lockedModel.selection.model,
  );
  const modelLabel = lockedModel
    ? (catalogModel?.name ?? formatModelSlugName(lockedModel.selection.model))
    : null;
  const modelEffort = lockedModel
    ? formatModelSelectionEffort(lockedModel.selection, lockedModel.provider?.models)
    : null;
  const modelSpeed = lockedModel
    ? getSelectedModelSpeed(lockedModel.selection, catalogModel?.capabilities?.optionDescriptors)
    : null;

  return (
    <>
      <AppBar
        title={props.title}
        subtitle={props.subtitle}
        onBackToList={goBack}
        onCompose={props.draft ? undefined : startNewTask}
        backInSplitView={
          props.onReturnToThread
            ? {
                accessibilityLabel: gt("Return to chat"),
                icon: "chevron.left",
                onPress: props.onReturnToThread,
              }
            : undefined
        }
        actions={actions}
        menus={menus}
        hideBottomBorder
      />
      {lockedModel ? (
        <View className="flex-row items-center ps-2 pe-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={gt("Model")}
            accessibilityState={{ expanded: modelExpanded }}
            className="size-11 items-center justify-center"
            onPress={() => setModelExpanded((open) => !open)}
          >
            <ProviderIcon provider={lockedModel.provider?.driver} size={16} />
          </Pressable>
          {modelExpanded ? (
            <View
              className="min-w-0 shrink flex-row items-center gap-2"
              accessible
              accessibilityLabel={[modelLabel, modelEffort, modelSpeed].filter(Boolean).join(", ")}
            >
              <Text className="min-w-0 shrink text-xs text-foreground-muted" numberOfLines={1}>
                {modelLabel}
                {modelEffort ? ` · ${modelEffort}` : ""}
              </Text>
              {modelSpeed ? (
                <SymbolView
                  name={{ ios: "bolt.fill", android: "bolt" }}
                  size={12}
                  tintColorClassName="accent-foreground-muted"
                  accessible={false}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
