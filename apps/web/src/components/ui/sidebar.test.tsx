import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { SidebarProvider, SidebarTrigger } from "./sidebar";
import { resolveSidebarState } from "./sidebarState";

function renderSidebarTrigger(defaultOpen = true) {
  return renderToStaticMarkup(
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarTrigger />
    </SidebarProvider>,
  );
}

describe("responsive sidebar state", () => {
  it("uses mobile sheet visibility for the shared responsive state", () => {
    expect(resolveSidebarState({ isMobile: true, open: true, openMobile: false })).toBe(
      "collapsed",
    );
    expect(resolveSidebarState({ isMobile: true, open: false, openMobile: true })).toBe("expanded");
    expect(resolveSidebarState({ isMobile: false, open: true, openMobile: false })).toBe(
      "expanded",
    );
  });
});

describe("SidebarTrigger", () => {
  it("uses a collapse label and title when the desktop sidebar is open", () => {
    const html = renderSidebarTrigger();

    expect(html).toContain('aria-label="Collapse sidebar"');
    expect(html).toContain('title="Collapse sidebar"');
  });

  it("uses an open label and title when the desktop sidebar is collapsed", () => {
    const html = renderSidebarTrigger(false);

    expect(html).toContain('aria-label="Open sidebar"');
    expect(html).toContain('title="Open sidebar"');
  });
});
