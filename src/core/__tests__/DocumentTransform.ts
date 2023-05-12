import { DocumentTransform } from '../DocumentTransform';
import {
  getOperationDefinition,
  removeDirectivesFromDocument,
} from '../../utilities';
import { gql } from 'graphql-tag';
import { DocumentNode, OperationTypeNode, print } from 'graphql';

function stripDirective(directive: string) {
  return (document: DocumentNode) => {
    return removeDirectivesFromDocument([{ name: directive }], document)!;
  };
}

function isOperation(document: DocumentNode, operation: OperationTypeNode) {
  return getOperationDefinition(document)?.operation === operation;
}

function isQuery(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.QUERY);
}

function isMutation(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.MUTATION);
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

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const transform = new DocumentTransform(stripDirective('client'));

  const result = transform.transformDocument(query);

  expect(print(result)).toEqual(print(expected));
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

  expect(print(result1)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
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

  expect(print(result1)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
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

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const stripClient = new DocumentTransform(stripDirective('client'));
  const stripNonReactive = new DocumentTransform(stripDirective('nonreactive'));
  const documentTransform = stripClient.concat(stripNonReactive);

  const result = documentTransform.transformDocument(query);

  expect(print(result)).toEqual(print(expected));
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

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
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

  expect(print(result)).toEqual(print(expected));
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

  expect(print(result)).toEqual(print(expected));
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
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

  expect(print(result)).toEqual(print(expected));
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
  // Even though stripClient is cached, it is called a second time because
  // stripNonReactive returns a new document instance each time it runs.
  expect(stripClient).toHaveBeenCalledTimes(2);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);

  stripClient.mockClear();
  stripNonReactive.mockClear();

  const reversed = reversedTransform.transformDocument(query);

  expect(print(reversed)).toEqual(print(expected));
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(1);

  const reversed2 = reversedTransform.transformDocument(query);

  expect(print(reversed2)).toEqual(print(expected));
  // Now that the cached transform is first, we can make sure it doesn't run
  // again. We verify the non-cached that is run after the cached transform does
  // get a chance to execute.
  expect(stripClient).toHaveBeenCalledTimes(1);
  expect(stripNonReactive).toHaveBeenCalledTimes(2);
});

test('can conditionally run transforms using `filter`', () => {
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

  const expected = gql`
    query TestQuery {
      user {
        name
        isLoggedIn
      }
    }
  `;

  const documentTransform = new DocumentTransform(
    stripDirective('client')
  ).filter(isQuery);

  const queryResult = documentTransform.transformDocument(query);
  const mutationResult = documentTransform.transformDocument(mutation);

  expect(print(queryResult)).toEqual(print(expected));
  expect(print(mutationResult)).toEqual(print(mutationResult));
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
  const documentTransform = new DocumentTransform(transform, {
    cache: true,
  }).filter(isQuery);

  const result = documentTransform.transformDocument(query);

  expect(print(result)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);
});

test('reruns transform returned from `filter` when the original transform is not cached', () => {
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
  const documentTransform = new DocumentTransform(transform, {
    cache: false,
  }).filter(isQuery);

  const result = documentTransform.transformDocument(query);

  expect(print(result)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(2);
});

test('properly handles combinations of `concat` and `filter`', () => {
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
  const queryOnlyTransform = stripClient
    .concat(stripNonReactive)
    .filter(isQuery);

  // Only strip @client from mutations but remove @nonreactive from all
  const conditionalStrip = stripClient
    .filter(isMutation)
    .concat(stripNonReactive);

  expect(print(queryOnlyTransform.transformDocument(query)))
    .toMatchInlineSnapshot(`
    "query TestQuery {
      user {
        name
        isLoggedIn
      }
    }"
  `);

  expect(print(queryOnlyTransform.transformDocument(mutation)))
    .toMatchInlineSnapshot(`
    "mutation TestMutation {
      incrementCounter @client {
        count @nonreactive
      }
    }"
  `);

  expect(print(conditionalStrip.transformDocument(query)))
    .toMatchInlineSnapshot(`
    "query TestQuery {
      user {
        name
        isLoggedIn @client
      }
    }"
  `);

  expect(print(conditionalStrip.transformDocument(mutation)))
    .toMatchInlineSnapshot(`
    "mutation TestMutation {
      incrementCounter {
        count
      }
    }"
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

  expect(print(result)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  const result2 = documentTransform.transformDocument(query);

  expect(print(result2)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(1);

  documentTransform.invalidateDocument(query);
  const result3 = documentTransform.transformDocument(query);

  expect(print(result3)).toEqual(print(expected));
  expect(transform).toHaveBeenCalledTimes(2);
});
