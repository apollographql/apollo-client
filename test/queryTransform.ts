import {
  addTypenameToSelectionSet,
  addFieldToSelectionSet,
  applyTransformers,
} from '../src/queries/queryTransform';

import {
  SelectionSet,
} from 'graphql';

import {
  getQueryDefinition,
} from '../src/queries/getFromAST';

import { print } from 'graphql-tag/printer';
import gql from 'graphql-tag';
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
    const newQueryDoc = applyTransformers(testQuery, [addTypenameToSelectionSet]);

    const expectedQuery = gql`
      query {
        author {
          name {
            firstName
            lastName
            __typename
          }
          __typename
        }
      }
    `;
    const expectedQueryStr = print(expectedQuery);

    assert.equal(expectedQueryStr, print(newQueryDoc));
  });

  it('should correctly add custom fields', () => {
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
    function addBirthdayField(selectionSet: SelectionSet, isRoot?: boolean) {
      return addFieldToSelectionSet('birthday', selectionSet, isRoot);
    }
    const newQueryDoc = applyTransformers(testQuery, [addBirthdayField]);
    const queryDef = getQueryDefinition(newQueryDoc);

    // GraphQL print the parsed, updated query and replace the trailing
    // newlines.
    const modifiedQueryStr = print(queryDef);
    const expectedQuery = getQueryDefinition(gql`
      query {
        author {
          name {
            firstName
            lastName
            birthday
          }
          birthday
        }
      }
    `);
    const expectedQueryStr = print(expectedQuery);

    assert.equal(expectedQueryStr, modifiedQueryStr);
  });

  it('should not add duplicates', () => {
    let testQuery = gql`
      query {
        author {
          name {
            firstName
            lastName
            __typename
          }
        }
      }
    `;
    const newQueryDoc = applyTransformers(testQuery, [addTypenameToSelectionSet]);

    const expectedQuery = gql`
      query {
        author {
          name {
            firstName
            lastName
            __typename
          }
          __typename
        }
      }
    `;
    const expectedQueryStr = print(expectedQuery);

    assert.equal(expectedQueryStr, print(newQueryDoc));
  });

  it('should not screw up on a FragmentSpread within the query AST', () => {
    const testQuery = gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
        }
      }
    }`;
    const expectedQuery = getQueryDefinition(gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
          __typename
        }
        __typename
      }
    }
    `);
    const modifiedQuery = applyTransformers(testQuery, [addTypenameToSelectionSet]);
    assert.equal(print(expectedQuery), print(getQueryDefinition(modifiedQuery)));
  });

  it('should modify all definitions in a document', () => {
    const testQuery = gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
        }
      }
    }
    fragment friendFields on User {
      firstName
      lastName
    }`;

    const newQueryDoc = applyTransformers(testQuery, [addTypenameToSelectionSet]);

    const expectedQuery = gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
          __typename
        }
        __typename
      }
    }
    fragment friendFields on User {
      firstName
      lastName
      __typename
    }`;

    assert.equal(print(expectedQuery), print(newQueryDoc));
  });

  it('should be able to apply a QueryTransformer correctly', () => {
    const testQuery = gql`
    query {
      author {
        firstName
        lastName
      }
    }`;

    const expectedQuery = getQueryDefinition(gql`
    query {
      author {
        firstName
        lastName
        __typename
      }
    }
    `);

    const modifiedQuery = applyTransformers(testQuery, [addTypenameToSelectionSet]);
    assert.equal(print(expectedQuery), print(getQueryDefinition(modifiedQuery)));
  });

  it('should be able to apply multiple transformers', () => {
    const testQuery = gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
        }
      }
    }
    fragment friendFields on User {
      firstName
      lastName
    }`;
    function addBirthdayField(selectionSet: SelectionSet, isRoot?: boolean) {
      return addFieldToSelectionSet('birthday', selectionSet, isRoot);
    }
    const newQueryDoc = applyTransformers(testQuery, [addTypenameToSelectionSet, addBirthdayField]);

    const expectedQuery = gql`
    query withFragments {
      user(id: 4) {
        friends(first: 10) {
          ...friendFields
          __typename
          birthday
        }
        __typename
        birthday
      }
    }
    fragment friendFields on User {
      firstName
      lastName
      __typename
      birthday
    }`;

    assert.equal(print(expectedQuery), print(newQueryDoc));
  });

  it('should be able to apply a MutationTransformer correctly', () => {
    const testQuery = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
        }
      }`;
    const expectedQuery = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
          __typename
        }
      }`;

    const modifiedQuery = applyTransformers(testQuery, [addTypenameToSelectionSet]);
    assert.equal(print(expectedQuery), print(modifiedQuery));

  });

  it('should add typename fields correctly on this one query' , () => {
    const testQuery = gql`
        query Feed($type: FeedType!) {
          # Eventually move this into a no fetch query right on the entry
          # since we literally just need this info to determine whether to
          # show upvote/downvote buttons
          currentUser {
            login
          }
          feed(type: $type) {
            createdAt
            score
            commentCount
            id
            postedBy {
              login
              html_url
            }

            repository {
              name
              full_name
              description
              html_url
              stargazers_count
              open_issues_count
              created_at
              owner {
                avatar_url
              }
            }
          }
        }`;
    const expectedQuery = getQueryDefinition(gql`
      query Feed($type: FeedType!) {
          currentUser {
            login
            __typename
          }
          feed(type: $type) {
            createdAt
            score
            commentCount
            id
            postedBy {
              login
              html_url
              __typename
            }

            repository {
              name
              full_name
              description
              html_url
              stargazers_count
              open_issues_count
              created_at
              owner {
                avatar_url
                __typename
              }
              __typename
            }
            __typename
          }
        }`);
    const modifiedQuery = applyTransformers(testQuery, [addTypenameToSelectionSet]);
    assert.equal(print(expectedQuery), print(getQueryDefinition(modifiedQuery)));
  });
});
