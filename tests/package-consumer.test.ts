/**
 * Uses the built package through its name, as a consumer would. Running it
 * checks the `exports` map and `dist/`; type-checking it (`type:test`, after
 * `build`) checks the emitted `.d.ts` files rather than the source.
 */
import {
  type KeyNode,
  type KeycraftKey,
  type KeycraftKeys,
  keycraft,
  segment,
} from "@kellanjs/keycraft";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("built package consumer surface", () => {
  it("builds keys through the package exports", () => {
    const posts = segment({ list: null });
    const keys = keycraft({
      users: {
        list: null,
        byId: { $scope: (id: string) => id, posts },
      },
    });

    expect(keys.users.$key).toEqual(["users"]);
    expect(keys.users.byId("42").posts.list.$key).toEqual([
      "users",
      "byId",
      "42",
      "posts",
      "list",
    ]);
    expect(() => keycraft({ $meta: null } as never)).toThrow(TypeError);
  });

  it("exports the exact key types and the public type names", () => {
    const definition = {
      users: { byId: { $scope: (id: string) => id } },
    } as const;
    const keys: KeycraftKeys<typeof definition> = keycraft(definition);
    const describe = (node: KeyNode): KeycraftKey => node.$key;

    expectTypeOf(keys.users.byId("42").$key).toEqualTypeOf<
      readonly ["users", "byId", string]
    >();
    expect(describe(keys.users.byId("42"))).toEqual(["users", "byId", "42"]);

    // @ts-expect-error children are only on the scoped node
    void keys.users.byId.posts;
  });
});
