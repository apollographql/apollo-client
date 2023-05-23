import { DocumentTransform } from '../DocumentTransform';
import {
  isMutationOperation,
  isQueryOperation,
  removeDirectivesFromDocument,
} from '../../utilities';
import { gql } from 'graphql-tag';
import { DocumentNode, visit, Kind } from 'graphql';

// Disable weak maps for these tests so we can assert on the document cache size
jest.mock('../../utilities', () => ({
  ...jest.requireActual('../../utilities'),
  canUseWeakMap: false,
}));

expect.extend({
  toHaveCacheSize(documentTransform: DocumentTransform, size: number) {
    const cache = documentTransform['documentCache'] as
      | Map<DocumentNode, DocumentNode>
      | undefined;

    const pass = cache?.size === size;

    return {
      pass,
      message: () => {
        const formattedSize = this.utils.EXPECTED_COLOR(size);
        const formattedCacheSize = this.utils.RECEIVED_COLOR(cache?.size);
        const hint = this.utils.matcherHint(
          'toHaveCacheSize',
          'documentTransform',
          'cacheSize',
          { isNot: this.isNot }
        );

        return (
          hint +
          `\n\nExpected document transform to${
            this.isNot ? ' not' : ''
          } have cache size ${formattedSize}. Got ${formattedCacheSize}.`
        );
      },
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveCacheSize(size: number): R;
    }
  }
}

function stripDirective(directive: string) {
  return (document: DocumentNode) => {
    return removeDirectivesFromDocument([{ name: directive }], document)!;
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
                  name: { kind: Kind.NAME, value: 'client' },
                },
              ],
            };
          }
        },
      },
    });
  };
}

test('can transform a document', () => {
  const query = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const transform = new DocumentTransform(stripDirective('client'));

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

test('caches the result of the transform by default', () => {
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

  const transform = jest.fn(stripDirective('client'));
  const documentTransform = new DocumentTransform(transform);

  const result1 = documentTransform.transformDocument(query);

  expect(result1).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);
});

test('can disable caching the result output', () => {
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

  const transform = jest.fn(stripDirective('client'));
  const documentTransform = new DocumentTransform(transform, { cache: false });

  const result1 = documentTransform.transformDocument(query);

  expect(result1).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(2);
});

test('can combine 2 transforms with `concat`', async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective('client'));
  const stripNonReactive = new DocumentTransform(stripDirective('nonreactive'));
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

test('runs concatenated transform after original transform', () => {
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
    addClientDirectiveToField('name')
  );

  expect(addClientDirectiveToName.transformDocument(query)).toMatchDocument(gql`
    query TestQuery {
      user {
        name @client
        isLoggedIn @client
      }
    }
  `);

  const stripClient = new DocumentTransform(stripDirective('client'));
  const documentTransform = addClientDirectiveToName.concat(stripClient);

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
});

test('can combine multiple transforms with `concat`', async () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name @connection
        isLoggedIn @client
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective('client'));
  const stripNonReactive = new DocumentTransform(stripDirective('nonreactive'));
  const stripConnection = new DocumentTransform(stripDirective('connection'));
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

