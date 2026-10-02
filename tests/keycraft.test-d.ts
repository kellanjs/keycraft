/**
 * Type-level tests. These are checked by `npm run type:test` (tsc), not run
 * by Vitest. A failing `@ts-expect-error` means an expected error went away.
 */
import { describe, expectTypeOf, it } from "vitest";

import {
  type KeyNode,
  type KeycraftKey,
  type KeycraftKeys,
  keycraft,
  segment,
} from "../src/index.js";

const keys = keycraft({
  users: {
    list: null,
    byId: {
      $scope: (id: string) => id,
      posts: { list: null },
    },
  },
  settings: {},
});

describe("keys", () => {
  it("are typed as the exact tuple they contain", () => {
    expectTypeOf(keys.users.$key).toEqualTypeOf<readonly ["users"]>();
    expectTypeOf(keys.users.list.$key).toEqualTypeOf<
      readonly ["users", "list"]
    >();
    expectTypeOf(keys.settings.$key).toEqualTypeOf<readonly ["settings"]>();
    expectTypeOf(keys.users.byId.$key).toEqualTypeOf<
      readonly ["users", "byId"]
    >();
    expectTypeOf(keys.users.byId("42").posts.list.$key).toEqualTypeOf<
      readonly ["users", "byId", string, "posts", "list"]
    >();
  });

  it("use the scope's return type for the scoped part", () => {
    interface Filters {
      status: "open" | "done";
      page?: number;
    }
    const todos = keycraft({
      todos: {
        list: { $scope: (filters: Filters) => filters },
        byStatus: { $scope: (status: "open" | "done") => status },
        page: { $scope: (page?: number) => page },
        on: { $scope: (day: Date) => day.toISOString() },
      },
    });

    expectTypeOf(todos.todos.list({ status: "open" }).$key).toEqualTypeOf<
      readonly ["todos", "list", Filters]
    >();
    expectTypeOf(todos.todos.byStatus("open").$key).toEqualTypeOf<
      readonly ["todos", "byStatus", "open" | "done"]
    >();
    expectTypeOf(todos.todos.page().$key).toEqualTypeOf<
      readonly ["todos", "page", number | undefined]
    >();
    expectTypeOf(todos.todos.on(new Date()).$key).toEqualTypeOf<
      readonly ["todos", "on", string]
    >();
  });

  it("type numeric property names as strings, like the runtime keys", () => {
    const versions = keycraft({ v1: { 2: null } });

    expectTypeOf(versions.v1[2].$key).toEqualTypeOf<readonly ["v1", "2"]>();
  });

  it("fit wherever a readonly array of unknowns is expected", () => {
    expectTypeOf(keys.users.byId("42").$key).toExtend<KeycraftKey>();
    expectTypeOf(keys.users.byId).toExtend<KeyNode>();
    expectTypeOf(keys.users.byId("42")).toExtend<KeyNode>();
  });

  it("can't be changed", () => {
    // @ts-expect-error keys are readonly
    keys.users.list.$key.push("x");
    // @ts-expect-error so are nodes
    keys.users.list = keys.users.byId("1").posts.list;
  });
});

describe("$scope", () => {
  it("makes a node callable with the scope's parameters", () => {
    const search = keycraft({
      range: { $scope: (from: number, to: number) => [from, to] },
      flags: { $scope: () => "current" },
      page: { $scope: (page?: number) => page },
    });

    expectTypeOf(search.range).parameters.toEqualTypeOf<
      [from: number, to: number]
    >();
    search.flags();
    search.page();
    search.page(2);

    // @ts-expect-error wrong argument type
    keys.users.byId(42);
    // @ts-expect-error missing argument
    keys.users.byId();
    // @ts-expect-error too many arguments
    search.flags("x");
  });

  it("accepts a union of parameter lists", () => {
    const users = keycraft({
      find: {
        $scope: (...args: [id: string] | [first: string, last: string]) => args,
      },
    });

    users.find("42");
    users.find("Ada", "Lovelace");
    expectTypeOf(users.find("42").$key).toEqualTypeOf<
      readonly ["find", [id: string] | [first: string, last: string]]
    >();
    // @ts-expect-error no matching parameter list
    users.find(1);
  });

  it("accepts readonly rest parameters", () => {
    const tagged = keycraft({
      tags: { $scope: (...tags: readonly string[]) => tags },
    });

    expectTypeOf(tagged.tags("a", "b").$key).toEqualTypeOf<
      readonly ["tags", readonly string[]]
    >();
  });

  it("puts children only on the scoped node", () => {
    expectTypeOf(keys.users.byId("42")).toHaveProperty("posts");
    // @ts-expect-error forgot the id
    void keys.users.byId.posts;
  });

  it("doesn't make the scoped node callable again", () => {
    // @ts-expect-error already called
    keys.users.byId("42")("43");
  });
});

