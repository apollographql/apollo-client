import { assert } from 'chai';
import { scopeSelectionSetToResultPath } from '../src/data/scopeQuery';

import {
  createFragmentMap,
  getFragmentDefinitions,
  getQueryDefinition,
  getMutationDefinition,
  getFragmentDefinition,
} from '../src/queries/getFromAST';

import gql from 'graphql-tag';

import {
  print,
  Document,
} from 'graphql';

// To test:
// 1. basic
// 2. aliases
// 3. arguments
// 4. fragments
// 5. directives

describe('scoping selection set', () => {
  it('basic', () => {
    testScope(
      gql`
        {
          a {
            b
            c {
              d
            }
          }
        }
      `,
      gql`
        {
          b
          c {
            d
          }
        }
      `,
      ['a']
    );

    testScope(
      gql`
        {
          a {
            b
            c {
              d
            }
          }
        }
      `,
      gql`
        {
          d
        }
      `,
      ['a', 'c']
    );
  });

  it('directives', () => {
    testScope(
      gql`
        {
          a @defer {
            b
            c @live {
              d
            }
          }
        }
      `,
      gql`
        {
          b
          c @live {
            d
          }
        }
      `,
      ['a']
    );
  });

  it('alias', () => {
    testScope(
      gql`
        {
          alias: a {
            b
            c {
              d
            }
          }
        }
      `,
      gql`
        {
          b
          c {
            d
          }
        }
      `,
      ['alias']
    );
  });

  it('inline fragment', () => {
    testScope(
      gql`
        {
          ... on Query {
            a {
              b
              c {
                d
              }
            }
          }
        }
      `,
      gql`
        {
          b
          c {
            d
          }
        }
      `,
      ['a']
    );
  });

  it('named fragment', () => {
    testScope(
      gql`
        {
          ...Frag
        }

        fragment Frag on Query {
          a {
            b
            c {
              d
            }
          }
        }
      `,
      gql`
        {
          b
          c {
            d
          }
        }
      `,
      ['a']
    );
  });

  describe('errors', () => {
    it('basic collision', () => {
      assert.throws(() => {
        scope(
          gql`
            {
              a {
                b
              }
              a {
                c
              }
            }
          `,
          ['a']
        );
      }, /Multiple fields found/);
    });

    it('named fragment collision', () => {
      assert.throws(() => {
        scope(
          gql`
            {
              a {
                b
              }
              ...Frag
            }

            fragment Frag on Query {
              a {
                b
                c {
                  d
                }
              }
            }
          `,
          ['a']
        );
      }, /Multiple fields found/);
    });

    it('inline fragment collision', () => {
      assert.throws(() => {
        scope(gql`
            {
              a {
                b
              }
              ... on Query {
                a {
                  b
                  c {
                    d
                  }
                }
              }
            }
          `,
          ['a']
        );
      }, /Multiple fields found/);
    });
  });
});

function extractMainSelectionSet(doc) {
  let mainDefinition;

  try {
    mainDefinition = getQueryDefinition(doc);
  } catch (e) {
    try {
      mainDefinition = getMutationDefinition(doc);
    } catch (e) {
      try {
        mainDefinition = getFragmentDefinition(doc);
      } catch (e) {
        throw new Error('Could not find query, mutation, or fragment in document.');
      }
    }
  }

  return mainDefinition.selectionSet;
}

function scope(doc: Document, path: (string | number)[]) {
  const fragmentMap = createFragmentMap(getFragmentDefinitions(doc));

  const selectionSet = extractMainSelectionSet(doc);

  return scopeSelectionSetToResultPath({
    selectionSet,
    fragmentMap,
    path,
  });
}

function testScope(firstDoc, secondDoc, path) {
  assert.equal(
    print(scope(firstDoc, path)).trim(),
    print(secondDoc).trim()
  );
}
