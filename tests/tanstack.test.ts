/**
 * Checks the keys against a real TanStack Query cache: how its prefix
 * matching treats the tree, and that its typed query function context sees the
 * exact key types.
 */
import { QueryClient } from "@tanstack/query-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import { keycraft } from "../src/index.js";

const keys = keycraft({
  users: {
    list: null,
    byId: {
      $scope: (id: string) => id,
      profile: null,
      posts: null,
    },
  },
  notes: {
    byNotebook: {
      $scope: (id: string) => id,
      search: { $scope: (params: { query: string; limit: number }) => params },
    },
  },
  todos: {
    page: { $scope: (page?: number) => page },
  },
});

/** Fills a cache with a query for each key, and returns a staleness check. */
function cacheWith(queryKeys: readonly (readonly unknown[])[]) {
  const client = new QueryClient();
  for (const queryKey of queryKeys) {
    client.setQueryData(queryKey, "data");
  }
  const isInvalidated = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated;
  return { client, isInvalidated };
}

describe("TanStack Query prefix matching", () => {
  it("lets a node's key invalidate everything below it", async () => {
    const { client, isInvalidated } = cacheWith([
      keys.users.list.$key,
      keys.users.byId("1").profile.$key,
      keys.users.byId("2").posts.$key,
    ]);

    await client.invalidateQueries({ queryKey: keys.users.byId.$key });

    expect(isInvalidated(keys.users.byId("1").profile.$key)).toBe(true);
    expect(isInvalidated(keys.users.byId("2").posts.$key)).toBe(true);
    expect(isInvalidated(keys.users.list.$key)).toBe(false);
  });

  it("keeps siblings apart, so a list belongs next to the scoped node", async () => {
    const { client, isInvalidated } = cacheWith([
      keys.users.list.$key,
      keys.users.byId("1").profile.$key,
    ]);

    await client.invalidateQueries({ queryKey: keys.users.list.$key });

    expect(isInvalidated(keys.users.list.$key)).toBe(true);
    expect(isInvalidated(keys.users.byId("1").profile.$key)).toBe(false);
  });

  it("matches a node's children too, unless the filter is exact", async () => {
    // A node that's a query and also has children: invalidating it reaches
    // its children, so it needs `exact: true` to target only itself
    const listKey = keys.notes.byNotebook("nb").$key;
    const searchKey = keys.notes
      .byNotebook("nb")
      .search({ query: "a", limit: 5 }).$key;
    const { client, isInvalidated } = cacheWith([listKey, searchKey]);

    await client.invalidateQueries({ queryKey: listKey, exact: true });
    expect(isInvalidated(searchKey)).toBe(false);

    await client.invalidateQueries({ queryKey: listKey });
    expect(isInvalidated(searchKey)).toBe(true);
  });

  it("matches object scope values regardless of property order", () => {
    const { client } = cacheWith([
      keys.notes.byNotebook("nb").search({ query: "a", limit: 5 }).$key,
    ]);

    const reordered = keys.notes.byNotebook("nb").search({
      limit: 5,
      query: "a",
    }).$key;
    expect(client.getQueryData(reordered)).toBe("data");
  });

  it("can't tell dates apart, which is why scopes can't return them", async () => {
    // TanStack compares objects by their own properties when matching by
    // prefix, and a Date has none. The casts get past keycraft's check.
    const events = keycraft({
      onDay: { $scope: (day: Date) => day as never },
    });
    const january = events.onDay(new Date("2026-01-01")).$key;
    const march = events.onDay(new Date("2026-03-01")).$key;
    const { client, isInvalidated } = cacheWith([january, march]);

    await client.invalidateQueries({ queryKey: january });

    expect(isInvalidated(march)).toBe(true);
  });

  it("keeps a scope that returned undefined distinct from the others", async () => {
    const { client, isInvalidated } = cacheWith([
      keys.todos.page().$key,
      keys.todos.page(2).$key,
    ]);

    await client.invalidateQueries({ queryKey: keys.todos.page(2).$key });
    expect(isInvalidated(keys.todos.page().$key)).toBe(false);

    await client.invalidateQueries({ queryKey: keys.todos.page.$key });
    expect(isInvalidated(keys.todos.page().$key)).toBe(true);
  });
});

describe("TanStack Query query functions", () => {
  it("receive the key with its exact type", async () => {
    const client = new QueryClient();

    const user = await client.fetchQuery({
      queryKey: keys.users.byId("42").profile.$key,
      queryFn: ({ queryKey: [, , id] }) => {
        expectTypeOf(id).toBeString();
        return { id };
      },
    });

    expect(user).toEqual({ id: "42" });
  });
});
