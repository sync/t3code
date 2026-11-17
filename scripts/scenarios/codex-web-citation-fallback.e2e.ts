import { expect } from "e2e";

import { test, WEB } from "./t3.ts";

test(
  "Codex web citations without retained sources show a readable fallback",
  WEB,
  async ({ t3, app, screen }) => {
    const project = await t3.project("citation-demo");
    const thread = await t3.thread({
      project,
      title: "Web citation",
      model: "web-citation",
      messages: ["Show the citation example"],
    });
    await t3.open(thread);
    await expect(screen.getByText("[source unavailable]", { exact: false })).toBeVisible();
    await expect(
      screen.getByText("\ue200cite\ue202turn316369view1\ue201", { exact: false }),
    ).not.toBeVisible();
    await app.screenshot("web-citation");
  },
);