test('caches the result output from a combined transform when both transforms are cached', async () => {
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

  const stripClient = jest.fn(stripDirective('client'));
  const stripNonReactive = jest.fn(stripDirective('nonreactive'));

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

test('allows non cached transforms to be run when concatenated', async () => {
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

  const stripClient = jest.fn(stripDirective('client'));
  const stripNonReactive = jest.fn(stripDirective('nonreactive'));

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

test('can conditionally run transforms using `DocumentTransform.split`', () => {
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
    new DocumentTransform(stripDirective('client'))
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

test('properly caches the result of `filter` when the original transform is cached', () => {
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

  const transform = jest.fn(stripDirective('client'));
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

test('reruns transform returned from `DocumentTransform.split` when the original transform is not cached', () => {
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

  const transform = jest.fn(stripDirective('client'));
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

test('properly handles combinations of `DocumentTransform.split` and `filter`', () => {
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

  const stripClient = new DocumentTransform(stripDirective('client'));
  const stripNonReactive = new DocumentTransform(stripDirective('nonreactive'));

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

test('executes other transform when using `DocumentTransform.split` when condition is false', () => {
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

  const stripClient = new DocumentTransform(stripDirective('client'));
  const stripNonReactive = new DocumentTransform(stripDirective('nonreactive'));

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

test('can invalidate a cached document with `invalidateDocument`', () => {
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

  const transform = jest.fn(stripDirective('client'));
  const documentTransform = new DocumentTransform(transform, { cache: true });

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);
  expect(documentTransform).toHaveCacheSize(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(1);
  expect(documentTransform).toHaveCacheSize(1);

  documentTransform.invalidateDocument(query);
  expect(documentTransform).toHaveCacheSize(0);

  const result3 = documentTransform.transformDocument(query);

  expect(result3).toMatchDocument(expected);
  expect(transform).toHaveBeenCalledTimes(2);
  expect(documentTransform).toHaveCacheSize(1);
});

test('invalidates the entire chain of transforms created via `concat` by calling `invalidateDocument`', () => {
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

  const stripClient = jest.fn(stripDirective('client'));
  const stripNonReactive = jest.fn(stripDirective('nonreactive'));

  const stripClientTransform = new DocumentTransform(stripClient);
  const stripNonReactiveTransform = new DocumentTransform(stripNonReactive);

  const documentTransform = stripClientTransform.concat(
    stripNonReactiveTransform
  );

  const result = documentTransform.transformDocument(query);

  expect(result).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);
  expect(stripClientTransform).toHaveCacheSize(1);
  expect(stripNonReactiveTransform).toHaveCacheSize(1);

  const result2 = documentTransform.transformDocument(query);

  expect(result2).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);
  expect(stripClientTransform).toHaveCacheSize(1);
  expect(stripNonReactiveTransform).toHaveCacheSize(1);

  documentTransform.invalidateDocument(query);
  expect(stripClientTransform).toHaveCacheSize(0);
  expect(stripNonReactiveTransform).toHaveCacheSize(0);

  const result3 = documentTransform.transformDocument(query);

  expect(result3).toMatchDocument(expected);
  expect(stripClient).toHaveBeenCalledTimes(2);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);
  expect(stripClientTransform).toHaveCacheSize(1);
  expect(stripNonReactiveTransform).toHaveCacheSize(1);
});

test('invalidates both left/right transforms created via `split` by calling `invalidateDocument`', () => {
  const query = gql`
    query TestQuery {
      user @nonreactive {
        name
        isLoggedIn @client
      }
    }
  `;
  const mutation = gql`
    mutation TestMutation {
      changeUsername {
        username
        isLoggedIn @client
      }
    }
  `;

  const transformedQuery = gql`
    query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }
  `;

  const transformedMutation = gql`
    mutation TestMutation {
      changeUsername {
        username
        isLoggedIn
      }
    }
  `;

  const stripClient = jest.fn(stripDirective('client'));
  const stripNonReactive = jest.fn(stripDirective('nonreactive'));

  const queryTransform = new DocumentTransform(stripNonReactive);
  const mutationTransform = new DocumentTransform(stripClient);

  const documentTransform = DocumentTransform.split(
    (document) => isQueryOperation(document),
    queryTransform,
    mutationTransform
  );

  const queryResult = documentTransform.transformDocument(query);
  const mutationResult = documentTransform.transformDocument(mutation);

  expect(queryResult).toMatchDocument(transformedQuery);
  expect(mutationResult).toMatchDocument(transformedMutation);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);
  expect(queryTransform).toHaveCacheSize(1);
  expect(mutationTransform).toHaveCacheSize(1);

  const queryResult2 = documentTransform.transformDocument(query);
  const mutationResult2 = documentTransform.transformDocument(mutation);

  expect(queryResult2).toMatchDocument(transformedQuery);
  expect(mutationResult2).toMatchDocument(transformedMutation);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);
  expect(queryTransform).toHaveCacheSize(1);
  expect(mutationTransform).toHaveCacheSize(1);

  documentTransform.invalidateDocument(query);
  expect(queryTransform).toHaveCacheSize(0);
  expect(mutationTransform).toHaveCacheSize(1);

  const queryResult3 = documentTransform.transformDocument(query);
  const mutationResult3 = documentTransform.transformDocument(mutation);

  expect(queryResult3).toMatchDocument(transformedQuery);
  expect(mutationResult3).toMatchDocument(transformedMutation);
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);
  expect(queryTransform).toHaveCacheSize(1);
  expect(mutationTransform).toHaveCacheSize(1);

  documentTransform.invalidateDocument(mutation);
  expect(queryTransform).toHaveCacheSize(1);
  expect(mutationTransform).toHaveCacheSize(0);

  const queryResult4 = documentTransform.transformDocument(query);
  const mutationResult4 = documentTransform.transformDocument(mutation);

  expect(queryResult4).toMatchDocument(transformedQuery);
  expect(mutationResult4).toMatchDocument(transformedMutation);
  expect(stripClient).toHaveBeenCalledTimes(2);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);
  expect(queryTransform).toHaveCacheSize(1);
  expect(mutationTransform).toHaveCacheSize(1);
});

test('errors when passing a document that has not been parsed with `gql`', () => {
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
