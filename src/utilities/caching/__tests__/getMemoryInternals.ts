import { createFragmentRegistry } from "../../../cache";
import {
  ApolloClient,
  ApolloLink,
  DocumentTransform,
  InMemoryCache,
  gql,
} from "../../../core";
import { createPersistedQueryLink } from "../../../link/persisted-queries";
import { removeTypenameFromVariables } from "../../../link/remove-typename";
import crypto from "crypto";
// importing react so the `parser` cache initializes
import "../../../react";

function sha256(data: string) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

it("returns information about cache usage (empty caches)", () => {
  const client = new ApolloClient({
    documentTransform: new DocumentTransform((x) => x, {
      cache: true,
    }).concat(
      new DocumentTransform((x) => x, {
        cache: true,
      })
    ),
    cache: new InMemoryCache({
      fragments: createFragmentRegistry(),
    }),
    link: createPersistedQueryLink({
      sha256,
    })
      .concat(removeTypenameFromVariables())
      .concat(ApolloLink.empty()),
  });
  expect(client.getMemoryInternals?.()).toEqual(
    expect.objectContaining({
      limits: {
        canonicalStringify: 1000,
        documentTransform: 2000,
        executeSelectionSet: 10000,
        executeSubSelectedArray: 5000,
        fragmentQueryDocuments: 1000,
        fragmentRegistryFindFragmentSpreads: 4000,
        fragmentRegistryLookup: 1000,
        fragmentRegistryTransform: 2000,
        getVariableDefinitions: 2000,
        maybeBroadcastWatch: 5000,
        parser: 1000,
        persistedQueryHashes: 2000,
        print: 2000,
        queryManagerTransforms: 2000,
      },
      sizes: {
        cache: {
          addTypenameTransform: [0],
          fragmentQueryDocuments: 0,
          fragmentRegistry: {
            findFragmentSpreads: 0,
            lookup: 0,
            transform: 0,
          },
          maybeBroadcastWatch: 0,
          storeReader: {
            executeSelectionSet: 0,
            executeSubSelectedArray: 0,
          },
        },
        global: {
          canonicalStringify: 0,
          parser: 0,
          print: 0,
        },
        links: [
          {
            persistedQueryHashes: 0,
          },
          {
            getVariableDefinitions: 0,
          },
        ],
        queryManager: {
          Transforms: 0,
          documentTransforms: [0, 0],
        },
      },
    })
  );
});

it("returns information about cache usage (some query triggered)", () => {
  const client = new ApolloClient({
    documentTransform: new DocumentTransform((x) => x, {
      cache: true,
    }).concat(
      new DocumentTransform((x) => x, {
        cache: true,
      })
    ),
    cache: new InMemoryCache({
      fragments: createFragmentRegistry(),
    }),
    link: createPersistedQueryLink({
      sha256,
    })
      .concat(removeTypenameFromVariables())
      .concat(ApolloLink.empty()),
  });

  client.query({
    query: gql`
      query {
        hello
      }
    `,
  });
  expect(client.getMemoryInternals?.()).toEqual(
    expect.objectContaining({
      limits: {
        canonicalStringify: 1000,
        documentTransform: 2000,
        executeSelectionSet: 10000,
        executeSubSelectedArray: 5000,
        fragmentQueryDocuments: 1000,
        fragmentRegistryFindFragmentSpreads: 4000,
        fragmentRegistryLookup: 1000,
        fragmentRegistryTransform: 2000,
        getVariableDefinitions: 2000,
        maybeBroadcastWatch: 5000,
        parser: 1000,
        persistedQueryHashes: 2000,
        print: 2000,
        queryManagerTransforms: 2000,
      },
      sizes: {
        cache: {
          addTypenameTransform: [1],
          fragmentQueryDocuments: 0,
          fragmentRegistry: {
            findFragmentSpreads: 1,
            lookup: 0,
            transform: 1,
          },
          maybeBroadcastWatch: 0,
          storeReader: {
            executeSelectionSet: 1,
            executeSubSelectedArray: 0,
          },
        },
        global: {
          canonicalStringify: 0,
          parser: 0,
          print: 1,
        },
        links: [
          {
            persistedQueryHashes: 1,
          },
          {
            getVariableDefinitions: 0,
          },
        ],
        queryManager: {
          Transforms: 1,
          documentTransforms: [1, 1],
        },
      },
    })
  );
});
