import { describe, expect, it } from "vitest";

import { segment } from "../src/helpers.js";
import { keycraft } from "../src/keycraft.js";

describe("segment", () => {
  it("should return the definition unchanged", () => {
    const def = {
      $scope: (id: string) => id,
      posts: { all: null },
    };

    const result = segment(def);
    expect(result).toBe(def);
  });

  it("should work with keycraft", () => {
    const usersSegment = segment({
      $scope: (id: string) => id,
      posts: { all: null },
    });

    const k = keycraft({
      users: usersSegment,
    });

    expect(k.users("123").posts.all.$key).toEqual([
      "users",
      "123",
      "posts",
      "all",
    ]);
  });

  it("should preserve type information", () => {
    const postsSegment = segment({
      all: null,
      postId: {
        $scope: (id: number) => id,
        comments: { all: null },
      },
    });

    const k = keycraft({
      posts: postsSegment,
    });

    expect(k.posts.all.$key).toEqual(["posts", "all"]);
    expect(k.posts.postId(42).comments.all.$key).toEqual([
      "posts",
      "postId",
      42,
      "comments",
      "all",
    ]);
  });

  it("should work with null definitions", () => {
    const leafSegment = segment(null);
    const k = keycraft({
      leaf: leafSegment,
    });

    expect(k.leaf.$key).toEqual(["leaf"]);
  });

  it("should work with empty object definitions", () => {
    const emptySegment = segment({});
    const k = keycraft({
      empty: emptySegment,
    });

    expect(k.empty.$key).toEqual(["empty"]);
  });

  it("should allow composing segments", () => {
    const profileSegment = segment({
      settings: null,
      preferences: null,
    });

    const userSegment = segment({
      $scope: (id: string) => id,
      profile: profileSegment,
      posts: { all: null },
    });

    const k = keycraft({
      users: userSegment,
    });

    expect(k.users("123").profile.settings.$key).toEqual([
      "users",
      "123",
      "profile",
      "settings",
    ]);
  });
});
