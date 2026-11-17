import { assert } from "@effect/vitest";
import type { ProviderReplayTranscript } from "@t3tools/contracts";

import type { OrchestratorV2ScenarioResult } from "../../OrchestratorScenario.ts";
import {
  assertAssistantTextIncludes,
  assertBaseProjection,
  assertConversationMessageRoles,
  assertExecutionNodeKinds,
  assertRuntimeRequestCounts,
  assertSemanticProjectionIntegrity,
  assertTurnItemTypes,
  assertUserMessagesInclude,
  assertVisibleTurnItemsMirrorLocalTurnItems,
  projectionFor,
  WEB_SEARCH_PROMPT,
} from "../shared.ts";

const WEB_SEARCH_QUERY = "FIFA World Cup 2026 ticket prices official";

export function assertWebSearchOutput(
  result: OrchestratorV2ScenarioResult,
  transcript: ProviderReplayTranscript,
) {
  assertBaseProjection({ result, transcript, runCount: 1, runStatuses: ["completed"] });

  const projection = projectionFor(result, transcript.scenario);
  assertSemanticProjectionIntegrity(projection);
  assertVisibleTurnItemsMirrorLocalTurnItems(projection);
  assertExecutionNodeKinds(projection, ["root_turn", "tool_call", "assistant_message"]);
  assertConversationMessageRoles(projection, ["user", "assistant", "assistant"]);
  assertTurnItemTypes(projection, ["user_message", "web_search", "assistant_message"]);
  assertRuntimeRequestCounts(projection, { total: 0 });
  assertUserMessagesInclude(projection, [WEB_SEARCH_PROMPT]);
  assertAssistantTextIncludes(projection, "web search fixture complete");

  const webSearchItems = projection.turnItems.filter((item) => item.type === "web_search");
  assert.lengthOf(webSearchItems, 1);
  assert.equal(webSearchItems[0]?.status, "completed");
  assert.deepEqual(webSearchItems[0]?.patterns, [WEB_SEARCH_QUERY]);
  assert.deepInclude(
    webSearchItems[0]?.results?.find((result) => result.referenceId === "turn0search2"),
    {
      referenceId: "turn0search2",
      title:
        "New ticket pricing tier introduced for fans of qualified teams at FIFA World Cup 2026™",
      url: "https://tickets.fifa.com/organisation/news/world-cup-2026-new-ticket-pricing-tier-fans-qualified-teams",
    },
  );
}
