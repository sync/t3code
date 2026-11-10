import { ProviderInstanceId, type ProviderOptionDescriptor } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildTraitsTriggerDisplay,
  getDescriptorStringValue,
  getSelectedModelSpeed,
} from "./modelTraits.ts";

describe("getSelectedModelSpeed", () => {
  it.each([
    { options: [], expected: null },
    { options: [{ id: "fastMode", value: false }], expected: null },
    { options: [{ id: "fastMode", value: true }], expected: "Fast" },
    { options: [{ id: "serviceTier", value: "default" }], expected: null },
    { options: [{ id: "serviceTier", value: "priority" }], expected: "Fast" },
    { options: [{ id: "serviceTier", value: "ultrafast" }], expected: "Ultrafast" },
    { options: [{ id: "serviceTier", value: "custom-fast" }], expected: "Fast" },
  ])("shows only selected speed options: $options", ({ options, expected }) => {
    expect(
      getSelectedModelSpeed(
        { instanceId: ProviderInstanceId.make("codex"), model: "gpt", options },
        [
          {
            id: "serviceTier",
            label: "Service Tier",
            type: "select",
            currentValue: "custom-fast",
            options: [{ id: "custom-fast", label: "Fast" }],
          },
          { id: "fastMode", label: "Fast", type: "boolean", currentValue: true },
        ],
      ),
    ).toBe(expected);
  });
});

describe("buildTraitsTriggerDisplay", () => {
  it.each([
    { currentValue: undefined, defaultValue: undefined, value: null, label: "Thinking" },
    { currentValue: undefined, defaultValue: "high", value: "high", label: "High" },
    { currentValue: "low", defaultValue: undefined, value: "low", label: "Low" },
    { currentValue: "max", defaultValue: "high", value: "max", label: "Max" },
    { id: "effort", currentValue: undefined, defaultValue: undefined, value: null, label: "" },
  ])("labels Pi thinking without inventing a selection: $label ($value)", (input) => {
    const descriptor: Extract<ProviderOptionDescriptor, { type: "select" }> = {
      id: input.id ?? "thinking",
      label: "Thinking",
      type: "select",
      options: ["low", "high", "max"].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
        ...(id === input.defaultValue ? { isDefault: true } : {}),
      })),
      ...(input.currentValue ? { currentValue: input.currentValue } : {}),
    };

    expect(
      buildTraitsTriggerDisplay({
        descriptors: [descriptor],
        primarySelectDescriptorId: descriptor.id,
        ultrathinkPromptControlled: false,
      }).label,
    ).toBe(input.label);
    expect(getDescriptorStringValue(descriptor)).toBe(input.value);
  });
});
