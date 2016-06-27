import {
  checkDocument,
  getFragmentDefinitions,
  getQueryDefinition,
  getMutationDefinition,
  replaceOperationDefinition,
  createFragmentMap,
  FragmentMap,
  getOperationName,
} from '../src/queries/getFromAST';

import {
  FragmentDefinition,
  OperationDefinition,
} from 'graphql';
import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';
import { assert } from 'chai';

describe('AST utility functions', () => {
  it('should correctly check a document for correctness', () => {
    const multipleQueries = gql`
      query {
        author {
          firstName
          lastName
        }
      }
      query {
        author {
          address
        }
      }`;
    assert.throws(() => {
      checkDocument(multipleQueries);
    });

    const namedFragment = gql`
      query {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    assert.doesNotThrow(() => {
      checkDocument(namedFragment);
    });
  });

  it('should get fragment definitions from a document containing a single fragment', () => {
    const singleFragmentDefinition = gql`
      query {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const expectedDoc = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const expectedResult: FragmentDefinition[] = [expectedDoc.definitions[0] as FragmentDefinition];
    const actualResult = getFragmentDefinitions(singleFragmentDefinition);
    assert.equal(actualResult.length, expectedResult.length);
    assert.equal(print(actualResult[0]), print(expectedResult[0]));
  });

  it('should get fragment definitions from a document containing a multiple fragments', () => {
    const multipleFragmentDefinitions = gql`
      query {
        author {
          ...authorDetails
          ...moreAuthorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }
      fragment moreAuthorDetails on Author {
        address
      }`;
    const expectedDoc = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      fragment moreAuthorDetails on Author {
        address
      }`;
    const expectedResult: FragmentDefinition[] = [expectedDoc.definitions[0] as FragmentDefinition,
                                                expectedDoc.definitions[1] as FragmentDefinition, ];
    const actualResult = getFragmentDefinitions(multipleFragmentDefinitions);
    assert.deepEqual(actualResult.map(print), expectedResult.map(print));
  });

  it('should get the correct query definition out of a query containing multiple fragments', () => {
    const queryWithFragments = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      fragment moreAuthorDetails on Author {
        address
      }
      query {
        author {
          ...authorDetails
          ...moreAuthorDetails
        }
      }`;
    const expectedDoc = gql`
      query {
        author {
          ...authorDetails
          ...moreAuthorDetails
        }
      }`;
    const expectedResult: OperationDefinition = expectedDoc.definitions[0] as OperationDefinition;
    const actualResult = getQueryDefinition(queryWithFragments);

    assert.equal(print(actualResult), print(expectedResult));
  });

  it('should throw if we try to get the query definition of a document with no query', () => {
    const mutationWithFragments = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }

      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          ...authorDetails
        }
      }`;
    assert.throws(() => {
      getQueryDefinition(mutationWithFragments);
    });
  });

  it('should get the correct mutation definition out of a mutation with multiple fragments', () => {
    const mutationWithFragments = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const expectedDoc = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          ...authorDetails
        }
      }`;
    const expectedResult: OperationDefinition = expectedDoc.definitions[0] as OperationDefinition;
    const actualResult = getMutationDefinition(mutationWithFragments);
    assert.equal(print(actualResult), print(expectedResult));
  });

  it('should replace the operation definition correctly', () => {
    const queryWithFragments = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      query {
        author {
          ...authorDetails
        }
      }`;
    const newQueryDef = getQueryDefinition(gql`
      query {
        author {
          ...authorDetails
          __typename
        }
        __typename
      }`);
    const expectedNewQuery = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }

      query {
        author {
          ...authorDetails
          __typename
        }
        __typename
      }`;
    const newDoc = replaceOperationDefinition(queryWithFragments, newQueryDef);
    assert.equal(print(newDoc), print(expectedNewQuery));
  });

  it('should create the fragment map correctly', () => {
    const fragments = getFragmentDefinitions(gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      fragment moreAuthorDetails on Author {
        address
      }`);
    const fragmentMap = createFragmentMap(fragments);
    const expectedTable: FragmentMap = {
      'authorDetails': fragments[0],
      'moreAuthorDetails': fragments[1],
    };
    assert.deepEqual(fragmentMap, expectedTable);
  });

  it('should get the operation name out of a query', () => {
    const query = gql`
      query nameOfQuery {
        fortuneCookie
      }`;
    const operationName = getOperationName(query);
    assert.equal(operationName, 'nameOfQuery');
  });

  it('should get the operation name out of a mutation', () => {
    const query = gql`
      mutation nameOfMutation {
        fortuneCookie
      }`;
    const operationName = getOperationName(query);
    assert.equal(operationName, 'nameOfMutation');
  });
});
