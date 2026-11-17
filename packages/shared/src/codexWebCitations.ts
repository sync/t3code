import type { OrchestrationV2TurnItem, OrchestrationV2WebSearchResult } from "@t3tools/contracts";
import type { PhrasingContent, Root, RootContent, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

type CitationItem = {
  readonly id: string;
  readonly providerThreadId?: string | null | undefined;
} & (
  | {
      readonly type: "web_search";
      readonly results?: ReadonlyArray<OrchestrationV2WebSearchResult> | undefined;
    }
  | { readonly type: Exclude<OrchestrationV2TurnItem["type"], "web_search"> }
);

export function codexWebCitationSources(
  items: ReadonlyArray<{ readonly item: CitationItem }>,
  assistant: Pick<CitationItem, "id" | "providerThreadId"> | undefined,
): ReadonlyArray<OrchestrationV2WebSearchResult> {
  if (!assistant?.providerThreadId) return [];
  const sources = new Map<string, OrchestrationV2WebSearchResult>();
  for (const { item } of items) {
    if (item.id === assistant.id) return [...sources.values()];
    if (item.type !== "web_search" || item.providerThreadId !== assistant.providerThreadId) {
      continue;
    }
    for (const result of item.results ?? []) {
      if (result.referenceId) sources.set(result.referenceId, result);
    }
  }
  return [];
}

function citationLinks(
  references: string,
  sources: ReadonlyArray<OrchestrationV2WebSearchResult>,
): ReadonlyArray<{ readonly label: string; readonly url?: string }> {
  return [...new Set(references.split("\ue202"))].map((referenceId) => {
    const source = sources.find((candidate) => candidate.referenceId === referenceId);
    if (source?.url) {
      try {
        const url = new URL(source.url);
        if (
          (url.protocol === "https:" || url.protocol === "http:") &&
          !url.username &&
          !url.password
        ) {
          return { label: url.hostname, url: url.href };
        }
      } catch {}
    }
    return { label: "[source unavailable]" };
  });
}

function citationMatches(
  text: string,
  sources: ReadonlyArray<OrchestrationV2WebSearchResult>,
  atEnd: boolean,
) {
  const pattern = atEnd
    ? /\ue200cite\ue202([\w-]+(?:\ue202[\w-]+)*)\ue201|\ue200(?:c|ci|cit|cite(?:\ue202[^\ue200\ue201]*)?)?$/g
    : /\ue200cite\ue202([\w-]+(?:\ue202[\w-]+)*)\ue201/g;
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    links: match[1] ? citationLinks(match[1], sources) : [],
  }));
}

function visitText(
  node: Root | RootContent,
  visit: (node: Text) => ReadonlyArray<PhrasingContent> | void,
) {
  if ("children" in node && node.type !== "link" && node.type !== "linkReference") {
    const children: RootContent[] = node.children;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]!;
      if (child.type !== "text") {
        visitText(child, visit);
        continue;
      }
      const replacement = visit(child);
      if (replacement) {
        children.splice(index, 1, ...replacement);
        index += replacement.length - 1;
      }
    }
  }
}

export function remarkCodexWebCitations({
  sources = [],
}: { readonly sources?: ReadonlyArray<OrchestrationV2WebSearchResult> } = {}) {
  return (tree: Root) => {
    visitText(tree, (node) => {
      if (!node.value.includes("\ue200")) return;
      const children: PhrasingContent[] = [];
      let cursor = 0;
      for (const match of citationMatches(
        node.value,
        sources,
        node.position?.end.offset === tree.position?.end.offset,
      )) {
        children.push({ type: "text", value: node.value.slice(cursor, match.start) });
        for (const [index, link] of match.links.entries()) {
          if (index > 0) children.push({ type: "text", value: " " });
          const label: Text = { type: "text", value: link.label };
          children.push(link.url ? { type: "link", url: link.url, children: [label] } : label);
        }
        cursor = match.end;
      }
      if (cursor === 0) return;
      children.push({ type: "text", value: node.value.slice(cursor) });
      return children;
    });
  };
}

const parser = unified().use(remarkParse).use(remarkGfm).freeze();

export function renderCodexWebCitationsAsMarkdown(
  markdown: string,
  sources: ReadonlyArray<OrchestrationV2WebSearchResult> = [],
): string {
  if (!markdown.includes("\ue200")) return markdown;
  const replacements: { start: number; end: number; markdown: string }[] = [];
  visitText(parser.parse(markdown), (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    for (const match of citationMatches(
      markdown.slice(start, end),
      sources,
      end === markdown.length,
    )) {
      replacements.push({
        start: start + match.start,
        end: start + match.end,
        markdown: match.links
          .map((link) => (link.url ? `[${link.label}](<${link.url}>)` : link.label))
          .join(" "),
      });
    }
  });
  let rendered = markdown;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    rendered =
      rendered.slice(0, replacement.start) + replacement.markdown + rendered.slice(replacement.end);
  }
  return rendered;
}
