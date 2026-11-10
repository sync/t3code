import { createMemoryHistory } from "@tanstack/react-router";
import { ProviderInstanceId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { createModelCapabilities } from "@t3tools/shared/model";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
// The route loads ChatView lazily, and its first transform (React Compiler over ~4k lines)
// takes 6-11s; importing it here keeps that out of the test's timeout.
import "~/components/ChatView";
import { __setClientSettingsForTests, persistClientSettingsPatch } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  CODEX_PROVIDER,
  ENVIRONMENT_ID,
  dispatchedCommands,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { render } from "../../test/render";

// The socket is the only fake layer; see test/appScenarios.renders.tsx.
vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

// Its own file: the app's shell subscription outlives a test, and it must list this thread.
it("only an unlocked model pick for an existing thread reaches the server before a message is sent", async () => {
  const stored = {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5.4",
    options: [{ id: "reasoningEffort", value: "high" }],
  };
  const thread = {
    ...threadWithHistory("thread-model-pick", 1),
    modelSelection: {
      ...stored,
      options: [...stored.options, { id: "serviceTier", value: "fast" }],
    },
  };
  const aliasThread = {
    ...threadWithHistory("thread-model-alias", 1),
    modelSelection: { ...stored, model: "gpt-5-codex" },
  };
  const models = CODEX_PROVIDER.models.map((model) =>
    model.slug === stored.model
      ? {
          ...model,
          capabilities: createModelCapabilities({
            optionDescriptors: [
              {
                id: "reasoningEffort",
                label: "Reasoning effort",
                type: "select",
                options: [{ id: "high", label: "High" }],
              },
            ],
          }),
        }
      : model,
  );
  using _environment = installFakeEnvironment([thread, aliasThread], {
    acceptCommands: true,
    providers: [{ ...CODEX_PROVIDER, models }],
  });
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const router = getRouter(
    createMemoryHistory({ initialEntries: [`/${ENVIRONMENT_ID}/${thread.id}`] }),
  );
  await router.load();
  await using _app = await render(<AppRoot router={router} />, {
    // AppRoot brings its own router.
    router: false,
  });
  await expect.element(page.getByText("Answer 0 for thread-model-pick.")).toBeVisible();

  const modelSets = () =>
    dispatchedCommands().filter((command) => command.type === "thread.model-selection.set");

  const modelPicker = page.getByRole("button", { name: /^GPT-5\.4(?:,|$)/ });
  await modelPicker.click();
  await expect.element(page.getByRole("option", { name: /GPT-5\.5/ })).toBeVisible();
  await persistClientSettingsPatch({ lockThreadModelAfterStart: true });
  await expect.element(modelPicker).not.toBeInTheDocument();
  await expect.element(page.getByRole("option", { name: /GPT-5\.5/ })).not.toBeInTheDocument();
  const modelRow = page.getByRole("region", { name: "Model", exact: true });
  const modelToggle = modelRow.getByRole("button", { name: "Model", exact: true });
  const modelName = modelRow.getByText("GPT-5.4", { exact: true });
  const effort = modelRow.getByText("High", { exact: true });
  const speed = modelRow.getByRole("img", { name: "Fast", exact: true });
  await expect.element(modelToggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(modelName).not.toBeInTheDocument();
  await expect.element(speed).not.toBeInTheDocument();
  await modelToggle.click();
  await expect.element(modelToggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(modelName).toBeVisible();
  await expect.element(effort).toBeVisible();
  await expect.element(speed).toBeVisible();
  await userEvent.keyboard("{Enter}");
  await expect.element(modelToggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(modelName).not.toBeInTheDocument();
  await expect.element(speed).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /^Permissions:/ })).toBeVisible();
  expect(
    dispatchedCommands().filter((command) => command.type === "thread.model-selection.set"),
  ).toEqual([]);

  await persistClientSettingsPatch({ lockThreadModelAfterStart: false });
  await modelPicker.click();
  await page.getByRole("option", { name: /GPT-5\.5/ }).click();
  await vi.waitFor(() =>
    expect(modelSets()).toEqual([
      expect.objectContaining({
        threadId: thread.id,
        modelSelection: { instanceId: "codex", model: "gpt-5.5" },
      }),
    ]),
  );

  // A thread stored under an alias keeps its options when its canonical model is picked.
  await userEvent.keyboard("{Escape}");
  await router.navigate({ href: `/${ENVIRONMENT_ID}/${aliasThread.id}` });
  await expect.element(page.getByText("Answer 0 for thread-model-alias.")).toBeVisible();
  await modelPicker.click();
  await page.getByRole("option", { name: /GPT-5\.4/ }).click();
  await vi.waitFor(() =>
    expect(modelSets().at(-1)).toEqual(
      expect.objectContaining({ threadId: aliasThread.id, modelSelection: stored }),
    ),
  );
});
