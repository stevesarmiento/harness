import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const stageArtworkState = vi.hoisted(() => ({
  mode: "none" as "artwork" | "none",
  variant: null as "nightly" | "dev" | null,
}));

vi.mock("~/hooks/useSettings", () => ({
  useEnvironmentIdentificationMode: () => stageArtworkState.mode,
}));
vi.mock("../SidebarStageBackdrop", () => ({
  StageBackdropButtonArt: ({ variant }: { variant: string }) => `stage-${variant}`,
  useSidebarStageBackdropVariant: (enabled = true) => (enabled ? stageArtworkState.variant : null),
}));

import {
  ComposerPrimaryActions,
  formatPendingPrimaryActionLabel,
  resolveComposerPrimaryAction,
  shouldBlockComposerSubmit,
} from "./ComposerPrimaryActions";

function renderPendingActions(isRunning: boolean) {
  return renderToStaticMarkup(
    createElement(ComposerPrimaryActions, {
      compact: true,
      pendingAction: {
        questionIndex: 0,
        isLastQuestion: true,
        canAdvance: true,
        isResponding: false,
        isComplete: true,
      },
      isRunning,
      queueStatus: "idle",
      showPlanFollowUpPrompt: false,
      promptHasText: false,
      isSendBusy: false,
      sendDisabledReason: null,
      isConnecting: false,
      isEnvironmentUnavailable: false,
      isPreparingWorktree: false,
      hasSendableContent: false,
      onPreviousPendingQuestion: () => {},
      onInterrupt: () => {},
      onImplementPlanInNewThread: () => {},
    }),
  );
}

function renderRunningActions(showSendWhileRunning: boolean, hasSendableContent: boolean) {
  return renderToStaticMarkup(
    createElement(ComposerPrimaryActions, {
      compact: true,
      pendingAction: null,
      isRunning: true,
      queueStatus: "idle",
      showPlanFollowUpPrompt: false,
      promptHasText: hasSendableContent,
      isSendBusy: false,
      sendDisabledReason: null,
      isConnecting: false,
      isEnvironmentUnavailable: false,
      isPreparingWorktree: false,
      hasSendableContent,
      showSendWhileRunning,
      onPreviousPendingQuestion: () => {},
      onInterrupt: () => {},
      onImplementPlanInNewThread: () => {},
    }),
  );
}

function renderSendButton(sendDisabledReason: string | null = null) {
  return renderToStaticMarkup(
    createElement(ComposerPrimaryActions, {
      compact: true,
      pendingAction: null,
      isRunning: false,
      queueStatus: "idle",
      showPlanFollowUpPrompt: false,
      promptHasText: true,
      isSendBusy: false,
      sendDisabledReason,
      isConnecting: false,
      isEnvironmentUnavailable: false,
      isPreparingWorktree: false,
      hasSendableContent: true,
      onPreviousPendingQuestion: () => {},
      onInterrupt: () => {},
      onImplementPlanInNewThread: () => {},
    }),
  );
}

afterEach(() => {
  stageArtworkState.mode = "none";
  stageArtworkState.variant = null;
});

describe("formatPendingPrimaryActionLabel", () => {
  it("returns 'Submitting...' while responding", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: false,
        isLastQuestion: false,
        isResponding: true,
        questionIndex: 0,
      }),
    ).toBe("Submitting...");
  });

  it("returns 'Submitting...' while responding regardless of other flags", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: true,
        isLastQuestion: true,
        isResponding: true,
        questionIndex: 3,
      }),
    ).toBe("Submitting...");
  });

  it("returns 'Submit' in compact mode on the last question", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: true,
        isLastQuestion: true,
        isResponding: false,
        questionIndex: 0,
      }),
    ).toBe("Submit");
  });

  it("returns 'Next' in compact mode when not the last question", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: true,
        isLastQuestion: false,
        isResponding: false,
        questionIndex: 1,
      }),
    ).toBe("Next");
  });

  it("returns 'Next question' when not the last question", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: false,
        isLastQuestion: false,
        isResponding: false,
        questionIndex: 0,
      }),
    ).toBe("Next question");
  });

  it("returns singular 'Submit answer' on the last question when it is the only question", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: false,
        isLastQuestion: true,
        isResponding: false,
        questionIndex: 0,
      }),
    ).toBe("Submit answer");
  });

  it("returns plural 'Submit answers' on the last question when there are multiple questions", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: false,
        isLastQuestion: true,
        isResponding: false,
        questionIndex: 1,
      }),
    ).toBe("Submit answers");
  });

  it("returns plural 'Submit answers' for higher question indices", () => {
    expect(
      formatPendingPrimaryActionLabel({
        compact: false,
        isLastQuestion: true,
        isResponding: false,
        questionIndex: 5,
      }),
    ).toBe("Submit answers");
  });
});