describe("definition checks", () => {
  it("reject mistakes", () => {
    keycraft({
      // @ts-expect-error a function needs $scope
      byId: (id: string) => id,
    });
    keycraft({
      // @ts-expect-error $ is reserved
      $meta: null,
    });
    keycraft({
      // @ts-expect-error a misspelt $scope
      users: { $scoep: (id: string) => id },
    });
    keycraft({
      // @ts-expect-error not null or an object
      users: { count: 1 },
    });
    keycraft({
      // @ts-expect-error not null or an object
      users: [],
    });
    keycraft({
      // @ts-expect-error $scope must be a function
      users: { $scope: "id" },
    });
  });

  it("reject scope values that can't go in a key", () => {
    keycraft({
      // @ts-expect-error a Map serializes as {}
      a: { $scope: (map: Map<string, number>) => map },
      // @ts-expect-error functions don't serialize
      b: { $scope: (fn: () => void) => fn },
      // @ts-expect-error nested functions don't either
      c: { $scope: (options: { onDone: () => void }) => options },
      // @ts-expect-error bigints can't be serialized
      d: { $scope: (id: bigint) => id },
      // @ts-expect-error dates all match each other by prefix
      e: { $scope: (day: Date) => day },
      // @ts-expect-error nested dates too
      f: { $scope: (range: { from: Date; to: Date }) => range },
    });
    keycraft({
      a: { $scope: (value: unknown) => value },
      b: { $scope: (ids: readonly number[]) => ids },
      c: { $scope: (pair: [string, number | null]) => pair },
      d: { $scope: (options: { tags?: string[]; at?: string }) => options },
    });
  });

  it("handle recursive scope values", () => {
    type Json =
      string | number | boolean | null | Json[] | { [key: string]: Json };
    interface TreeNode {
      name: string;
      children: TreeNode[];
    }
    interface Linked {
      next: Linked | null;
      toString(): string;
    }

    keycraft({
      json: { $scope: (value: Json) => value },
      tree: { $scope: (node: TreeNode) => node },
    });
    keycraft({
      // @ts-expect-error has a method
      linked: { $scope: (item: Linked) => item },
    });
  });

  it("keep the rest of the tree typed when one part is wrong", () => {
    const partly = keycraft({
      // @ts-expect-error not null or an object
      broken: { count: 1 },
      users: { byId: { $scope: (id: string) => id, posts: null } },
    });

    expectTypeOf(partly.users.byId("42").posts.$key).toEqualTypeOf<
      readonly ["users", "byId", string, "posts"]
    >();
  });

  it("check segments on their own", () => {
    // @ts-expect-error not null or an object
    segment({ count: 1 });
    // @ts-expect-error a function needs $scope
    segment((id: string) => id);
    segment(null);
    segment({});
  });
});

describe("segment", () => {
  it("keeps the segment's exact types", () => {
    const user = segment({ $scope: (id: string) => id, posts: null });
    const reused = keycraft({ users: user, admins: user });

    expectTypeOf(reused.admins("1").posts.$key).toEqualTypeOf<
      readonly ["admins", string, "posts"]
    >();
  });
});

describe("KeycraftKeys", () => {
  it("names the type of a tree", () => {
    const definition = { users: { list: null } } as const;
    const tree: KeycraftKeys<typeof definition> = keycraft(definition);

    expectTypeOf(tree.users.list.$key).toEqualTypeOf<
      readonly ["users", "list"]
    >();
  });
});
