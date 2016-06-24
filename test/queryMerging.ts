import {
  addPrefixToVariables,
  addPrefixToQuery,
  aliasField,
  getOperationDefinitionName,
  applyAliasNameToTopLevelFields,
  addQueryToRoot,
  applyAliasNameToFragment,
  applyAliasNameToDocument,
  renameFragmentSpreads,
  mergeQueryDocuments,
  mergeRequests,
  parseMergedKey,
  unpackMergedResult,
} from '../src/batching/queryMerging';

import {
  getQueryDefinition,
  getFragmentDefinitions,
} from '../src/queries/getFromAST';

import {
  print,
  Field,
  OperationDefinition,
} from 'graphql';

import gql from 'graphql-tag';
import { assert } from 'chai';
import cloneDeep = require('lodash.clonedeep');

describe('Query merging', () => {

  it('should be able to add a prefix to a variables object', () => {
    const variables = {
      'offset': 15,
      'not_offset': 'lol',
    };

    const expResult = {
      '___feed:offset': 15,
      '___feed:not_offset': 'lol',
    };

    const result = addPrefixToVariables('___feed:', variables);
    assert.deepEqual(result, expResult);
  });

  it('should be able to add a prefix to the query name', () => {
    const query = gql`
      query author {
        firstName
        lastName
      }`;
    const expQuery = gql`
      query ___composed___author {
        firstName
        lastName
      }`;

    const queryDef = getQueryDefinition(query);
    const expQueryDefinition = getQueryDefinition(expQuery);

    const resultQueryDefinition = addPrefixToQuery('___composed___', queryDef);
    assert.deepEqual(print(resultQueryDefinition), print(expQueryDefinition));
  });

  it('should be able to alias a field', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const expQuery = gql`
      query {
        listOfAuthors: author {
          firstName
          lastName
        }
      }`;
    const queryDef = getQueryDefinition(query);
    const expQueryDefinition = getQueryDefinition(expQuery);
    const queryField = queryDef.selectionSet.selections[0];
    const expField = expQueryDefinition.selectionSet.selections[0];
    const queryFieldCopy = cloneDeep(queryField);
    const resField = aliasField(queryFieldCopy as Field, 'listOfAuthors');
    assert.deepEqual(print(resField), print(expField));
  });

  it('should be able to create a query alias name', () => {
    const query = gql`
      query listOfAuthors {
        author {
          firstName
          lastName
        }
      }`;
    const expAliasName = '___listOfAuthors___requestIndex_3';
    const resAliasName = getOperationDefinitionName(getQueryDefinition(query), 3);
    assert.equal(resAliasName, expAliasName);
  });

  it('should apply the alias name to all top level fields', () => {
    const query = gql`
      query listOfAuthors {
        author {
          firstName
          lastName
        }
        __typename
      }`;
    const expQuery = gql`
      query listOfAuthors {
        ___listOfAuthors___requestIndex_3___fieldIndex_0: author {
          firstName
          lastName
        }
        ___listOfAuthors___requestIndex_3___fieldIndex_1: __typename
      }`;
    const queryDef = getQueryDefinition(query);
    const expQueryDef = getQueryDefinition(expQuery);
    const aliasName = getOperationDefinitionName(queryDef, 3);
    const aliasedQuery = applyAliasNameToTopLevelFields(queryDef, aliasName, 0);
    assert.equal(print(aliasedQuery), print(expQueryDef));
  });

  it('should be able to add a query to a root query with aliased fields', () => {
    const childQuery = gql`
    query listOfAuthors {
      author {
        firstName
        lastName
      }
      __typename
    }`;
    const rootQuery = gql`
      query ___composed {
        author
      }`;
    (rootQuery.definitions[0] as OperationDefinition).selectionSet.selections = [];

    const expRootQuery = gql`
      query ___composed {
        ___listOfAuthors___requestIndex_3___fieldIndex_0: author {
          firstName
          lastName
        }
        ___listOfAuthors___requestIndex_3___fieldIndex_1: __typename
      }`;
    const modifiedRootQuery = addQueryToRoot(rootQuery, childQuery, 3);
    assert.equal(print(modifiedRootQuery), print(expRootQuery));
  });

  it('should be able to alias named fragments', () => {
    const query = gql`
      query authorStuff {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const queryDef = getQueryDefinition(query);
    const fragmentDefinition = getFragmentDefinitions(query)[0];
    const aliasName = getOperationDefinitionName(queryDef, 2);
    const exp = getFragmentDefinitions(gql`
      fragment ___authorStuff___requestIndex_2___authorDetails on Author {
        ___authorStuff___requestIndex_2___fieldIndex_0: firstName
        ___authorStuff___requestIndex_2___fieldIndex_1: lastName
      }`)[0];
    const res = applyAliasNameToFragment(fragmentDefinition, aliasName, 0);
    assert.equal(print(res), print(exp));
  });

  it('should be able to rename fragment spreads to their aliased names', () => {
    const doc = gql`
      query authorStuff {
        author {
          ...authorDetails
        }
     }`;
    const exp = gql`
      query {
        author {
          ...___authorStuff___requestIndex_2___authorDetails
        }
      }`;
    const queryDef = getQueryDefinition(doc);
    const expDef = getQueryDefinition(exp);
    const res = renameFragmentSpreads(queryDef.selectionSet,
                                      '___authorStuff___requestIndex_2');
    assert.equal(print(res), print(expDef.selectionSet));
  });

  it('should be able to alias a document containing a query and a named fragment', () => {
    const doc = gql`
      query authorStuff {
        author {
           ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const exp = gql`
      query authorStuff {
        ___authorStuff___requestIndex_2___fieldIndex_0: author {
          ...___authorStuff___requestIndex_2___authorDetails
        }
      }
      fragment ___authorStuff___requestIndex_2___authorDetails on Author {
        ___authorStuff___requestIndex_2___fieldIndex_1: firstName
        ___authorStuff___requestIndex_2___fieldIndex_2: lastName
      }
      `;
    const aliasName = getOperationDefinitionName(getQueryDefinition(doc), 2);
    const aliasedDoc = applyAliasNameToDocument(doc, aliasName);
    assert.equal(print(aliasedDoc), print(exp));
  });

  it('should be able to rename variables to their aliased names', () => {
    const doc = gql`
      query getUser($id: Int) {
        user(id: $id) {
          firstName
          lastName
        }
      }`;
    const exp = gql`
      query getUser($___getUser___requestIndex_2___id: Int) {
        ___getUser___requestIndex_2___fieldIndex_0: user(id: $___getUser___requestIndex_2___id) {
          firstName
          lastName
        }
      }`;
    const aliasName = getOperationDefinitionName(getQueryDefinition(doc), 2);
    const aliasedDoc = applyAliasNameToDocument(doc, aliasName);
    assert.equal(print(aliasedDoc), print(exp));
  });

  it('should be able to add a query to a root query', () => {
    const doc = gql`
      query authorStuff {
        author {
          firstName
          lastName
          ...moreAuthorDetails
        }
      }
      fragment moreAuthorDetails on Author {
        address
      }`;
    const exp = gql`
      query ___composed {
        ___authorStuff___requestIndex_0___fieldIndex_0: author {
          firstName
          lastName
          ...___authorStuff___requestIndex_0___moreAuthorDetails
        }
      }
      fragment ___authorStuff___requestIndex_0___moreAuthorDetails on Author {
        ___authorStuff___requestIndex_0___fieldIndex_1: address
      } `;
    const mergedQuery = mergeQueryDocuments([doc]);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should stack multiple queries on an empty root query correctly', () => {
    const query1 = gql`
      query authorInfo {
        author {
          firstName
          lastName
        }
      }`;
    const query2 = gql`
      query personAddress {
        person {
          address
        }
      }`;
    const exp = gql`
      query ___composed {
        ___authorInfo___requestIndex_0___fieldIndex_0: author {
          firstName
          lastName
        }
        ___personAddress___requestIndex_1___fieldIndex_0: person {
          address
        }
      }`;
    const queries = [query1, query2];
    const mergedQuery = mergeQueryDocuments(queries);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should be able to merge queries that have fragments with the same name', () => {
    const query1 = gql`
      query authorInfo {
        ...authorDetails
      }
      fragment authorDetails on Author {
        author {
          firstName
          lastName
        }
      }`;
    const query2 = gql`
      query authors {
        ...authorDetails
      }
      fragment authorDetails on Author {
        author
      }`;
    const exp = gql`
      query ___composed {
        ...___authorInfo___requestIndex_0___authorDetails
        ...___authors___requestIndex_1___authorDetails
      }
      fragment ___authorInfo___requestIndex_0___authorDetails on Author {
        ___authorInfo___requestIndex_0___fieldIndex_1: author {
          firstName
          lastName
        }
      }
      fragment ___authors___requestIndex_1___authorDetails on Author {
        ___authors___requestIndex_1___fieldIndex_1: author
      }`;
    const mergedQuery = mergeQueryDocuments([query1, query2]);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should be able to merge queries with variables correctly', () => {
    const query1 = gql`
      query authorInfo($id: Int) {
        author(id: $id)
      }`;
    const query2 = gql`
      query personInfo($id: Int) {
        person(id: $id)
      }`;
    const exp = gql`
      query ___composed($___authorInfo___requestIndex_0___id: Int, $___personInfo___requestIndex_1___id: Int) {
        ___authorInfo___requestIndex_0___fieldIndex_0: author(id: $___authorInfo___requestIndex_0___id)
        ___personInfo___requestIndex_1___fieldIndex_0: person(id: $___personInfo___requestIndex_1___id)
      }`;
    const mergedQuery = mergeQueryDocuments([query1, query2]);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should be able to merge queries with inline fragments', () => {
    const query1 = gql`
      query nameOfQuery {
        ... on RootQuery {
          user
        }
      }`;
    const query2 = gql`
      query otherQuery {
        ... on RootQuery {
          author
        }
      }`;
    const exp = gql`
      query ___composed {
        ... on RootQuery {
          ___nameOfQuery___requestIndex_0___fieldIndex_0: user
        }
        ... on RootQuery {
          ___otherQuery___requestIndex_1___fieldIndex_0: author
        }
      }`;
    const mergedQuery = mergeQueryDocuments([query1, query2]);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should be able to handle multiple fragments when merging queries', () => {
    const query1 = gql`
      query authorInfo {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const query2 = gql`
      query personInfo {
        person {
          ...personDetails
        }
      }
      fragment personDetails on Person {
        name
      }`;
    const exp = gql`
      query ___composed {
        ___authorInfo___requestIndex_0___fieldIndex_0: author {
          ...___authorInfo___requestIndex_0___authorDetails
        }
        ___personInfo___requestIndex_1___fieldIndex_0: person {
          ...___personInfo___requestIndex_1___personDetails
        }
      }
      fragment ___authorInfo___requestIndex_0___authorDetails on Author {
        ___authorInfo___requestIndex_0___fieldIndex_1: firstName
        ___authorInfo___requestIndex_0___fieldIndex_2: lastName
      }
      fragment ___personInfo___requestIndex_1___personDetails on Person {
        ___personInfo___requestIndex_1___fieldIndex_1: name
      }`;

    const queries = [query1, query2];
    const mergedQuery = mergeQueryDocuments(queries);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should put together entire requests, i.e. with queries and variables', () => {
    const query1 = gql`
      query authorStuff($id: Int) {
        author(id: $id) {
          name
        }
      }`;
    const query2 = gql`
      query personStuff($name: String) {
        person(name: $name) {
          id
        }
      }`;
    const exp = gql`
      query ___composed($___authorStuff___requestIndex_0___id: Int, $___personStuff___requestIndex_1___name: String) {
        ___authorStuff___requestIndex_0___fieldIndex_0: author(id: $___authorStuff___requestIndex_0___id) {
          name
        }
        ___personStuff___requestIndex_1___fieldIndex_0: person(name: $___personStuff___requestIndex_1___name) {
          id
        }
      }`;
    const variables1 = {
      id: 18,
    };
    const variables2 = {
      name: 'John',
    };
    const expVariables = {
      ___authorStuff___requestIndex_0___id: 18,
      ___personStuff___requestIndex_1___name: 'John',
    };
    const request1 = {
      query: query1,
      variables: variables1,
    };
    const request2 = {
      query: query2,
      variables: variables2,
    };
    const requests = [request1, request2];
    const mergedRequest = mergeRequests(requests);

    assert.equal(print(mergedRequest.query), print(exp));
    assert.deepEqual(mergedRequest.variables, expVariables);
    assert.equal(mergedRequest.debugName, '___composed');
  });
  it('should not incorrectly order the field index numbers given an inline fragment', () => {
    const query = gql`
      query authorStuff {
        ... on RootQuery {
          firstName
          lastName
        }
        address
      }`;
    const exp = gql`
      query ___composed {
        ... on RootQuery {
          ___authorStuff___requestIndex_0___fieldIndex_0: firstName
          ___authorStuff___requestIndex_0___fieldIndex_1: lastName
        }
        ___authorStuff___requestIndex_0___fieldIndex_2: address
      }`;
    const mergedQuery = mergeQueryDocuments([query]);
    assert.equal(print(mergedQuery), print(exp));
  });

  it('should throw an error if there is a ___ in the name of a variable', () => {
    const query = gql`
      query author($___id: Int) {
        fortuneCookie
      }`;
    assert.throws(() => {
      mergeQueryDocuments([query]);
    });
  });

  it('should throw an error if there is a ___ in the name of a fragment', () => {
    const query = gql`
      query {
        ...___details
      }
      fragment ___details on RootQuery {
        fortuneCookie
      }`;
    assert.throws(() => {
      mergeQueryDocuments([query]);
    });
  });

  it('should throw an error if there is a ___ in the name of a top-level field', () => {
    const query = gql`
      query {
        ___fortuneCookie
      }`;
    assert.throws(() => {
      mergeQueryDocuments([query]);
    });
  });

  it('should throw if there is a ___ in the name of a top-level field within a fragment', () => {
    const query = gql`
      query {
        ...details
      }
      fragment details on RootQuery {
        ___fortuneCookie
      }`;
    assert.throws(() => {
      mergeQueryDocuments([query]);
    });
  });

  it('should not throw an error if there is a ___ in the name of a non-top-level field', () => {
    const query = gql`
      query {
        author {
          ___name
        }
      }`;
    assert.doesNotThrow(() => {
      mergeQueryDocuments([query]);
    });
  });

  describe('merged query unpacking', () => {
    it('should split data keys correctly', () => {
      const dataKey = '___queryName___requestIndex_0___fieldIndex_1';
      const parsedInfo = parseMergedKey(dataKey);
      const exp = {
        requestIndex: 0,
        fieldIndex: 1,
      };
      assert.deepEqual(parsedInfo, exp);
    });

    it('should unpack the merged result correctly for a single query', () => {
      const query = gql`
        query authorStuff {
          author {
            firstName
            lastName
          }
        }`;
      const request = { query };
      const result = {
        data: {
          ___authorStuff___requestIndex_0___fieldIndex_0: {
            'firstName': 'John',
            'lastName': 'Smith',
          },
        },
      };
      const expResult = {
        'data': {
          'author': {
            'firstName': 'John',
            'lastName': 'Smith',
          },
        },
      };
      const results = unpackMergedResult(result, [ request ]);
      assert.equal(results.length, 1);
      assert.deepEqual(results[0], expResult);
    });

    it('should unpack queries with fragment spreads', () => {
      const query1 = gql`
        query authorStuff {
          ...authorInfo
        }
        fragment authorInfo on RootQuery {
          author {
            firstName
            lastName
          }
        }`;
      const query2 = gql`
        query otherStuff {
          ...authorInfo
        }
        fragment authorInfo on RootQuery {
          author {
            firstName
            lastName
          }
        }`;
      const requests = [ { query: query1 }, { query: query2 }];
      const result = {
        data: {
          ___authorStuff___requestIndex_0___fieldIndex_0: {
            firstName: 'John',
            lastName: 'Smith',
          },
          ___otherStuff___requestIndex_1___fieldIndex_0: {
            firstName: 'Jane',
            lastName: 'Smith',
          },
        },
      };
      const expUnpackedResults = [
        {
          data: {
            author: {
              'firstName': 'John',
              'lastName': 'Smith',
            },
          },
        },
        {
          data: {
            author: {
              'firstName': 'Jane',
              'lastName': 'Smith',
            },
          },
        },
      ];

      const unpackedResults = unpackMergedResult(result, requests);
      assert.deepEqual(unpackedResults, expUnpackedResults);
    });

    it('should be able to unpack queries with inlined fragments', () => {
      const query1 = gql`
        query authorStuff {
          ... on RootQuery {
            author {
              firstName
            }
          }
        }`;
      const query2 = gql`
        query otherStuff {
          ... on RootQuery {
            author {
              lastName
            }
          }
        }`;
      const result = {
        data: {
          ___authorStuff___requestIndex_0___itemIndex_0: {
            firstName: 'John',
          },
          ___otherStuff___requestIndex_1___itemIndex_0: {
            lastName: 'Smith',
          },
        },
      };
      const expUnpackedResults = [
        {
          data: {
            'author': {
              'firstName': 'John',
            },
          },
        },
        {
          data: {
            'author': {
              'lastName': 'Smith',
            },
          },
        },
      ];
      const request1 = { query: query1 };
      const request2 = { query: query2 };
      const requests = [request1, request2];
      const unpackedResults = unpackMergedResult(result, requests);
      assert.deepEqual(unpackedResults, expUnpackedResults);
    });
  });

  it('should throw an error if we try to apply an alias name to a mutation doc', () => {
    const mutation = gql`
      mutation modifyEverything {
        fortuneCookie
      }`;
    const aliasName = 'totally_made_up';
    assert.throws(() => {
      applyAliasNameToDocument(mutation, aliasName);
    });
  });

  it('should correctly unpack results that consist of multiple fields', () => {
    const query1 = gql`
      query authorStuff {
        author {
          firstName
          lastName
        }
        __typename
      }
    `;
    const query2 = gql`
      query personStuff {
        person {
          name
        }
      }`;
    const result1 = {
      data: {
        __typename: 'RootQuery',
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    };
    const result2 = {
      data: {
        person: {
          name: 'John Smith',
        },
      },
    };
    const composedResult = {
      data: {
        ___authorStuff___requestIndex_0___fieldIndex_0: {
          firstName: 'John',
          lastName: 'Smith',
        },
        ___authorStuff___requestIndex_0___fieldIndex_1: 'RootQuery',
        ___personStuff___requestIndex_1___fieldIndex_0: {
          name: 'John Smith',
        },
      },
    };
    const requests = [{ query: query1 }, { query: query2 }];
    const unpackedResults = unpackMergedResult(composedResult, requests);
    assert.equal(unpackedResults.length, 2);

    assert.deepEqual(unpackedResults[0], result1);
    assert.deepEqual(unpackedResults[1], result2);
  });

  it('should correctly merge two queries that are the same other than variable values', () => {
    const query1 = gql`
      query authorStuff($id: Int) {
        author(id: $id) {
          name
        }
      }`;
    const query2 = gql`
      query authorStuff($id: Int) {
        author(id: $id) {
          name
        }
      }`;
    const expQuery = gql`
      query ___composed($___authorStuff___requestIndex_0___id: Int, $___authorStuff___requestIndex_1___id: Int) {
        ___authorStuff___requestIndex_0___fieldIndex_0: author(id: $___authorStuff___requestIndex_0___id) {
          name
        }

        ___authorStuff___requestIndex_1___fieldIndex_0: author(id: $___authorStuff___requestIndex_1___id) {
          name
        }
      }`;
    const mergedRequest = mergeRequests([{query: query1}, {query: query2}]);
    assert.equal(print(mergedRequest.query), print(expQuery));
  });
});
