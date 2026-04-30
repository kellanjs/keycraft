import { describe, expectTypeOf, it } from "vitest";

import { keycraft, segment } from "../src/index.js";
import type { InferNode, QueryKey, SegmentDefinition } from "../src/types.js";

describe("type inference", () => {
  it("should infer correct types for simple structures", () => {
    const k = keycraft({
      users: { all: null },
    });

    expectTypeOf(k.users.all.$key).toEqualTypeOf<QueryKey>();
    expectTypeOf(k.users.all.$key).toExtend<readonly unknown[]>();
  });

  it("should infer callable types for $scope", () => {
    const k = keycraft({
      users: {
        userId: {
          $scope: (id: string) => id,
        },
      },
    });

    expectTypeOf(k.users.userId).toBeCallableWith("123");
    expectTypeOf(k.users.userId("123").$key).toEqualTypeOf<QueryKey>();
  });

  it("should infer nested callable types", () => {
    const k = keycraft({
      users: {
        userId: {
          $scope: (id: string) => id,
          posts: {
            postId: {
              $scope: (postId: number) => postId,
            },
          },
        },
      },
    });

    expectTypeOf(k.users.userId).toBeCallableWith("123");
    expectTypeOf(k.users.userId("123").posts.postId).toBeCallableWith(456);
    expectTypeOf(
      k.users.userId("123").posts.postId(456).$key,
    ).toEqualTypeOf<QueryKey>();
  });

  it("should infer types for segment helper", () => {
    const usersSegment = segment({
      $scope: (id: string) => id,
      posts: { all: null },
    });

    expectTypeOf(usersSegment).toExtend<SegmentDefinition>();

    const k = keycraft({
      users: usersSegment,
    });

    expectTypeOf(k.users).toBeCallableWith("123");
    expectTypeOf(k.users("123").posts.all.$key).toEqualTypeOf<QueryKey>();
  });

  it("should infer InferNode type correctly", () => {
    type TestSegment = {
      $scope: (id: string) => string;
      posts: { all: null };
    };

    type InferredNode = InferNode<TestSegment>;

    expectTypeOf<InferredNode>().toHaveProperty("$key");
    expectTypeOf<InferredNode>().toExtend<(input: string) => any>();
  });

  it("should enforce correct parameter types", () => {
    const k = keycraft({
      users: {
        userId: {
          $scope: (id: string) => id,
        },
      },
      posts: {
        postId: {
          $scope: (id: number) => id,
        },
      },
    });

    // These should type-check correctly
    expectTypeOf(k.users.userId).parameter(0).toBeString();
    expectTypeOf(k.posts.postId).parameter(0).toBeNumber();
  });

  it("should handle complex object parameters", () => {
    const k = keycraft({
      users: {
        filter: {
          $scope: (filters: { status: string; role: string }) =>
            JSON.stringify(filters),
          posts: { all: null },
        },
      },
    });

    expectTypeOf(k.users.filter)
      .parameter(0)
      .toEqualTypeOf<{ status: string; role: string }>();
    expectTypeOf(k.users.filter).toBeCallableWith({
      status: "active",
      role: "admin",
    });
    expectTypeOf(
      k.users.filter({ status: "active", role: "admin" }).$key,
    ).toEqualTypeOf<QueryKey>();
    expectTypeOf(
      k.users.filter({ status: "active", role: "admin" }).posts.all.$key,
    ).toEqualTypeOf<QueryKey>();
  });

  it("should preserve readonly on $key", () => {
    const k = keycraft({
      users: { all: null },
    });

    expectTypeOf(k.users.all.$key).toExtend<readonly unknown[]>();
  });
});
