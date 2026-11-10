/**
 * Where the permissions chip shows, whether the mode block overflows, and which control answers
 * the composer.mode shortcut. Without the model picker, the chip keeps Permissions reachable;
 * otherwise it only shows while the mode differs from the default. composer.mode has one target.
 */
export function resolveComposerControlsOwnership(input: {
  /** With the model picker present, permissions hide while the mode matches the default. */
  readonly matchesDefault: boolean;
  readonly modelPickerHidden?: boolean;
  readonly collapsed: boolean;
  /** How many trailing blocks the width measurement moved into the overflow menu. */
  readonly measuredHiddenBlockCount: number;
}) {
  const accessDisplay =
    input.matchesDefault && !input.modelPickerHidden
      ? ("hidden" as const)
      : input.collapsed
        ? ("icon" as const)
        : ("label" as const);
  const showModeBlock = accessDisplay !== "hidden";
  const modeHidden = showModeBlock && input.measuredHiddenBlockCount > 0;
  const hiddenBlockIds = modeHidden ? (["mode"] as const) : ([] as const);
  const overflowShowsPermissions = modeHidden;
  return {
    accessDisplay,
    showModeBlock,
    hiddenBlockCount: hiddenBlockIds.length,
    hiddenBlockIds,
    overflowShowsPermissions,
    /** Without a visible chip or an overflow menu holding it, the model picker answers composer.mode. */
    pickerOwnsModeShortcut: !overflowShowsPermissions && (accessDisplay === "hidden" || modeHidden),
  };
}
