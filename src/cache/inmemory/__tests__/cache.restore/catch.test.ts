import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

test.skip("restores path errors from __META.fieldErrors for @catch(to: NULL) reads", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: NULL)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: null,
      },
    },
  });
});

test.skip("restores path errors from __META.fieldErrors for @catch(to: RESULT) reads", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: false,
          errors: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("restores path errors from __META.fieldErrors for @catch(to: THROW) reads", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: THROW)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  expect(() => {
    cache.diff({ query, optimistic: false });
  }).toThrow();
});

test.skip("restores without __META.fieldErrors leaves fields as ordinary null values", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: true,
          value: null,
        },
      },
    },
  });
});

test.skip("restores path errors for a root field under ROOT_QUERY", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      viewerName @catch(to: RESULT)
    }
  `;

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      viewerName: null,
    },
    __META: {
      fieldErrors: {
        ROOT_QUERY: {
          viewerName: [
            {
              message: "Cannot resolve viewerName",
              path: ["viewerName"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      viewerName: {
        ok: false,
        errors: [
          {
            message: "Cannot resolve viewerName",
            path: ["viewerName"],
          },
        ],
      },
    },
  });
});

test.skip("restores path errors for nested entity fields", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        profile {
          id
          email @catch(to: RESULT)
        }
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      profile: { __ref: "Profile:p1" },
    },
    "Profile:p1": {
      __typename: "Profile",
      id: "p1",
      email: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "Profile:p1": {
          email: [
            {
              message: "Cannot resolve profile.email",
              path: ["user", "profile", "email"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        profile: {
          __typename: "Profile",
          id: "p1",
          email: {
            ok: false,
            errors: [
              {
                message: "Cannot resolve profile.email",
                path: ["user", "profile", "email"],
              },
            ],
          },
        },
      },
    },
  });
});

test.skip("restores multiple path errors for the same field", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Primary name resolver failed",
              path: ["user", "name"],
            },
            {
              message: "Fallback name resolver failed",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: false,
          errors: [
            {
              message: "Primary name resolver failed",
              path: ["user", "name"],
            },
            {
              message: "Fallback name resolver failed",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("round-trips path errors through extract and restore", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
      }
    }
  `;
  const readQuery = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: null,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  const snapshot = cache.extract();

  const restored = new InMemoryCache();
  restored.restore(snapshot);

  expect(restored.extract()).toStrictEqualTyped(snapshot);
  expect(
    restored.diff({ query: readQuery, optimistic: false })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: false,
          errors: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("clears restored field errors when a later write stores a successful value", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
      }
    }
  `;
  const readQuery = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: "Alice",
      },
    },
  });

  expect(cache.extract()).not.toHaveProperty(["__META", "fieldErrors"]);
  expect(
    cache.diff({ query: readQuery, optimistic: false })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: true,
          value: "Alice",
        },
      },
    },
  });
});

test.skip("preserves __META.extraRootIds when restoring fieldErrors", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      id
      name @catch(to: RESULT)
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    __META: {
      extraRootIds: ["User:1"],
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["name"],
            },
          ],
        },
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    "User:1": {
      __typename: "User",
      id: "1",
      name: null,
    },
    __META: {
      extraRootIds: ["User:1"],
      fieldErrors: {
        "User:1": {
          name: [
            {
              message: "Cannot resolve user.name",
              path: ["name"],
            },
          ],
        },
      },
    },
  });

  expect(
    cache.diff({
      id: "User:1",
      query,
      optimistic: false,
    })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      __typename: "User",
      id: "1",
      name: {
        ok: false,
        errors: [
          {
            message: "Cannot resolve user.name",
            path: ["name"],
          },
        ],
      },
    },
  });
});

test.skip("ignores fieldErrors entries for dataIds that are not present in the restored data", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.restore({
    "User:1": {
      __typename: "User",
      id: "1",
      name: "Alice",
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    __META: {
      fieldErrors: {
        "User:999": {
          name: [
            {
              message: "Stale error for missing entity",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: {
          ok: true,
          value: "Alice",
        },
      },
    },
  });
});
