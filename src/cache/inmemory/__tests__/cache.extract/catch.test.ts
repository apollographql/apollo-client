import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";

test.skip("includes path errors under __META.fieldErrors keyed by dataId and storeFieldName", () => {
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

  expect(cache.extract()).toStrictEqualTyped({
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
});

test.skip("does not embed path errors in StoreObject field values", () => {
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

  const extracted = cache.extract();

  expect(extracted["User:1"]).toStrictEqualTyped({
    __typename: "User",
    id: "1",
    name: null,
  });
  expect(extracted["User:1"]).not.toHaveProperty("__fieldErrors");
  expect(extracted["User:1"]!.name).toBe(null);
});

test.skip("omits __META.fieldErrors when the write has no path errors", () => {
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
  });

  expect(cache.extract()).toStrictEqualTyped({
    "User:1": {
      __typename: "User",
      id: "1",
      name: "Alice",
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
  });
  expect(cache.extract()).not.toHaveProperty("__META");
});

test.skip("does not store path-less errors under __META.fieldErrors", () => {
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
    errors: [{ message: "Request failed authentication" }],
  });

  const extracted = cache.extract();

  expect(extracted).toStrictEqualTyped({
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
  expect(extracted).not.toHaveProperty(["__META", "fieldErrors"]);
});

test.skip("stores path errors for a root field under ROOT_QUERY in __META.fieldErrors", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      viewerName
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

  expect(cache.extract()).toStrictEqualTyped({
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
});

test.skip("stores path errors for nested entity fields under the nested dataId", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      user {
        id
        profile {
          id
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
          id: "p1",
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

  expect(cache.extract()).toStrictEqualTyped({
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
});

test.skip("stores aliased field path errors under the field name in __META.fieldErrors", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      viewer: user {
        id
        displayName: name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      viewer: {
        __typename: "User",
        id: "1",
        displayName: null,
      },
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        // Response path uses aliases; store keys use field names.
        path: ["viewer", "displayName"],
      },
    ],
  });

  expect(cache.extract()).toStrictEqualTyped({
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
              path: ["viewer", "displayName"],
            },
          ],
        },
      },
    },
  });
});

test.skip("stores multiple path errors for the same field together", () => {
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
        message: "Primary name resolver failed",
        path: ["user", "name"],
      },
      {
        message: "Fallback name resolver failed",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.extract()).toStrictEqualTyped({
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
});

test.skip("clears a field's __META.fieldErrors entry when a later write stores a successful value", () => {
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

  expect(cache.extract()).toStrictEqualTyped({
    "User:1": {
      __typename: "User",
      id: "1",
      name: "Alice",
    },
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
  });
  expect(cache.extract()).not.toHaveProperty(["__META", "fieldErrors"]);
});

test.skip("replaces a field's __META.fieldErrors entry when a later write stores a different path error", () => {
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
        message: "First name resolver failed",
        path: ["user", "name"],
      },
    ],
  });

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
        message: "Second name resolver failed",
        path: ["user", "name"],
      },
    ],
  });

  expect(cache.extract()).toStrictEqualTyped({
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
              message: "Second name resolver failed",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("does not include optimistic-layer path errors in a non-optimistic extract", () => {
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
        message: "Root name resolver failed",
        path: ["user", "name"],
      },
    ],
  });

  cache.recordOptimisticTransaction((proxy) => {
    proxy.writeQuery({
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
          message: "Optimistic name resolver failed",
          path: ["user", "name"],
        },
      ],
    });
  }, "optimistic-name-error");

  expect(cache.extract(/* optimistic */ false)).toStrictEqualTyped({
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
              message: "Root name resolver failed",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("includes optimistic-layer path error overrides when extracting optimistically", () => {
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
        message: "Root name resolver failed",
        path: ["user", "name"],
      },
    ],
  });

  cache.recordOptimisticTransaction((proxy) => {
    proxy.writeQuery({
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
          message: "Optimistic name resolver failed",
          path: ["user", "name"],
        },
      ],
    });
  }, "optimistic-name-error");

  expect(cache.extract(/* optimistic */ true)).toStrictEqualTyped({
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
              message: "Optimistic name resolver failed",
              path: ["user", "name"],
            },
          ],
        },
      },
    },
  });
});

test.skip("preserves existing __META.extraRootIds alongside fieldErrors", () => {
  const cache = new InMemoryCache();

  cache.writeQuery({
    id: "User:1",
    query: gql`
      query {
        id
        name
      }
    `,
    data: {
      __typename: "User",
      id: "1",
      name: null,
    },
    errors: [
      {
        message: "Cannot resolve user.name",
        path: ["name"],
      },
    ],
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
});
