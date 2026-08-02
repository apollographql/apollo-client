import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { markAsStreaming } from "@apollo/client/testing/internal";
import { handleIncrementalSymbol } from "@apollo/client/utilities/internal";

test.skip("returns null for a field with @catch(to: NULL) when the field has a path error", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: NULL)
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

test.skip("returns FieldResult failure for a field with @catch(to: RESULT) when the field has a path error", () => {
  const cache = new InMemoryCache();
  const query = gql`
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

test.skip("throws for a field with @catch(to: THROW) when the field has a path error", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: THROW)
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

  expect(() => {
    cache.diff({ query, optimistic: false });
  }).toThrow();
});

test.skip("returns null for an uncaught field when the operation has @catchByDefault(to: NULL)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query UserQuery @catchByDefault(to: NULL) {
      user {
        id
        name
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

test.skip("returns FieldResult failure for an uncaught field when the operation has @catchByDefault(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query UserQuery @catchByDefault(to: RESULT) {
      user {
        id
        name
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

test.skip("throws for an uncaught field when the operation has @catchByDefault(to: THROW)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query UserQuery @catchByDefault(to: THROW) {
      user {
        id
        name
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

  expect(() => {
    cache.diff({ query, optimistic: false });
  }).toThrow();
});

test.skip("returns null for an uncaught field when cache.diff is called with catchByDefault: NULL", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
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

  expect(
    cache.diff({ query, optimistic: false, catchByDefault: "NULL" })
  ).toStrictEqualTyped({
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

test.skip("returns FieldResult failure for an uncaught field when cache.diff is called with catchByDefault: RESULT", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
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

  expect(
    cache.diff({ query, optimistic: false, catchByDefault: "RESULT" })
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

test.skip("throws for an uncaught field when cache.diff is called with catchByDefault: THROW", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
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

  expect(() => {
    cache.diff({ query, optimistic: false, catchByDefault: "THROW" });
  }).toThrow();
});

test.skip("returns FieldResult success for a field with @catch(to: RESULT) when the field has no error", () => {
  const cache = new InMemoryCache();
  const query = gql`
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
        name: "Alice",
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

test.skip("does not treat path-less errors as field errors for @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
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
    errors: [{ message: "Request failed authentication" }],
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

test.skip("does not throw for path-less errors when cache.diff uses catchByDefault: THROW", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: "Alice",
      },
    },
    errors: [{ message: "Request failed authentication" }],
  });

  expect(
    cache.diff({ query, optimistic: false, catchByDefault: "THROW" })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        __typename: "User",
        id: "1",
        name: "Alice",
      },
    },
  });
});

test.skip("returns FieldResult failure for a nested field with @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        profile {
          email @catch(to: RESULT)
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        profile: {
          __typename: "Profile",
          email: null,
        },
      },
    },
    errors: [
      {
        message: "Cannot resolve profile.email",
        path: ["user", "profile", "email"],
      },
    ],
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

test.skip("returns FieldResult failure for a list item field with @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      users {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      users: [
        {
          __typename: "User",
          id: "1",
          name: "Alice",
        },
        {
          __typename: "User",
          id: "2",
          name: null,
        },
      ],
    },
    errors: [
      {
        message: "Cannot resolve users.1.name",
        path: ["users", 1, "name"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      users: [
        {
          __typename: "User",
          id: "1",
          name: {
            ok: true,
            value: "Alice",
          },
        },
        {
          __typename: "User",
          id: "2",
          name: {
            ok: false,
            errors: [
              {
                message: "Cannot resolve users.1.name",
                path: ["users", 1, "name"],
              },
            ],
          },
        },
      ],
    },
  });
});

test.skip("keeps sibling fields intact when a field with @catch(to: RESULT) errors", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: RESULT)
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
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
        age: 30,
      },
    },
  });
});

