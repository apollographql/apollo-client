import * as chai from 'chai';
const { assert } = chai;

import {
  applySkipResolver,
  applyIncludeResolver,
  applyDirectives,
  skipDirectiveResolver,
  includeDirectiveResolver,
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

  it('should include a field if the include is true', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @include(if: $shouldInclude)
        }
      }`;
    const variables = {
      shouldInclude: true,
    };
    const expQuery = gql`
      query {
        author {
         firstName
         lastName @include(if: $shouldInclude)
        }
     }`;
    const newQuery = applyDirectives(query, variables, {
      'skip': skipDirectiveResolver,
      'include': includeDirectiveResolver,
    });

    assert.equal(print(newQuery), print(expQuery));
  });

  it('should not include a field if the include is false', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @include(if: $shouldInclude)
        }
      }`;
    const variables = {
      shouldInclude: false,
    };
    const expQuery = gql`
      query {
        author {
          firstName
        }
      }`;
    const newQuery = applyDirectives(query, variables, {
      'skip': skipDirectiveResolver,
      'include': includeDirectiveResolver,
    });

    assert.equal(print(newQuery), print(expQuery));
  });

  it('should not remove the field when skip and include are both true', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip) @include(if: $shouldSkip)
        }
      }`;
    const variables = {
      shouldSkip: true,
    };
    const expQuery = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip) @include(if: $shouldSkip)
        }
      }`;
    const newQuery = applyDirectives(query, variables, {
      'skip': skipDirectiveResolver,
      'include': includeDirectiveResolver,
    });
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should not remove the field when skip and include are both false', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip) @include(if: $shouldSkip)
        }
      }`;
    const variables = {
      shouldSkip: false,
    };
    const expQuery = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip) @include(if: $shouldSkip)
        }
      }`;
    const newQuery = applyDirectives(query, variables, {
      'skip': skipDirectiveResolver,
      'include': includeDirectiveResolver,
    });
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should correctly apply include inside inline fragments', () => {
    const query = gql`
      query {
        ... on RootQuery {
          author {
            firstName
            lastName @include(if: $shouldInclude)
          }
        }
      }`;
    const variables = {
      shouldInclude: false,
    };
    const expQuery = gql`
      query {
        ... on RootQuery {
          author {
            firstName
          }
        }
      }`;
    const newQuery = applyIncludeResolver(query, variables);
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should remove the field when include and skip both tell it to', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @skip(if: $shouldSkip) @include(if: $shouldInclude)
        }
      }`;
    const variables = {
      shouldSkip: true,
      shouldInclude: false,
    };
    const expQuery = gql`
      query {
        author {
          firstName
        }
      }`;
    const newQuery = applyDirectives(query, variables, {
      'skip': skipDirectiveResolver,
      'include': includeDirectiveResolver,
    });
    assert.equal(print(newQuery), print(expQuery));
  });

  it('should not be affected by the order in which @skip and @include are presented', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName @include(if: $shouldInclude) @skip(if: $shouldSkip)
        }
      }`;
    const variables1 = {
      shouldSkip: true,
      shouldInclude: false,
    };
    const variables2 = {
      shouldSkip: false,
      shouldInclude: false,
    };
    const variables3 = {
      shouldSkip: true,
      shouldInclude: true,
    };
    const expQuery1 = gql`
      query {
        author {
          firstName
        }
      }`;
    const expQuery2 = gql`
      query {
        author {
          firstName
          lastName @include(if: $shouldInclude) @skip(if: $shouldSkip)
        }
      }`;
    const expQuery3 = gql`
      query {
        author {
          firstName
          lastName @include(if: $shouldInclude) @skip(if: $shouldSkip)
        }
      }`;
    const newQueries = [variables1, variables2, variables3].map((variables) => {
      return applyDirectives(query, variables, {
        'skip': skipDirectiveResolver,
        'include': includeDirectiveResolver,
      });
    });
    assert.equal(print(newQueries[0]), print(expQuery1));
    assert.equal(print(newQueries[1]), print(expQuery2));
    assert.equal(print(newQueries[2]), print(expQuery3));
  });
});
