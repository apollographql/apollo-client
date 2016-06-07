import {
  addPrefixToVariables,
  addPrefixToQuery,
  aliasField,
  getQueryAliasName,
  applyAliasNameToQuery,
  addQueryToRoot,
  applyAliasNameToFragment,
  applyAliasNameToDocument,
  renameFragmentSpreads,
  mergeQueries,
} from '../src/queries/queryMerging';

import {
  getQueryDefinition,
  getFragmentDefinitions,
} from '../src/queries/getFromAST';

import {
  print,
  Field,
  OperationDefinition,
} from 'graphql';

import gql from '../src/gql';
import { assert } from 'chai';

describe('Query merging', () => {
  it('should be able to add a prefix to a variables object', () => {
    const variables = {
      'offset': 15,
      'not_offset': 'lol',
    };

    const expResult = {
      '__feed:offset': 15,
      '__feed:not_offset': 'lol',
    };

    const result = addPrefixToVariables('__feed:', variables);
    assert.deepEqual(result, expResult);
  });

  it('should be able to add a prefix to the query name', () => {
    const query = gql`
      query author {
        firstName
        lastName
      }`;
    const expQuery = gql`
      query __composed__author {
        firstName
        lastName
      }`;

    const queryDefinition = getQueryDefinition(query);
    const expQueryDefinition = getQueryDefinition(expQuery);

    const resultQueryDefinition = addPrefixToQuery('__composed__', queryDefinition);
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
    const queryDefinition = getQueryDefinition(query);
    const expQueryDefinition = getQueryDefinition(expQuery);
    const queryField = queryDefinition.selectionSet.selections[0];
    const expField = expQueryDefinition.selectionSet.selections[0];
    const resField = aliasField(queryField as Field, 'listOfAuthors');
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
    const expAliasName = '__listOfAuthors__queryIndex_3';
    const resAliasName = getQueryAliasName(getQueryDefinition(query), 3);
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
        __listOfAuthors__queryIndex_3__fieldIndex_0: author {
          firstName
          lastName
        }
        __listOfAuthors__queryIndex_3__fieldIndex_1: __typename
      }`;
    const queryDef = getQueryDefinition(query);
    const expQueryDef = getQueryDefinition(expQuery);
    const aliasName = getQueryAliasName(queryDef, 3);
    const aliasedQuery = applyAliasNameToQuery(queryDef, aliasName, 0);
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
      query __composed {
        author
      }`;
    (rootQuery.definitions[0] as OperationDefinition).selectionSet.selections = [];

    const expRootQuery = gql`
      query __composed {
        __listOfAuthors__queryIndex_3__fieldIndex_0: author {
          firstName
          lastName
        }
        __listOfAuthors__queryIndex_3__fieldIndex_1: __typename
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
    const queryDefinition = getQueryDefinition(query);
    const fragmentDefinition = getFragmentDefinitions(query)[0];
    const aliasName = getQueryAliasName(queryDefinition, 2);
    const exp = getFragmentDefinitions(gql`
      fragment __authorStuff__queryIndex_2__authorDetails on Author {
        __authorStuff__queryIndex_2__fieldIndex_0: firstName
        __authorStuff__queryIndex_2__fieldIndex_1: lastName
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
          ...__authorStuff__queryIndex_2__authorDetails
        }
      }`;
    const queryDef = getQueryDefinition(doc);
    const expDef = getQueryDefinition(exp);
    const res = renameFragmentSpreads(queryDef.selectionSet,
                                      '__authorStuff__queryIndex_2');
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
        __authorStuff__queryIndex_2__fieldIndex_0: author {
          ...__authorStuff__queryIndex_2__authorDetails
        }
      }
      fragment __authorStuff__queryIndex_2__authorDetails on Author {
        __authorStuff__queryIndex_2__fieldIndex_1: firstName
        __authorStuff__queryIndex_2__fieldIndex_2: lastName
      }
      `;
    const aliasName = getQueryAliasName(getQueryDefinition(doc), 2);
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
      query getUser($__getUser__queryIndex_2__id: Int) {
        __getUser__queryIndex_2__fieldIndex_0: user(id: $__getUser__queryIndex_2__id) {
          firstName
          lastName
        }
      }`;
    const aliasName = getQueryAliasName(getQueryDefinition(doc), 2);
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
      query __composed {
        __authorStuff__queryIndex_0__fieldIndex_0: author {
          firstName
          lastName
          ...__authorStuff__queryIndex_0__moreAuthorDetails
        }
      }
      fragment __authorStuff__queryIndex_0__moreAuthorDetails on Author {
        __authorStuff__queryIndex_0__fieldIndex_1: address
      } `;
    const mergedQuery = mergeQueries([doc]);
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
      query __composed {
        __authorInfo__queryIndex_0__fieldIndex_0: author {
          firstName
          lastName
        }
        __personAddress__queryIndex_1__fieldIndex_0: person {
          address
        }
      }`;
    const queries = [query1, query2];
    const mergedQuery = mergeQueries(queries);
    assert.equal(print(mergedQuery), print(exp));
  });
});
