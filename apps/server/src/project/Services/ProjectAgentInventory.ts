import type { ServerLocalAgentInventory } from "@t3tools/contracts";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

export interface ProjectAgentInventoryShape {
  readonly getInventory: (cwd: string) => Effect.Effect<ServerLocalAgentInventory, never>;
  readonly invalidate: (cwd: string) => Effect.Effect<void, never>;
}

export class ProjectAgentInventory extends Context.Service<
  ProjectAgentInventory,
  ProjectAgentInventoryShape
>()("t3/project/Services/ProjectAgentInventory") {}
