import { AppBar } from "../../components/ui/AppBar";
import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import { formatModelSelectionEffort } from "@t3tools/client-runtime/state/thread-execution";
import { formatModelSlugName } from "@t3tools/shared/model";
import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
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
  const goBack = useWorkspaceBackNavigation();
  const { toggleAuxiliaryPane, startNewTask } = useAdaptiveWorkspaceLayout();
  const { panes } = useWorkspacePaneState();
  const gitMenu = useThreadGitMenuDefinition(props.gitControls);
  const terminalMenu = threadTerminalMenu(props.gitControls);
  const filesVisible = props.inspectorMode === "files" && panes.auxiliaryPaneVisible;
  const actions: AppBarAction[] = props.hasThreadCwd
    ? [
        {
          accessibilityLabel: filesVisible ? "Close files" : "Open files",
          icon: "folder",
          selected: filesVisible,
          disabled: !props.gitControls.canOpenFiles,
          separateBackground: false,
          onPress: filesVisible ? toggleAuxiliaryPane : props.onOpenFilesInspector,
        },
      ]
    : [];
  const menus = [gitMenu, terminalMenu].filter((menu): menu is AppBarMenu => menu !== null);
  const modelEffort = props.lockedModel
    ? formatModelSelectionEffort(props.lockedModel.selection, props.lockedModel.provider?.models)
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
                accessibilityLabel: "Return to chat",
                icon: "chevron.left",
                onPress: props.onReturnToThread,
              }
            : undefined
        }
        actions={actions}
        menus={menus}
        hideBottomBorder
      />
      {props.lockedModel ? (
        <View
          className="flex-row items-center gap-2 px-5 pb-2"
          accessibilityLabel="Locked thread model"
        >
          <ProviderIcon provider={props.lockedModel.provider?.driver} size={16} />
          <Text className="flex-1 text-xs text-foreground-muted" numberOfLines={1}>
            {props.lockedModel.provider?.models.find(
              (model) => model.slug === props.lockedModel?.selection.model,
            )?.name ?? formatModelSlugName(props.lockedModel.selection.model)}
            {modelEffort ? ` · ${modelEffort}` : ""}
          </Text>
        </View>
      ) : null}
    </>
  );
}
