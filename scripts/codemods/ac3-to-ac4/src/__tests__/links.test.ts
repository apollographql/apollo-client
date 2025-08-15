import { applyTransform } from "jscodeshift/dist/testUtils";
import { expect, test } from "vitest";

import links from "../links.js";

const transform = ([source]: TemplateStringsArray) =>
  applyTransform(links, {}, { source }, { parser: "ts" });

test("`concat` moves onto `ApolloLink`", () => {
  expect(
    transform`
import { concat } from "@apollo/client";

const link = concat(link1, link2);
`
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client";

    const link = ApolloLink.concat(link1, link2);"
  `);
});

test("`empty` moves onto `ApolloLink`", () => {
  expect(
    transform`
import { empty } from "@apollo/client";

const link = empty();
`
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client";

    const link = ApolloLink.empty();"
  `);
});

test("`from` moves onto `ApolloLink`", () => {
  expect(
    transform`
import { from } from "@apollo/client";

const link = from(link1, link2);
`
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client";

    const link = ApolloLink.from(link1, link2);"
  `);
});

test("`split` moves onto `ApolloLink`", () => {
  expect(
    transform`
import { split } from "@apollo/client";

const link = split(op => op.operationType === "mutation", link1, link2);
`
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client";

    const link = ApolloLink.split(op => op.operationType === "mutation", link1, link2);"
  `);
});

test("combined", () => {
  expect(
    transform`
import { split, from, concat } from "@apollo/client";
import { ApolloLink, empty} from "@apollo/client/link";

const logLink = new ApolloLink((op, forward) => {
    console.log(op);
    return forward(op);
})

let link = split(op => op.operationType === "mutation", logLink, empty);
link = from([link, concat(logLink, link)]);
`
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client/link";

    const logLink = new ApolloLink((op, forward) => {
        console.log(op);
        return forward(op);
    })

    let link = ApolloLink.split(op => op.operationType === "mutation", logLink, ApolloLink.empty);
    link = ApolloLink.from([link, ApolloLink.concat(logLink, link)]);"
  `);
});

test("`onError` renames to `ErrorLink`", () => {
  expect(
    transform`
import { onError } from "@apollo/client/link/error";

const link = onError(({ graphQLErrors, networkError }) => {
  /** foo */
})
`
  ).toMatchInlineSnapshot(`
    "import { ErrorLink } from "@apollo/client/link/error";

    const link = new ErrorLink(({ graphQLErrors, networkError }) => {
      /** foo */
    })"
  `);
});

test("`setContext` stays untouched", () => {
  expect(
    transform`
import { setContext } from "@apollo/client/link/error";

const link = setContext((operation, prevContext) => {
  return {
    credentials: "include",
  };
});
`
  ).toMatchInlineSnapshot(`""`);
});

test("`createPersistedQueryLink` renames to `PersistedQueryLink`", () => {
  expect(
    transform`
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { sha256 } from "crypto-hash";

const link = new createPersistedQueryLink({
  sha256: (queryString) => sha256(queryString),
});
`
  ).toMatchInlineSnapshot(`
    "import { PersistedQueryLink } from "@apollo/client/link/persisted-queries";
    import { sha256 } from "crypto-hash";

    const link = new PersistedQueryLink({
      sha256: (queryString) => sha256(queryString),
    });"
  `);
});

test("`createHttpLink` renames to `HttpLink`", () => {
  expect(
    transform`
import { createHttpLink } from "@apollo/client";

const link = createHttpLink({
  uri: "http://localhost:4000/graphql",
  // Additional options
});
`
  ).toMatchInlineSnapshot(`
    "import { HttpLink } from "@apollo/client";

    const link = new HttpLink({
      uri: "http://localhost:4000/graphql",
      // Additional options
    });"
  `);
});

test("`removeTypenameFromVariables` renames to `RemoveTypenameFromVariablesLink`", () => {
  expect(
    transform`
import {
  removeTypenameFromVariables,
  KEEP,
} from "@apollo/client/link/remove-typename";

const link = removeTypenameFromVariables({
  except: {
    JSON: KEEP, // Keep __typename for all JSON scalar variables
    DashboardInput: {
      config: KEEP, // Keep __typename only for the config field
    },
  },
});
`
  ).toMatchInlineSnapshot(`
    "import {
      KEEP,
      RemoveTypenameFromVariablesLink,
    } from "@apollo/client/link/remove-typename";

    const link = new RemoveTypenameFromVariablesLink({
      except: {
        JSON: KEEP, // Keep __typename for all JSON scalar variables
        DashboardInput: {
          config: KEEP, // Keep __typename only for the config field
        },
      },
    });"
  `);
});
