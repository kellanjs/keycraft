import { describe, expect, it } from "vitest";

import { keycraft, segment } from "../src/index.js";

describe("integration tests", () => {
  describe("TanStack Query integration patterns", () => {
    it("should support invalidation patterns", () => {
      const k = keycraft({
        users: {
          all: null,
          userId: {
            $scope: (id: string) => id,
            profile: null,
            posts: { all: null },
          },
        },
      });

      // Invalidate all users queries
      expect(k.users.$key).toEqual(["users"]);

      // Invalidate specific user
      expect(k.users.userId("123").$key).toEqual(["users", "userId", "123"]);

      // Invalidate user's posts
      expect(k.users.userId("123").posts.$key).toEqual([
        "users",
        "userId",
        "123",
        "posts",
      ]);
    });

    it("should support prefetching patterns", () => {
      const k = keycraft({
        posts: {
          all: null,
          postId: {
            $scope: (id: number) => id,
            comments: { all: null },
          },
        },
      });

      // Prefetch post list
      const listKey = k.posts.all.$key;
      expect(listKey).toEqual(["posts", "all"]);

      // Prefetch specific post
      const detailKey = k.posts.postId(1).$key;
      expect(detailKey).toEqual(["posts", "postId", 1]);

      // Prefetch post comments
      const commentsKey = k.posts.postId(1).comments.all.$key;
      expect(commentsKey).toEqual(["posts", "postId", 1, "comments", "all"]);
    });

    it("should support optimistic updates", () => {
      const k = keycraft({
        todos: {
          all: null,
          todoId: {
            $scope: (id: string) => id,
          },
        },
      });

      // Get keys for optimistic update
      const listKey = k.todos.all.$key;
      const itemKey = k.todos.todoId("todo-1").$key;

      expect(listKey).toEqual(["todos", "all"]);
      expect(itemKey).toEqual(["todos", "todoId", "todo-1"]);
    });
  });

  describe("complex real-world scenarios", () => {
    it("should handle e-commerce product catalog", () => {
      const k = keycraft({
        products: {
          all: null,
          category: {
            $scope: (categoryId: string) => categoryId,
            all: null,
          },
          productId: {
            $scope: (id: string) => id,
            details: null,
            reviews: {
              all: null,
              page: {
                $scope: (page: number) => page,
              },
            },
            related: null,
          },
        },
      });

      expect(k.products.all.$key).toEqual(["products", "all"]);
      expect(k.products.category("electronics").all.$key).toEqual([
        "products",
        "category",
        "electronics",
        "all",
      ]);
      expect(k.products.productId("prod-123").details.$key).toEqual([
        "products",
        "productId",
        "prod-123",
        "details",
      ]);
      expect(k.products.productId("prod-123").reviews.page(2).$key).toEqual([
        "products",
        "productId",
        "prod-123",
        "reviews",
        "page",
        2,
      ]);
    });

    it("should handle social media feed", () => {
      const k = keycraft({
        feed: {
          home: null,
          userId: {
            $scope: (userId: string) => userId,
            posts: {
              all: null,
              postId: {
                $scope: (postId: string) => postId,
                likes: { all: null },
                comments: {
                  all: null,
                  commentId: {
                    $scope: (commentId: string) => commentId,
                  },
                },
              },
            },
          },
        },
      });

      expect(k.feed.home.$key).toEqual(["feed", "home"]);
      expect(k.feed.userId("user-1").posts.all.$key).toEqual([
        "feed",
        "userId",
        "user-1",
        "posts",
        "all",
      ]);
      expect(
        k.feed.userId("user-1").posts.postId("post-1").comments.all.$key,
      ).toEqual([
        "feed",
        "userId",
        "user-1",
        "posts",
        "postId",
        "post-1",
        "comments",
        "all",
      ]);
    });

    it("should handle multi-tenant application", () => {
      const k = keycraft({
        tenants: {
          tenantId: {
            $scope: (tenantId: string) => tenantId,
            users: {
              all: null,
              userId: {
                $scope: (userId: string) => userId,
              },
            },
            settings: null,
          },
        },
      });

      expect(k.tenants.tenantId("tenant-1").users.all.$key).toEqual([
        "tenants",
        "tenantId",
        "tenant-1",
        "users",
        "all",
      ]);
      expect(
        k.tenants.tenantId("tenant-1").users.userId("user-1").$key,
      ).toEqual([
        "tenants",
        "tenantId",
        "tenant-1",
        "users",
        "userId",
        "user-1",
      ]);
    });
  });

  describe("segment composition", () => {
    it("should compose reusable segments", () => {
      const paginationSegment = segment({
        page: {
          $scope: (page: number) => page,
          limit: {
            $scope: (limit: number) => limit,
          },
        },
      });

      const k = keycraft({
        users: {
          all: paginationSegment,
        },
        posts: {
          all: paginationSegment,
        },
      });

      expect(k.users.all.page(1).limit(10).$key).toEqual([
        "users",
        "all",
        "page",
        1,
        "limit",
        10,
      ]);
      expect(k.posts.all.page(2).limit(20).$key).toEqual([
        "posts",
        "all",
        "page",
        2,
        "limit",
        20,
      ]);
    });

    it("should compose nested segments", () => {
      const commentsSegment = segment({
        all: null,
        commentId: {
          $scope: (id: string) => id,
        },
      });

      const postsSegment = segment({
        all: null,
        postId: {
          $scope: (id: string) => id,
          comments: commentsSegment,
        },
      });

      const k = keycraft({
        posts: postsSegment,
      });

      expect(
        k.posts.postId("post-1").comments.commentId("comment-1").$key,
      ).toEqual([
        "posts",
        "postId",
        "post-1",
        "comments",
        "commentId",
        "comment-1",
      ]);
    });
  });

  describe("key stability", () => {
    it("should generate consistent keys for same inputs", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
          },
        },
      });

      const key1 = k.users.userId("123").$key;
      const key2 = k.users.userId("123").$key;

      expect(key1).toEqual(key2);
    });

    it("should generate different keys for different inputs", () => {
      const k = keycraft({
        users: {
          userId: {
            $scope: (id: string) => id,
          },
        },
      });

      const key1 = k.users.userId("123").$key;
      const key2 = k.users.userId("456").$key;

      expect(key1).not.toEqual(key2);
    });

    it("should handle object parameters consistently", () => {
      const k = keycraft({
        search: {
          query: {
            $scope: (params: { q: string; page: number }) =>
              JSON.stringify(params),
          },
        },
      });

      const params1 = { q: "test", page: 1 };
      const params2 = { q: "test", page: 1 };

      const key1 = k.search.query(params1).$key;
      const key2 = k.search.query(params2).$key;

      expect(key1).toEqual(key2);
    });
  });
});
