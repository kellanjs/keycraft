import { describe, expect, it, vi } from "vitest";

import { keycraft, segment } from "../src/index.js";

describe("keys", () => {
  it("gives every node the path to it as its key", () => {
    const keys = keycraft({
      users: {
        list: null,
        recent: {},
        active: { premium: null },
      },
      settings: null,
    });

    expect(keys.users.$key).toEqual(["users"]);
    expect(keys.users.list.$key).toEqual(["users", "list"]);
    expect(keys.users.recent.$key).toEqual(["users", "recent"]);
    expect(keys.users.active.premium.$key).toEqual([
      "users",
      "active",
      "premium",
    ]);
    expect(keys.settings.$key).toEqual(["settings"]);
  });

  it("returns the same key every time for nodes without a scope", () => {
    const keys = keycraft({ users: { list: null } });

    expect(keys.users.list.$key).toBe(keys.users.list.$key);
  });

  it("treats numeric property names as strings, like JavaScript does", () => {
    const keys = keycraft({ v1: { 2: null } });

    expect(keys.v1[2].$key).toEqual(["v1", "2"]);
  });
});

describe("$scope", () => {
  const keys = keycraft({
    users: {
      byId: {
        $scope: (id: string) => id,
        posts: { list: null },
      },
    },
  });

  it("makes a node callable, adding the scope's return value to the key", () => {
    expect(keys.users.byId("42").$key).toEqual(["users", "byId", "42"]);
    expect(keys.users.byId("42").posts.list.$key).toEqual([
      "users",
      "byId",
      "42",
      "posts",
      "list",
    ]);
  });

  it("keeps the uncalled node's key, which every scoped key starts with", () => {
    expect(keys.users.byId.$key).toEqual(["users", "byId"]);
  });

  it("puts children only on the node the call returns", () => {
    expect("posts" in keys.users.byId).toBe(false);
    expect("posts" in keys.users.byId("42")).toBe(true);
  });

  it("calls the scope each time, with every argument", () => {
    const scope = vi.fn((from: number, to: number) => `${from}-${to}`);
    const ranges = keycraft({ range: { $scope: scope } });

    expect(ranges.range(1, 5).$key).toEqual(["range", "1-5"]);
    expect(ranges.range(6, 9).$key).toEqual(["range", "6-9"]);
    expect(scope.mock.calls).toEqual([
      [1, 5],
      [6, 9],
    ]);
  });

  it("supports scopes without parameters", () => {
    const flags = keycraft({ flags: { $scope: () => "current" } });

    expect(flags.flags().$key).toEqual(["flags", "current"]);
  });

  it("adds the return value as one element, even an array or object", () => {
    const search = keycraft({
      search: { $scope: (query: string, tags: string[]) => ({ query, tags }) },
      range: { $scope: (from: number, to: number) => [from, to] },
    });

    expect(search.search("cats", ["a"]).$key).toEqual([
      "search",
      { query: "cats", tags: ["a"] },
    ]);
    expect(search.range(1, 5).$key).toEqual(["range", [1, 5]]);
  });

  it("keeps undefined in the key, so it can't collide with a child", () => {
    const todos = keycraft({
      page: { $scope: (page?: number) => page, items: null },
    });

    expect(todos.page().$key).toEqual(["page", undefined]);
    expect(todos.page().$key).toHaveLength(2);
    expect(todos.page().items.$key).toEqual(["page", undefined, "items"]);
  });

  it("supports scopes inside scopes", () => {
    const feed = keycraft({
      users: {
        byId: {
          $scope: (id: string) => id,
          posts: {
            byId: {
              $scope: (id: number) => id,
              comments: null,
            },
          },
        },
      },
    });

    expect(feed.users.byId("u1").posts.byId(7).comments.$key).toEqual([
      "users",
      "byId",
      "u1",
      "posts",
      "byId",
      7,
      "comments",
    ]);
  });

  it("can scope a top-level node", () => {
    const tenants = keycraft({
      tenant: { $scope: (id: string) => id, users: null },
    });

    expect(tenants.tenant.$key).toEqual(["tenant"]);
    expect(tenants.tenant("t1").users.$key).toEqual(["tenant", "t1", "users"]);
  });
});

describe("segment", () => {
  it("returns the definition unchanged", () => {
    const definition = { $scope: (id: string) => id, posts: null };

    expect(segment(definition)).toBe(definition);
  });

  it("can be reused in several places and inside other segments", () => {
    const paginated = segment({
      page: { $scope: (page: number) => page },
    });
    const user = segment({
      $scope: (id: string) => id,
      posts: paginated,
    });

    const keys = keycraft({ users: user, posts: paginated });

    expect(keys.users("42").posts.page(2).$key).toEqual([
      "users",
      "42",
      "posts",
      "page",
      2,
    ]);
    expect(keys.posts.page(3).$key).toEqual(["posts", "page", 3]);
  });
});

