import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import { VcsDriverKind } from "@t3tools/contracts";

describe("VCS contracts", () => {
  it("keeps git as a supported driver kind", () => {
    expect(Schema.decodeUnknownSync(VcsDriverKind)("git")).toBe("git");
  });
});
