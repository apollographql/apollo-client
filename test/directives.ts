import * as chai from 'chai';
const { assert } = chai;

import {
  applySkipResolver,
} from '../src/queries/directives';

import gql from '../src/gql';

import { print } from 'graphql/language/printer';

describe('query directives', () => {
  it('should trim skipped fields from a selection set', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @skip(if: true)
        }
      }`;
    const expQuery = gql`
      query {
        author {
          firstName
        }
      }`;

    const newQuery = applySkipResolver(query);
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should trimmed skipped fields in queries with inlined fragments', () => {
    const query = gql`
      query {
        author {
          ...authorDetails on Author {
            firstName
            lastName @skip(if: true)
          }
        }
      }`;
    const expQuery = gql`
      query {
        author {
          ...authorDetails on Author {
            firstName
          }
        }
      }`;
    const newQuery = applySkipResolver(query);
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should throw an error if the argument to skip is not present', () => {
    const query = gql`
      query {
        author {
          ...authorDetails on Author {
            firstName
            lastName @skip(someotherag: true)
          }
        }
     }`;
    assert.throws(() => {
      applySkipResolver(query);
    });
  });

  it('should throw an error if there are extra arguments to skip', () => {
    const query = gql`
      query {
        author {
          ... on Author {
            firstName
            lastName @skip(if: true, useless: false)
          }
        }
      }`;
    assert.throws(() => {
      applySkipResolver(query);
    });
  });

  it('should skip stuff inside fragment spreads', () => {
    const query = gql`
      query {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName @skip(if: true)
      }`;

    const expQuery = gql`
      query {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
         firstName
      }`;

    const newQuery = applySkipResolver(query);
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should evaluate variables for skips', () => {
    const query = gql`
      query myQuery($shouldSkip: Boolean) {
        author {
          firstName
          lastName @skip(if: $shouldSkip)
        }
      }`;
    const variables = {
      shouldSkip: true,
    };
    const expQuery = gql`
      query myQuery($shouldSkip: Boolean) {
        author {
          firstName
        }
      }`;

    const newQuery = applySkipResolver(query, variables);
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should throw an error if an invalid variable is referenced in the skip directive', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip)
        }
      }`;
    const variables = {};
    assert.throws(() => {
      applySkipResolver(query, variables);
    });
  });
});
