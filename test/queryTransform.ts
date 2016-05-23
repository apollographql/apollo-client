import {
  addTypenameToSelectionSet,
  addTypenameToQuery,
  applyTransformerToQuery,
} from '../src/queries/queryTransform';
import { getQueryDefinition } from '../src/queries/getFromAST';
import { print } from 'graphql/language/printer';
import gql from '../src/gql';
import { assert } from 'chai';

describe('query transforms', () => {
  it('should correctly add typenames', () => {
    let testQuery = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
        }
      }
`;
    const queryDef = getQueryDefinition(testQuery);
    const queryRes = addTypenameToSelectionSet(queryDef.selectionSet);

    // GraphQL print the parsed, updated query and replace the trailing
    // newlines.
    const modifiedQueryStr = print(queryRes);
    const expectedQuery = getQueryDefinition(gql`
      query {
        author {
          name {
            firstName
            lastName
            __typename
          }
          __typename
        }
        __typename}`);
    const expectedQueryStr = print(expectedQuery);

    assert.equal(expectedQueryStr, modifiedQueryStr);
  });

  it('should correctly alter a query from the root', () => {
    const testQuery = gql`
      query {
        testString
      }`;
    const expectedQuery = getQueryDefinition(gql`
      query {
        testString
        __typename
      }`);
    const modifiedQuery = addTypenameToQuery(getQueryDefinition(testQuery));
    const modifiedQueryStr = print(modifiedQuery);
    const expectedQueryStr = print(expectedQuery);
    assert.equal(expectedQueryStr, modifiedQueryStr);
  });

  it('should not alter the original query AST', () => {
    const testQuery = gql`
      query {
        user {
          firstName
          lastName
        }
      }`;
    const expectedQueryStr = print(testQuery);
    addTypenameToQuery(getQueryDefinition(testQuery));

    //make sure that producing the modified query has not changed the original query
    assert.equal(expectedQueryStr, print(testQuery));
  });

  it('should not screw up on a FragmentSpread within the query AST', () => {
    const testQuery = getQueryDefinition(gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
        }
      }
    }`);
    const expectedQuery = getQueryDefinition(gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
          __typename
        }
        __typename
      }
      __typename
    }`);
    const modifiedQuery = addTypenameToQuery(testQuery);
    assert.equal(print(expectedQuery), print(modifiedQuery));
  });

  it('should be able to apply a QueryTransformer correctly', () => {
    const testQuery = getQueryDefinition(gql`
    query {
      author {
        firstName
        lastName
      }
    }`);

    const expectedQuery = getQueryDefinition(gql`
    query {
      author {
        firstName
        lastName
        __typename
      }
      __typename
    }
    `);

    const modifiedQuery = applyTransformerToQuery(testQuery, addTypenameToSelectionSet);
    assert.equal(print(expectedQuery), print(modifiedQuery));
  });

});