// Fork: the queue-aware primary-action resolver.
describe("resolveComposerPrimaryAction", () => {
  const idle = {
    isRunning: false,
    queueStatus: "idle" as const,
    isSendBusy: false,
    sendDisabledReason: null,
    isConnecting: false,
    isEnvironmentUnavailable: false,
    isPreparingWorktree: false,
    hasSendableContent: true,
  };

  it("sends when idle with content", () => {
    expect(resolveComposerPrimaryAction(idle)).toEqual({
      kind: "send",
      label: "Send message",
      disabled: false,
    });
  });

  it("queues when a turn is running and the composer has content", () => {
    expect(resolveComposerPrimaryAction({ ...idle, isRunning: true })).toEqual({
      kind: "queue",
      label: "Add to queue",
      disabled: false,
    });
  });

  it("interrupts when a turn is running and the composer is empty", () => {
    expect(
      resolveComposerPrimaryAction({
        ...idle,
        isRunning: true,
        hasSendableContent: false,
      }),
    ).toEqual({
      kind: "interrupt",
      label: "Interrupt turn",
      disabled: false,
    });
  });

  it("keeps queue intent visible for queued and paused states", () => {
    expect(resolveComposerPrimaryAction({ ...idle, queueStatus: "queued" }).kind).toBe("queue");
    expect(resolveComposerPrimaryAction({ ...idle, queueStatus: "paused" }).kind).toBe("queue");
  });

  it("reports connection and worktree preparation states", () => {
    expect(resolveComposerPrimaryAction({ ...idle, isConnecting: true })).toMatchObject({
      kind: "busy",
      label: "Connecting",
      disabled: true,
    });
    expect(resolveComposerPrimaryAction({ ...idle, isPreparingWorktree: true })).toMatchObject({
      kind: "busy",
      label: "Preparing worktree",
      disabled: true,
    });
  });

  it("preserves explicit disabled reasons", () => {
    expect(
      resolveComposerPrimaryAction({
        ...idle,
        sendDisabledReason: "Messages loading",
      }),
    ).toEqual({
      kind: "disabled",
      label: "Messages loading",
      disabled: true,
    });
  });
});

// Fork: pending-question submits bypass the ordinary send gates.
describe("shouldBlockComposerSubmit", () => {
  it("does not apply ordinary send gates while advancing pending questions", () => {
    expect(
      shouldBlockComposerSubmit({
        hasPendingAction: true,
        noProviderAvailable: true,
        isSendDisabled: true,
      }),
    ).toBe(false);
  });

  it("keeps provider and loading gates for ordinary messages", () => {
    expect(
      shouldBlockComposerSubmit({
        hasPendingAction: false,
        noProviderAvailable: true,
        isSendDisabled: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockComposerSubmit({
        hasPendingAction: false,
        noProviderAvailable: false,
        isSendDisabled: true,
      }),
    ).toBe(true);
  });
});

describe("ComposerPrimaryActions", () => {
  it("disables and labels the send button while feedback is uploading", () => {
    const markup = renderSendButton("Sending feedback");

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-label="Sending feedback"');
  });

  it("offers Stop generation while a running turn is waiting for user input", () => {
    expect(renderPendingActions(true)).toContain('aria-label="Stop generation"');
  });

  it("does not offer Stop generation for pending input while idle", () => {
    expect(renderPendingActions(false)).not.toContain('aria-label="Stop generation"');
  });

  it("renders stage artwork inside the send button when artwork identification is active", () => {
    stageArtworkState.mode = "artwork";
    stageArtworkState.variant = "nightly";

    const markup = renderSendButton();

    expect(markup).toContain("stage-nightly");
  });

  it("hides stage artwork when artwork identification is inactive", () => {
    stageArtworkState.variant = "nightly";

    const markup = renderSendButton();

    expect(markup).not.toContain("stage-nightly");
  });

  // Fork: while running with content the primary button queues the message.
  it("offers the queue action while running when Enter-to-send is available", () => {
    const markup = renderRunningActions(false, true);

    expect(markup).toContain('aria-label="Add to queue"');
    expect(markup).not.toContain('aria-label="Stop generation"');
  });

  it("renders stop alongside the queue button while running when Enter-to-send is unavailable", () => {
    const markup = renderRunningActions(true, true);

    expect(markup).toContain('aria-label="Stop generation"');
    expect(markup).toContain('aria-label="Add to queue"');
    expect(markup).toContain('type="submit"');
  });

  it("keeps interrupt as the only action while running with an empty composer", () => {
    const markup = renderRunningActions(true, false);

    expect(markup).toContain('aria-label="Interrupt turn"');
    expect(markup).not.toContain('aria-label="Send message"');
  });
});