test.skip("field @catch overrides operation @catchByDefault", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query UserQuery @catchByDefault(to: THROW) {
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

test.skip("field @catch overrides catchByDefault option on cache.diff", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        name @catch(to: NULL)
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

  expect(
    cache.diff({ query, optimistic: false, catchByDefault: "THROW" })
  ).toStrictEqualTyped({
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

test.skip("operation @catchByDefault overrides catchByDefault option on cache.diff", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query UserQuery @catchByDefault(to: RESULT) {
      user {
        id
        name
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

  expect(
    cache.diff({ query, optimistic: false, catchByDefault: "THROW" })
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

test.skip("returns FieldResult failure for a deferred field with @catch(to: RESULT) when the deferred field has a path error", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        ... on User @defer {
          name @catch(to: RESULT)
        }
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

  expect(
    cache.diff({
      query,
      optimistic: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    complete: true,
    dataState: "complete",
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

test.skip("throws for a deferred field with @catch(to: THROW) when the deferred field has a path error", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        ... on User @defer {
          name @catch(to: THROW)
        }
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

  expect(() => {
    cache.diff({
      query,
      optimistic: false,
      [handleIncrementalSymbol]: undefined,
    });
  }).toThrow();
});

test.skip("returns streaming data without applying @catch for deferred fields that have not arrived yet", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        ... on User @defer {
          name @catch(to: RESULT)
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: false,
      returnPartialData: true,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      user: {
        __typename: "User",
        id: "1",
      },
    }),
  });
});

test.skip("collects multiple path errors on the same field under @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
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
        message: "Primary name resolver failed",
        path: ["user", "name"],
      },
      {
        message: "Fallback name resolver failed",
        path: ["user", "name"],
      },
    ],
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

test.skip("applies @catch only to fields under the annotated operation when reading a different query shape", () => {
  const cache = new InMemoryCache();
  const writeQuery = gql`
    query {
      user {
        id
        name
      }
    }
  `;
  const readQuery = gql`
    query UserQuery @catchByDefault(to: RESULT) {
      user {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query: writeQuery,
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

test.skip("returns FieldResult failure for an error on a root field with @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      viewerName @catch(to: RESULT)
    }
  `;

  cache.writeQuery({
    query,
    data: {
      viewerName: null,
    },
    errors: [
      {
        message: "Cannot resolve viewerName",
        path: ["viewerName"],
      },
    ],
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

test.skip("returns null for a nested field with @catch(to: NULL) without nulling ancestor objects", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        profile {
          email @catch(to: NULL)
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        profile: {
          __typename: "Profile",
          email: null,
        },
      },
    },
    errors: [
      {
        message: "Cannot resolve profile.email",
        path: ["user", "profile", "email"],
      },
    ],
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
          email: null,
        },
      },
    },
  });
});

test.skip("bubbles a child path error to a parent field with @catch(to: NULL)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: NULL) {
        id
        name
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: null,
    },
  });
});

test.skip("bubbles a child path error to a parent field with @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: RESULT) {
        id
        name
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        ok: false,
        errors: [
          {
            message: "Cannot resolve user.name",
            path: ["user", "name"],
          },
        ],
      },
    },
  });
});

test.skip("bubbles a child path error to a parent field with @catch(to: THROW)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: THROW) {
        id
        name
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(() => {
    cache.diff({ query, optimistic: false });
  }).toThrow();
});

test.skip("bubbles a deeply nested path error to an ancestor field with @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: RESULT) {
        id
        profile {
          email
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      user: {
        __typename: "User",
        id: "1",
        profile: {
          __typename: "Profile",
          email: null,
        },
      },
    },
    errors: [
      {
        message: "Cannot resolve profile.email",
        path: ["user", "profile", "email"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        ok: false,
        errors: [
          {
            message: "Cannot resolve profile.email",
            path: ["user", "profile", "email"],
          },
        ],
      },
    },
  });
});

test.skip("does not bubble a child error to a parent @catch when the child already has @catch(to: NULL)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: RESULT) {
        id
        name @catch(to: NULL)
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        ok: true,
        value: {
          __typename: "User",
          id: "1",
          name: null,
          age: 30,
        },
      },
    },
  });
});

test.skip("does not bubble a child error to a parent @catch when the child already has @catch(to: RESULT)", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user @catch(to: RESULT) {
        id
        name @catch(to: RESULT)
        age
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
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      user: {
        ok: true,
        value: {
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
          age: 30,
        },
      },
    },
  });
});

test.skip("honors @catch(to: NULL) when reading an overlapping field written by a different query", () => {
  const cache = new InMemoryCache();
  const writeQuery = gql`
    query WriteUser {
      user {
        id
        name
        age
      }
    }
  `;
  const readQuery = gql`
    query ReadUserName {
      user {
        id
        name @catch(to: NULL)
      }
    }
  `;

  cache.writeQuery({
    query: writeQuery,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: null,
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(
    cache.diff({ query: readQuery, optimistic: false })
  ).toStrictEqualTyped({
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

test.skip("honors @catch(to: RESULT) when reading an overlapping field written by a different query", () => {
  const cache = new InMemoryCache();
  const writeQuery = gql`
    query WriteUser {
      user {
        id
        name
        age
      }
    }
  `;
  const readQuery = gql`
    query ReadUserName {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.writeQuery({
    query: writeQuery,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: null,
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

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

test.skip("honors @catch(to: THROW) when reading an overlapping field written by a different query", () => {
  const cache = new InMemoryCache();
  const writeQuery = gql`
    query WriteUser {
      user {
        id
        name
        age
      }
    }
  `;
  const readQuery = gql`
    query ReadUserName {
      user {
        id
        name @catch(to: THROW)
      }
    }
  `;

  cache.writeQuery({
    query: writeQuery,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: null,
        age: 30,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["user", "name"],
      },
    ],
  });

  expect(() => {
    cache.diff({ query: readQuery, optimistic: false });
  }).toThrow();
});

test.skip("clears field error metadata when an overlapping write stores a successful value for the same field", () => {
  const cache = new InMemoryCache();
  const writeWithError = gql`
    query WriteUserWithError {
      user {
        id
        name
      }
    }
  `;
  const writeSuccess = gql`
    query WriteUserSuccess {
      user {
        id
        name
      }
    }
  `;
  const readQuery = gql`
    query ReadUserName {
      user {
        id
        name @catch(to: RESULT)
      }
    }
  `;

  cache.writeQuery({
    query: writeWithError,
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

  cache.writeQuery({
    query: writeSuccess,
    data: {
      user: {
        __typename: "User",
        id: "1",
        name: "Alice",
      },
    },
  });

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
