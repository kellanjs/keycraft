import { describe, expect, it } from "vitest";

import { keycraft } from "../src/keycraft.js";

describe("keycraft", () => {
  describe("basic key generation", () => {
    it("should create simple leaf nodes with $key", () => {
      const k = keycraft({
        users: { all: null },
      });

      expect(k.users.all.$key).toEqual(["users", "all"]);
    });

    it("should handle empty object as leaf node", () => {
      const k = keycraft({
        posts: { recent: {} },
      });

      expect(k.posts.recent.$key).toEqual(["posts", "recent"]);
    });

    it("should create nested hierarchies", () => {
      const k = keycraft({
        users: {
          active: {
            premium: null,
          },
        },
      });

      expect(k.users.active.premium.$key).toEqual([
        "users",
        "active",
        "premium",
      ]);
    });
  });

  describe("$scope functionality", () => {
    it("should make nodes callable with $scope", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
          },
        },
      });

      const userNode = k.users.userId("user-123");
      expect(userNode.$key).toEqual(["users", "userId", "user-123"]);
    });

    it("should support object scope arguments", () => {
      const k = keycraft({
        users: {
          filter: {
            $scope: (filters: { status: string; role: string }) =>
              `${filters.status}-${filters.role}`,
            posts: { all: null },
          },
        },
      });

      const filters = { status: "active", role: "admin" };

      expect(k.users.filter(filters).$key).toEqual([
        "users",
        "filter",
        "active-admin",
      ]);
      expect(k.users.filter(filters).posts.all.$key).toEqual([
        "users",
        "filter",
        "active-admin",
        "posts",
        "all",
      ]);
    });

    it("should support numeric scope values", () => {
      const k = keycraft({
        posts: {
          postId: {
            $scope: (id: number) => id,
          },
        },
      });

      expect(k.posts.postId(42).$key).toEqual(["posts", "postId", 42]);
    });

    it("should allow scope transformation", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => `user-${id}`,
          },
        },
      });

      expect(k.users.userId("123").$key).toEqual([
        "users",
        "userId",
        "user-123",
      ]);
    });

    it("should preserve children on scoped nodes", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
            posts: { all: null },
          },
        },
      });

      expect(k.users.userId("abc").posts.all.$key).toEqual([
        "users",
        "userId",
        "abc",
        "posts",
        "all",
      ]);
    });

    it("should allow accessing children before calling scope", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
            posts: { all: null },
          },
        },
      });

      // Access child without calling scope first
      expect(k.users.userId.posts.all.$key).toEqual([
        "users",
        "userId",
        "posts",
        "all",
      ]);
    });
  });

  describe("complex hierarchies", () => {
    it("should handle multiple levels of scoping", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (userId: string) => userId,
            posts: {
              postId: {
                $scope: (postId: number) => postId,
                comments: { all: null },
              },
            },
          },
        },
      });

      expect(
        k.users.userId("user-1").posts.postId(42).comments.all.$key,
      ).toEqual([
        "users",
        "userId",
        "user-1",
        "posts",
        "postId",
        42,
        "comments",
        "all",
      ]);
    });

    it("should handle sibling branches", () => {
      const k = keycraft({
        users: {
          all: null,
          active: null,
          userId: {
            $scope: (id: string) => id,
          },
        },
      });

      expect(k.users.all.$key).toEqual(["users", "all"]);
      expect(k.users.active.$key).toEqual(["users", "active"]);
      expect(k.users.userId("123").$key).toEqual(["users", "userId", "123"]);
    });

    it("should handle multiple top-level segments", () => {
      const k = keycraft({
        users: { all: null },
        posts: { recent: null },
        comments: { pending: null },
      });

      expect(k.users.all.$key).toEqual(["users", "all"]);
      expect(k.posts.recent.$key).toEqual(["posts", "recent"]);
      expect(k.comments.pending.$key).toEqual(["comments", "pending"]);
    });
  });

  describe("edge cases", () => {
    it("should filter undefined values from keys", () => {
      const k = keycraft({
        test: {
          $scope: (id: string | undefined) => id as any,
        },
      });

      expect(k.test(undefined).$key).toEqual(["test"]);
    });

    it("should ignore top-level properties starting with $", () => {
      const k = keycraft({
        $metadata: "ignored" as any,
        users: { all: null },
      });

      expect(k).toHaveProperty("users");
      expect(k).not.toHaveProperty("$metadata");
    });

    it("should skip invalid primitive child definitions", () => {
      const k = keycraft({
        users: {
          invalid: 123 as any,
          all: null,
        },
      });

      expect(k.users).toHaveProperty("all");
      expect(k.users).not.toHaveProperty("invalid");
      expect(k.users.all.$key).toEqual(["users", "all"]);
    });

    it("should handle empty definition", () => {
      const k = keycraft({});
      expect(Object.keys(k)).toEqual([]);
    });

    it("should ignore properties starting with $", () => {
      const k = keycraft({
        users: {
          $metadata: "ignored" as any,
          all: null,
        },
      });

      expect(k.users).toHaveProperty("all");
      expect(k.users).not.toHaveProperty("$metadata");
    });

    it("should handle null definition", () => {
      const k = keycraft({
        users: null,
      });

      expect(k.users.$key).toEqual(["users"]);
    });
  });

  describe("$key immutability", () => {
    it("should have non-enumerable $key property", () => {
      const k = keycraft({
        users: { all: null },
      });

      const keys = Object.keys(k.users.all);
      expect(keys).not.toContain("$key");
    });

    it("should keep $key non-enumerable on scoped nodes", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
          },
        },
      });

      const scopedNode = k.users.userId("user-123");
      const keys = Object.keys(scopedNode);

      expect(keys).not.toContain("$key");
      expect(scopedNode.$key).toEqual(["users", "userId", "user-123"]);
    });

    it("should not allow $key modification", () => {
      const k = keycraft({
        users: { all: null },
      });

      expect(() => {
        (k.users.all as any).$key = ["modified"];
      }).toThrow();
    });

    it("should return readonly array for $key", () => {
      const k = keycraft({
        users: { all: null },
      });

      const key = k.users.all.$key;
      // TypeScript enforces readonly at compile time
      // At runtime, the array is still mutable in non-strict mode
      expect(Array.isArray(key)).toBe(true);
      expect(key).toEqual(["users", "all"]);
    });
  });

  describe("real-world scenarios", () => {
    it("should support typical React Query patterns", () => {
      const k = keycraft({
        users: {
          all: null,
          userId: {
            $scope: (id: string) => id,
            profile: null,
            posts: {
              all: null,
              postId: {
                $scope: (postId: number) => postId,
              },
            },
          },
        },
        posts: {
          all: null,
          trending: null,
        },
      });

      // List queries
      expect(k.users.all.$key).toEqual(["users", "all"]);
      expect(k.posts.all.$key).toEqual(["posts", "all"]);

      // Detail queries
      expect(k.users.userId("123").profile.$key).toEqual([
        "users",
        "userId",
        "123",
        "profile",
      ]);

      // Nested queries
      expect(k.users.userId("123").posts.all.$key).toEqual([
        "users",
        "userId",
        "123",
        "posts",
        "all",
      ]);

      expect(k.users.userId("123").posts.postId(456).$key).toEqual([
        "users",
        "userId",
        "123",
        "posts",
        "postId",
        456,
      ]);
    });

    it("should support pagination patterns", () => {
      const k = keycraft({
        posts: {
          page: {
            $scope: (page: number) => page,
            limit: {
              $scope: (limit: number) => limit,
            },
          },
        },
      });

      expect(k.posts.page(1).limit(10).$key).toEqual([
        "posts",
        "page",
        1,
        "limit",
        10,
      ]);
    });

    it("should support filter patterns", () => {
      const k = keycraft({
        users: {
          filter: {
            $scope: (filters: { status: string; role: string }) =>
              JSON.stringify(filters),
          },
        },
      });

      const filters = { status: "active", role: "admin" };
      expect(k.users.filter(filters).$key).toEqual([
        "users",
        "filter",
        JSON.stringify(filters),
      ]);
    });
  });
});
