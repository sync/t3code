import { describe, expect, it } from "vite-plus/test";
import { codexWebCitationSources, renderCodexWebCitationsAsMarkdown } from "./codexWebCitations.ts";

const citation = "\ue200cite\ue202turn316369view1\ue201";
const source = {
  referenceId: "turn316369view1",
  title: "Git configuration",
  url: "https://git-scm.com/docs/git-config",
};

describe("Codex web citations", () => {
  it("resolves exact provider references and keeps unresolved sources visible", () => {
    expect(renderCodexWebCitationsAsMarkdown(`Any configured remote. ${citation}`, [source])).toBe(
      "Any configured remote. [git-scm.com](<https://git-scm.com/docs/git-config>)",
    );
    expect(
      renderCodexWebCitationsAsMarkdown(
        "Sources \ue200cite\ue202turn316369view1\ue202missing\ue202turn316369view1\ue201",
        [source],
      ),
    ).toBe("Sources [git-scm.com](<https://git-scm.com/docs/git-config>) [source unavailable]");
    expect(renderCodexWebCitationsAsMarkdown(citation)).toBe("[source unavailable]");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/report",
    "https://user:secret@example.com",
    "not a URL",
  ])("does not create unsafe citation links: %s", (url) => {
    expect(renderCodexWebCitationsAsMarkdown(citation, [{ ...source, url }])).toBe(
      "[source unavailable]",
    );
  });

  it.each([
    `\`${citation}\``,
    `\`\`\`text\n${citation}\n\`\`\``,
    `    ${citation}`,
    `[${citation}](https://example.com)`,
    `[${citation}][example]\n\n[example]: https://example.com`,
    "\ue200other\ue202turn316369view1\ue201",
  ])("preserves literal code, existing links, and unrelated markers: %s", (markdown) => {
    expect(renderCodexWebCitationsAsMarkdown(markdown, [source])).toBe(markdown);
  });

  it("does not flash incomplete citation tokens while streaming", () => {
    for (let length = 1; length < citation.length; length += 1) {
      expect(renderCodexWebCitationsAsMarkdown(`Answer ${citation.slice(0, length)}`)).toBe(
        "Answer ",
      );
    }
    const markdown = "Answer \ue200cite\ue202unfinished **literal text**";
    expect(renderCodexWebCitationsAsMarkdown(markdown)).toBe(markdown);
  });

  it("preserves Markdown escapes and Unicode before and after a citation", () => {
    expect(
      renderCodexWebCitationsAsMarkdown(`😀 \\*literal\\* ${citation} **after**`, [source]),
    ).toBe("😀 \\*literal\\* [git-scm.com](<https://git-scm.com/docs/git-config>) **after**");
    expect(
      renderCodexWebCitationsAsMarkdown(citation, [
        { ...source, url: "https://example.com/a)b?x=<tag>" },
      ]),
    ).toBe("[example.com](<https://example.com/a)b?x=%3Ctag%3E>)");
  });

  it("scopes references to the provider session and searches preceding the reply", () => {
    const assistant = { id: "reply", providerThreadId: "codex-session" };
    const item = {
      id: "search",
      providerThreadId: assistant.providerThreadId,
      type: "web_search" as const,
      results: [source],
    };
    const items = [
      { item: { ...item, id: "other-session", providerThreadId: "other" } },
      { item },
      { item: { ...assistant, type: "assistant_message" } },
      { item: { ...item, id: "later", results: [{ ...source, url: "https://wrong.example" }] } },
    ] as const;
    expect(codexWebCitationSources(items, assistant)).toEqual([source]);
    expect(
      codexWebCitationSources(items, { ...assistant, providerThreadId: "new-session" }),
    ).toEqual([]);
    expect(codexWebCitationSources(items, { ...assistant, id: "not-loaded" })).toEqual([]);
    expect(codexWebCitationSources(items, undefined)).toEqual([]);
  });
});
