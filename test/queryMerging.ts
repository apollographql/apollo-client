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
} from '../src/queries/queryMerging';

import {
  getQueryDefinition,
  getFragmentDefinitions,
} from '../src/queries/getFromAST';

import {
  print,
  Field,
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
    const childQueryDef = getQueryDefinition(childQuery);
    const rootQueryDef = getQueryDefinition(gql`query{ author }`);
    //this is a way to get our selection set to consist of nothing without
    //violating the GraphQL syntax
    rootQueryDef.selectionSet.selections = [];

    const expRootQuery = gql`
      query {
        __listOfAuthors__queryIndex_3__fieldIndex_0: author {
          firstName
          lastName
        }
        __listOfAuthors__queryIndex_3__fieldIndex_1: __typename
      }`;
    const modifiedRootQueryDef = addQueryToRoot(rootQueryDef, childQueryDef, 3);
    const expRootQueryDef = getQueryDefinition(expRootQuery);
    assert.equal(print(modifiedRootQueryDef), print(expRootQueryDef));
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
});
