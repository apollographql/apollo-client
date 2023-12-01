import { DocumentTransform } from "../DocumentTransform";
import { isMutationOperation, isQueryOperation } from "../operations";
import { removeDirectivesFromDocument } from "../transform";
import { gql } from "graphql-tag";
import { DocumentNode, visit, Kind } from "graphql";

function stripDirective(directive: string) {
  return (document: DocumentNode) => {
    return removeDirectivesFromDocument([{ name: directive }], document)!;
  };
}

function renameDirective(target: string, replacement: string) {
  return (document: DocumentNode) => {
    return visit(document, {
      Directive(node) {
        if (node.name.value === target) {
          return {
            ...node,
            name: { kind: Kind.NAME, value: replacement },
          };
        }
      },
    });
  };
}

function addClientDirectiveToField(fieldName: string) {
  return (document: DocumentNode) => {
    return visit(document, {
      Field: {
        leave: (node) => {
          if (node.name.value === fieldName) {
            return {
              ...node,
              directives: [
                {
                  kind: Kind.DIRECTIVE,
                  name: { kind: Kind.NAME, value: "client" },
                },
              ],
            };
          }
        },
      },
    });
  };
}

test("can transform a document", () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const transform = new DocumentTransform(stripDirective("client"));

  const result = transform.transformDocument(query);

  expect(result).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);
});

test("returns unmodified document if trying to transform an already computed result", () => {
  const query = gql`
    query TestQuery {
      user {
        name @custom
        isLoggedIn @client
      }
    }
  `;

  const cachedTransform = new DocumentTransform(stripDirective("client"));
  const uncachedTransform = new DocumentTransform(stripDirective("custom"), {
    cache: false,
  });

  const withoutClient = cachedTransform.transformDocument(query);
  const withoutCustom = uncachedTransform.transformDocument(query);

  expect(cachedTransform.transformDocument(withoutClient)).toBe(withoutClient);

  expect(uncachedTransform.transformDocument(withoutCustom)).toBe(
    withoutCustom
  );
});

test("caches the result of the transform by default", () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const transform = jest.fn(stripDirective("client"));
  const documentTransform = new DocumentTransform(transform);

  const result1 = documentTransform.transformDocument(query);

  expect(result1).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);
});

test("allows custom cache keys to be defined", () => {
  const query = gql`
    query TestQuery {
      user @network {
        name
      }
    }
  `;

  const onlineQuery = gql`
    query TestQuery {
      user {
        name
      }
    }
  `;

  const offlineQuery = gql`
    query TestQuery {
      user @client {
        name
      }
    }
  `;

  let online = true;

  const onlineTransform = new DocumentTransform(stripDirective("network"));
  const offlineTransform = new DocumentTransform(
    renameDirective("network", "client")
  );

  const transform = jest.fn((document: DocumentNode) => {
    return online ?
        onlineTransform.transformDocument(document)
      : offlineTransform.transformDocument(document);
  });

  const documentTransform = new DocumentTransform(transform, {
    getCacheKey: (document) => [document, online],
  });

  const result1 = documentTransform.transformDocument(query);

  expect(result1).toMatchDocument(onlineQuery);
  expect(transform).toHaveBeenCalledTimes(1);

  online = false;

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(offlineQuery);
  expect(transform).toHaveBeenCalledTimes(2);

  online = true;

  const result3 = documentTransform.transformDocument(query);

  expect(result3).toMatchDocument(onlineQuery);
  expect(transform).toHaveBeenCalledTimes(2);

  online = false;

  const result4 = documentTransform.transformDocument(query);

  expect(result4).toMatchDocument(offlineQuery);
  expect(transform).toHaveBeenCalledTimes(2);
});

