import { EventId, TurnId } from "@t3tools/contracts";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { deriveLatestContextWindowSnapshot } from "~/lib/contextWindow";
import { ContextWindowMeter } from "./ContextWindowMeter";

vi.mock("../ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverPopup: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ closeDelay, render }: { closeDelay: number; render: ReactNode }) => (
    <div data-close-delay={closeDelay}>{render}</div>
  ),
}));

const usage = deriveLatestContextWindowSnapshot([
  {
    id: EventId.make("activity-1"),
    tone: "info",
    kind: "context-window.updated",
    summary: "Context updated",
    payload: { usedTokens: 100_000, maxTokens: 1_000_000 },
    turnId: TurnId.make("turn-1"),
    createdAt: "2026-08-24T12:00:00.000Z",
  },
]);

if (!usage) {
  throw new Error("The context window test fixture did not produce a snapshot.");
}

// Fork: a half-full window for the variant rendering cases.
const halfUsage = deriveLatestContextWindowSnapshot([
  {
    id: EventId.make("activity-2"),
    tone: "info",
    kind: "context-window.updated",
    summary: "Context updated",
    payload: { usedTokens: 64_000, maxTokens: 128_000 },
    turnId: TurnId.make("turn-1"),
    createdAt: "2026-08-24T12:00:00.000Z",
  },
]);

if (!halfUsage) {
  throw new Error("The context window test fixture did not produce a snapshot.");
}

describe("ContextWindowMeter", () => {
  it("keeps the hover popover open while the pointer moves to the compact button", () => {
    const markup = renderToStaticMarkup(<ContextWindowMeter usage={usage} onCompact={() => {}} />);

    expect(markup).toContain('data-close-delay="150"');
    expect(markup).toContain("Compact context");
  });

  it("closes an informational hover popover without delay", () => {
    const markup = renderToStaticMarkup(<ContextWindowMeter usage={usage} />);

    expect(markup).toContain('data-close-delay="0"');
    expect(markup).not.toContain("Compact context");
  });

  it("explains why the compact action is disabled", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowMeter
        usage={usage}
        onCompact={() => {}}
        compactDisabled
        compactDisabledReason="Send or clear your draft before compacting"
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain(">Send or clear your draft before compacting<");
    expect(markup).not.toContain('aria-label="Send or clear your draft before compacting"');
  });

  // Fork: variant rendering
  it("renders the percentage inside the icon meter", () => {
    const markup = renderToStaticMarkup(<ContextWindowMeter usage={halfUsage} variant="icon" />);
    expect(markup).toContain(">50<");
    expect(markup).toContain("Context window 50% used");
  });

  it("renders a labeled variant for the metadata row", () => {
    const markup = renderToStaticMarkup(<ContextWindowMeter usage={halfUsage} variant="labeled" />);
    expect(markup).toContain(">50%<");
    expect(markup).toContain("Context window 50% used");
  });

  it("falls back to a formatted token value without a known maximum", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowMeter
        usage={{
          ...halfUsage,
          maxTokens: null,
          usedPercentage: null,
          remainingTokens: null,
          remainingPercentage: null,
        }}
      />,
    );
    expect(markup).toContain(">64k<");
  });
});
