import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';
import { disableFragmentWarnings } from 'graphql-tag';

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

import {
  addTypenameToDocument,
  removeDirectivesFromDocument,
  removeConnectionDirectiveFromDocument,
} from '../transform';
import { getQueryDefinition } from '../getFromAST';

describe('removeDirectivesFromDocument', () => {
  it('should remove a simple directive', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const expected = gql`
      query Simple {
        field
      }
    `;
    const doc = removeDirectivesFromDocument([{ name: 'storage' }], query);
    expect(print(doc)).toBe(print(expected));
  });
  it('should remove a simple directive [test function]', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const expected = gql`
      query Simple {
        field
      }
    `;
    const test = ({ name: { value } }) => value === 'storage';
    const doc = removeDirectivesFromDocument([{ test }], query);
    expect(print(doc)).toBe(print(expected));
  });
  it('should remove only the wanted directive', () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
      }
    `;

    const expected = gql`
      query Simple {
        maybe @skip(if: false)
        field
      }
    `;
    const doc = removeDirectivesFromDocument([{ name: 'storage' }], query);
    expect(print(doc)).toBe(print(expected));
  });

  it('should remove only the wanted directive [test function]', () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
      }
    `;

    const expected = gql`
      query Simple {
        maybe @skip(if: false)
        field
      }
    `;
    const test = ({ name: { value } }) => value === 'storage';
    const doc = removeDirectivesFromDocument([{ test }], query);
    expect(print(doc)).toBe(print(expected));
  });

  it('should remove multiple directives in the query', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        other: field @storage
      }
    `;

    const expected = gql`
      query Simple {
        field
        other: field
      }
    `;
    const doc = removeDirectivesFromDocument([{ name: 'storage' }], query);
    expect(print(doc)).toBe(print(expected));
  });
  it('should remove multiple directives of different kinds in the query', () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
        other: field @client
      }
    `;

    const expected = gql`
      query Simple {
        maybe @skip(if: false)
        field
        other: field
      }
    `;
    const removed = [
      { name: 'storage' },
      {
        test: directive => directive.name.value === 'client',
      },
    ];
    const doc = removeDirectivesFromDocument(removed, query);
    expect(print(doc)).toBe(print(expected));
  });
  it('should remove a simple directive and its field if needed', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        keep
      }
    `;

    const expected = gql`
      query Simple {
        keep
      }
    `;
    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );
    expect(print(doc)).toBe(print(expected));
  });
  it('should remove a simple directive [test function]', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        keep
      }
    `;

    const expected = gql`
      query Simple {
        keep
      }
    `;
    const test = ({ name: { value } }) => value === 'storage';
    const doc = removeDirectivesFromDocument([{ test, remove: true }], query);
    expect(print(doc)).toBe(print(expected));
  });
  it('should return null if the query is no longer valid', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );

    expect(doc).toBe(null);
  });
  it('should return null if the query is no longer valid [test function]', () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const test = ({ name: { value } }) => value === 'storage';
    const doc = removeDirectivesFromDocument([{ test, remove: true }], query);
    expect(doc).toBe(null);
  });
  it('should return null only if the query is not valid', () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        field
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );

    expect(print(doc)).toBe(print(query));
  });
  it('should return null only if the query is not valid through nested fragments', () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        field @storage
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );

    expect(doc).toBe(null);
  });
  it('should only remove values asked through nested fragments', () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        field @storage
        bar
      }
    `;

    const expectedQuery = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        bar
      }
    `;
    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );

    expect(print(doc)).toBe(print(expectedQuery));
  });

  it('should return null even through fragments if needed', () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        field @storage
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: 'storage', remove: true }],
      query,
    );

    expect(doc).toBe(null);
  });
});

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
    const newQueryDoc = addTypenameToDocument(testQuery);

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

    expect(expectedQueryStr).toBe(print(newQueryDoc));
  });
  it('should memoize and return cached results', () => {
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
    const newQueryDoc = addTypenameToDocument(testQuery);
    const secondCall = addTypenameToDocument(testQuery);
    expect(newQueryDoc).toBe(secondCall);
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
    const newQueryDoc = addTypenameToDocument(testQuery);

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

    expect(expectedQueryStr).toBe(print(newQueryDoc));
  });

  it('should not screw up on a FragmentSpread within the query AST', () => {
    const testQuery = gql`
      query withFragments {
        user(id: 4) {
          friends(first: 10) {
            ...friendFields
          }
        }
      }
    `;
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
    const modifiedQuery = addTypenameToDocument(testQuery);
    expect(print(expectedQuery)).toBe(print(getQueryDefinition(modifiedQuery)));
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
      }
    `;

    const newQueryDoc = addTypenameToDocument(testQuery);

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
      }
    `;

    expect(print(expectedQuery)).toBe(print(newQueryDoc));
  });

  it('should be able to apply a QueryTransformer correctly', () => {
    const testQuery = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const expectedQuery = getQueryDefinition(gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `);

    const modifiedQuery = addTypenameToDocument(testQuery);
    expect(print(expectedQuery)).toBe(print(getQueryDefinition(modifiedQuery)));
  });

  it('should be able to apply a MutationTransformer correctly', () => {
    const testQuery = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
        }
      }
    `;
    const expectedQuery = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
          __typename
        }
      }
    `;

    const modifiedQuery = addTypenameToDocument(testQuery);
    expect(print(expectedQuery)).toBe(print(modifiedQuery));
  });

  it('should add typename fields correctly on this one query', () => {
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
      }
    `;
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
      }
    `);
    const modifiedQuery = addTypenameToDocument(testQuery);
    expect(print(expectedQuery)).toBe(print(getQueryDefinition(modifiedQuery)));
  });
  it('should correctly remove connections', () => {
    let testQuery = gql`
      query {
        author {
          name @connection(key: "foo") {
            firstName
            lastName
          }
        }
      }
    `;
    const newQueryDoc = removeConnectionDirectiveFromDocument(testQuery);

    const expectedQuery = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
        }
      }
    `;
    const expectedQueryStr = print(expectedQuery);

    expect(expectedQueryStr).toBe(print(newQueryDoc));
  });
  it('should memoize and return cached results', () => {
    let testQuery = gql`
      query {
        author {
          name @connection(key: "foo") {
            firstName
            lastName
          }
        }
      }
    `;
    const newQueryDoc = removeConnectionDirectiveFromDocument(testQuery);
    const secondCall = removeConnectionDirectiveFromDocument(testQuery);
    expect(newQueryDoc).toBe(secondCall);
  });
});
