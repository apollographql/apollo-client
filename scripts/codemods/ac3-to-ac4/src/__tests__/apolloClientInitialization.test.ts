import { applyTransform } from "jscodeshift/dist/testUtils";
import { describe, expect, test } from "vitest";

import apolloClientInitializationTransform from "../apolloClientInitialization.js";

const transform = ([source]: TemplateStringsArray) =>
  applyTransform(
    apolloClientInitializationTransform,
    {},
    { source },
    { parser: "ts" }
  );

describe("http link intialization", () => {
  test("all options", () => {
    expect(
      transform`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  uri: "https://example.com/graphql",
  cache: new InMemoryCache(),
  credentials: "include",
  devtools: { enabled: true },
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient, HttpLink } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        devtools: { enabled: true },

        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("only uri", () => {
    expect(
      transform`
import { ApolloClient, InMemoryCache } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://example.com/graphql",
  devtools: { enabled: true },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        devtools: { enabled: true },
        link: new HttpLink({
          uri: "https://example.com/graphql"
        }),
      })"
    `);
  });

  test("HttpLink import already there", () => {
    expect(
      transform`
import { ApolloClient } from "@apollo/client";
import { HttpLink } from "@apollo/client/link/http";

new ApolloClient({
  uri: "https://example.com/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";
      import { HttpLink } from "@apollo/client/link/http";

      new ApolloClient({
        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("HttpLink entry point already there", () => {
    expect(
      transform`
import { ApolloClient } from "@apollo/client";
import { defaultPrinter } from "@apollo/client/link/http";

new ApolloClient({
  uri: "https://example.com/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";
      import { defaultPrinter, HttpLink } from "@apollo/client/link/http";

      new ApolloClient({
        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("link already present inline", () => {
    expect(
      transform`
import { ApolloClient } from "@apollo/client";
import { BatchHttpLink } from "@apollo/client/link/batch-http";

new ApolloClient({
  link: new BatchHttpLink({
    uri: "http://localhost:4000/graphql",
    batchMax: 5,
    batchInterval: 20
  })
})
`
    ).toMatchInlineSnapshot(`""`);
  });

  test("link already present shorthand", () => {
    expect(
      transform`
import { ApolloClient } from "@apollo/client";
import { BatchHttpLink } from "@apollo/client/link/batch-http";

const link = new BatchHttpLink({
  uri: "http://localhost:4000/graphql",
  batchMax: 5,
  batchInterval: 20
});

new ApolloClient({
  link
})
`
    ).toMatchInlineSnapshot(`""`);
  });
});
