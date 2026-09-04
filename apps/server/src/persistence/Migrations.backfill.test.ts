import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "./Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const backfillLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));
const idempotencyLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

backfillLayer("Migrations backfill", (it) => {
  it.effect("applies upstream migrations that sort below an already-recorded fork 9xx id", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // A fork database that merged before upstream shipped 035: everything
      // through 34 ran, and a fork migration in the reserved 9xx block is
      // the latest recorded id. 941 is safe to fake as applied — it only
      // replays idempotent upstream migrations.
      yield* runMigrations({ toMigrationInclusive: 34 });
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (941, 'ReconcileLegacyForkUpstreamOverlap')
        `.withoutTransform;

      // The stock Migrator would skip everything below 941. The backfill
      // pass must apply upstream 035 and the fork block anyway.
      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
      const names = new Set(columns.map((column) => column.name));
      assert.ok(names.has("title_regeneration_request_id"));

      const recorded = yield* sql<{ readonly migration_id: number }>`
          SELECT migration_id FROM effect_sql_migrations ORDER BY migration_id
        `;
      const ids = new Set(recorded.map((row) => Number(row.migration_id)));
      assert.ok(ids.has(35));
      assert.ok(ids.has(935));
      assert.ok(ids.has(940));
    }),
  );
});

idempotencyLayer("Migrations backfill idempotency", (it) => {
  it.effect("records nothing new when the schema is current", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();
      const executed = yield* runMigrations();
      assert.deepStrictEqual(executed, []);

      const recorded = yield* sql<{ readonly count: number }>`
        SELECT COUNT(*) AS count FROM effect_sql_migrations
      `;
      assert.ok(Number(recorded[0]?.count) > 0);
    }),
  );
});