test("can disable caching the result output", () => {
  const query = gql`
    query {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const transform = jest.fn(stripDirective("client"));
  const documentTransform = new DocumentTransform(transform, { cache: false });

  const result1 = documentTransform.transformDocument(query);

  expect(result1).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(2);
});

test("can combine 2 transforms with `concat`", async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective("client"));
  const stripNonReactive = new DocumentTransform(stripDirective("nonreactive"));
  const documentTransform = stripClient.concat(stripNonReactive);

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);
});

test("runs concatenated transform after original transform", () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const addClientDirectiveToName = new DocumentTransform(
    addClientDirectiveToField("name")
  );

  expect(addClientDirectiveToName.transformDocument(query)).toMatchDocument(gql`
    query TestQuery {
      user {
        name @client
        isLoggedIn @client
      }
    }
  `);

  const stripClient = new DocumentTransform(stripDirective("client"));
  const documentTransform = addClientDirectiveToName.concat(stripClient);

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
});

test("can combine multiple transforms with `concat`", async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name @connection
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective("client"));
  const stripNonReactive = new DocumentTransform(stripDirective("nonreactive"));
  const stripConnection = new DocumentTransform(stripDirective("connection"));
  const documentTransform = stripClient
    .concat(stripNonReactive)
    .concat(stripConnection);

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);
});

test("caches the result output from a combined transform when both transforms are cached", async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const stripClient = jest.fn(stripDirective("client"));
  const stripNonReactive = jest.fn(stripDirective("nonreactive"));

  const stripClientTransform = new DocumentTransform(stripClient);
  const stripNonReactiveTransform = new DocumentTransform(stripNonReactive);
  const documentTransform = stripClientTransform.concat(
    stripNonReactiveTransform
  );

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);
});

test("allows non cached transforms to be run when concatenated", async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const stripClient = jest.fn(stripDirective("client"));
  const stripNonReactive = jest.fn(stripDirective("nonreactive"));

  const stripClientTransform = new DocumentTransform(stripClient, {
    cache: true,
  });
  const stripNonReactiveTransform = new DocumentTransform(stripNonReactive, {
    cache: false,
  });

  // Try ordering the transforms both ways to ensure the cached transform has
  // no effect on whether the non-cached transform runs
  const documentTransform =
    stripNonReactiveTransform.concat(stripClientTransform);

  const reversedTransform = stripClientTransform.concat(
    stripNonReactiveTransform
  );

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  // Even though stripClient is cached, it is called a second time because
  // stripNonReactive returns a new document instance each time it runs.
  expect(stripClient).toHaveBeenCalledTimes(2);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);

  stripClient.mockClear();
  stripNonReactive.mockClear();

  const reversed = reversedTransform.transformDocument(query);

  expect(reversed).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const reversed2 = reversedTransform.transformDocument(query);

  expect(reversed2).toMatchDocument(expected);
  // Now that the cached transform is first, we can make sure it doesn't run
  // again. We verify the non-cached that is run after the cached transform does
  // get a chance to execute.
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);
});

test("can conditionally run transforms using `DocumentTransform.split`", () => {
  const mutation = gql`
    mutation TestMutation {
      incrementCounter @client {
        count
      }
    }
  `;

  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const documentTransform = DocumentTransform.split(
    isQueryOperation,
    new DocumentTransform(stripDirective("client"))
  );

  const queryResult = documentTransform.transformDocument(query);
  const mutationResult = documentTransform.transformDocument(mutation);

  expect(queryResult).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);

  expect(mutationResult).toMatchDocument(mutation);
});

test("properly caches the result of `filter` when the original transform is cached", () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const transform = jest.fn(stripDirective("client"));
  const documentTransform = DocumentTransform.split(
    isQueryOperation,
    new DocumentTransform(transform, { cache: true })
  );

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);
});

test("reruns transform returned from `DocumentTransform.split` when the original transform is not cached", () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const transform = jest.fn(stripDirective("client"));
  const documentTransform = DocumentTransform.split(
    isQueryOperation,
    new DocumentTransform(transform, { cache: false })
  );

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(2);
});

test("properly handles combinations of `DocumentTransform.split` and `filter`", () => {
  const mutation = gql`
    mutation TestMutation {
      incrementCounter @client {
        count @nonreactive
      }
    }
  `;

  const query = gql`
    query TestQuery {
      user {
        name @nonreactive
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective("client"));
  const stripNonReactive = new DocumentTransform(stripDirective("nonreactive"));

  // Strip both @client and @nonreactive but only on query types
  const queryOnlyTransform = DocumentTransform.split(
    isQueryOperation,
    stripClient.concat(stripNonReactive)
  );

  // Only strip @client from mutations but remove @nonreactive from all
  const conditionalStrip = DocumentTransform.split(
    isMutationOperation,
    stripClient
  ).concat(stripNonReactive);

  expect(queryOnlyTransform.transformDocument(query)).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);

  expect(queryOnlyTransform.transformDocument(mutation)).toMatchDocument(
    mutation
  );

  expect(conditionalStrip.transformDocument(query)).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `);

  expect(conditionalStrip.transformDocument(mutation)).toMatchDocument(gql`
    mutation TestMutation {
      incrementCounter {
        count
      }
    }
  `);
});

test("executes other transform when using `DocumentTransform.split` when condition is false", () => {
  const mutation = gql`
    mutation TestMutation {
      incrementCounter @client {
        count @nonreactive
      }
    }
  `;

  const query = gql`
    query TestQuery {
      user {
        name @nonreactive
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective("client"));
  const stripNonReactive = new DocumentTransform(stripDirective("nonreactive"));

  // strip both directives for queries, but only @nonreactive for mutations
  const documentTransform = DocumentTransform.split(
    isQueryOperation,
    stripClient.concat(stripNonReactive),
    stripNonReactive
  );

  expect(documentTransform.transformDocument(query)).toMatchDocument(gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `);

  expect(documentTransform.transformDocument(mutation)).toMatchDocument(gql`
    mutation TestMutation {
      incrementCounter @client {
        count
      }
    }
  `);
});

test("errors when passing a document that has not been parsed with `gql`", () => {
  const query = `
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const documentTransform = new DocumentTransform((document) => document);

  expect(() => {
    documentTransform.transformDocument(query as unknown as DocumentNode);
  }).toThrowError(/wrap the query string in a "gql" tag/);
});