describe("nodes", () => {
  it("accept any child name, including ones functions and objects have", () => {
    const names = [
      "name",
      "length",
      "caller",
      "arguments",
      "call",
      "toString",
      "constructor",
      "hasOwnProperty",
      "__proto__",
    ];
    const children = Object.fromEntries(names.map((name) => [name, null]));
    const keys = keycraft({
      // A function node and the plain node its call returns
      byId: { $scope: (id: string) => id, ...children },
      plain: children,
    } as never) as Record<string, Record<string, { $key: unknown }>> & {
      byId: (id: string) => Record<string, { $key: unknown }>;
    };

    for (const name of names) {
      expect(Object.hasOwn(keys.byId("1"), name)).toBe(true);
      expect(keys.byId("1")[name]?.$key).toEqual(["byId", "1", name]);
      expect(keys.plain?.[name]?.$key).toEqual(["plain", name]);
    }
  });

  it("list their children but not their key", () => {
    const keys = keycraft({
      users: { list: null, byId: { $scope: (id: string) => id, posts: null } },
    });

    expect(Object.keys(keys)).toEqual(["users"]);
    expect(Object.keys(keys.users)).toEqual(["list", "byId"]);
    expect(Object.keys(keys.users.byId("1"))).toEqual(["posts"]);
  });

  it("can't be changed, and neither can their keys", () => {
    const keys = keycraft({
      users: { list: null, byId: { $scope: (id: string) => id } },
    });

    expect(Object.isFrozen(keys)).toBe(true);
    expect(Object.isFrozen(keys.users)).toBe(true);
    expect(Object.isFrozen(keys.users.list.$key)).toBe(true);
    expect(Object.isFrozen(keys.users.byId)).toBe(true);
    expect(Object.isFrozen(keys.users.byId("1").$key)).toBe(true);
    expect(() => {
      (keys.users.list.$key as unknown as unknown[]).push("x");
    }).toThrow(TypeError);
    expect(keys.users.list.$key).toEqual(["users", "list"]);
  });

  it("can be used in a string, e.g. in a log message", () => {
    const keys = keycraft({
      users: { byId: { $scope: (id: string) => id } },
    });

    expect(`${keys.users.byId("42")}`).toBe('["users","byId","42"]');
    expect(String(keys.users.byId)).toBe('["users","byId"]');
  });
});

describe("invalid definitions", () => {
  // Each of these is also a type error; the casts check the runtime checks,
  // which are what JavaScript callers get.
  it.each([
    ["not an object", null, "keycraft() takes an object of keys."],
    ["an array", [], "keycraft() takes an object of keys."],
    [
      "a top-level key starting with $",
      { $meta: null },
      'Keycraft key "$meta" can\'t start with "$": that prefix is reserved for keycraft\'s own properties, like $scope.',
    ],
    [
      "a misspelt $scope",
      { users: { $scoep: (id: string) => id } },
      'Keycraft key "users.$scoep" can\'t start with "$": that prefix is reserved for keycraft\'s own properties, like $scope.',
    ],
    [
      "a function without $scope",
      { users: { byId: (id: string) => id } },
      'Keycraft key "users.byId" is a function. To make a key that takes arguments, use { $scope: ... }.',
    ],
    [
      "a number",
      { users: { count: 1 } },
      'Keycraft key "users.count" must be null or an object.',
    ],
    [
      "an array",
      { users: [] },
      'Keycraft key "users" must be null or an object.',
    ],
    [
      "an instance of a class",
      { users: new Map() },
      'Keycraft key "users" must be null or an object.',
    ],
    [
      "a $scope that isn't a function",
      { users: { $scope: "id" } },
      'Keycraft key "users.$scope" must be a function.',
    ],
  ])("throws for %s", (_label, definition, message) => {
    expect(() => keycraft(definition as never)).toThrow(new TypeError(message));
  });

  it("throws for a definition that contains itself", () => {
    const users: Record<string, unknown> = { list: null };
    users.again = { users };

    expect(() => keycraft({ users } as never)).toThrow(
      new TypeError('Keycraft key "users.again.users" contains itself.'),
    );
  });

  it("allows the same segment in several places", () => {
    const shared = { list: null };

    expect(() => keycraft({ a: shared, b: { c: shared } })).not.toThrow();
  });
});
