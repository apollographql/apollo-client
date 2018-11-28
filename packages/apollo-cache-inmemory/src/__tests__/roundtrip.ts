import { getFragmentDefinitions, createFragmentMap } from 'apollo-utilities';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { stripSymbols } from 'apollo-utilities';

import { withError } from './diffAgainstStore';
import { withWarning } from './writeToStore';

import { DepTrackingCache } from '../depTrackingCache';

import {
  HeuristicFragmentMatcher,
  StoreReader,
  StoreWriter,
} from '../';

const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

function storeRoundtrip(query: DocumentNode, result: any, variables = {}) {
  const reader = new StoreReader();
  const writer = new StoreWriter();

  const store = writer.writeQueryToStore({
    result,
    query,
    variables,
  });

  const readOptions = {
    store,
    query,
    variables,
    fragmentMatcherFunction,
  };

  const reconstructedResult = reader.readQueryFromStore(readOptions);
  expect(reconstructedResult).toEqual(result);

  // Make sure the result is identical if we haven't written anything new
  // to the store. https://github.com/apollographql/apollo-client/pull/3394
  expect(store).toBeInstanceOf(DepTrackingCache);
  expect(reader.readQueryFromStore(readOptions)).toBe(reconstructedResult);

  // Now make sure subtrees of the result are identical even after we write
  // an additional bogus field to the store.
  writer.writeQueryToStore({
    store,
    result: { oyez: 1234 },
    query: gql`
      {
        oyez
      }
    `,
  });

  const deletedRootResult = reader.readQueryFromStore(readOptions);
  expect(deletedRootResult).toEqual(result);

  if (deletedRootResult === reconstructedResult) {
    // We don't expect the new result to be identical to the previous result,
    // but there are some rare cases where that can happen, and it's a good
    // thing, because it means the caching system is working slightly better
    // than expected... and we don't need to continue with the rest of the
    // comparison logic below.
    return;
  }

  function expectStrictEqualExceptArrays(a, b) {
    if (Array.isArray(a)) {
      // The caching system caches result objects but not result arrays, so we
      // recursively compare array elements using expectStrictEqualExceptArrays.
      expect(Array.isArray(b)).toBe(true);
      expect(a.length).toBe(b.length);
      a.forEach((aItem, index) => {
        expectStrictEqualExceptArrays(aItem, b[index]);
      });
    } else {
      expect(a).toBe(b);
    }
  }

  Object.keys(result).forEach(key => {
    expectStrictEqualExceptArrays(
      deletedRootResult[key],
      reconstructedResult[key],
    );
  });
}

describe('roundtrip', () => {
  it('real graphql result', () => {
    storeRoundtrip(
      gql`
        {
          people_one(id: "1") {
            name
          }
        }
      `,
      {
        people_one: {
          name: 'Luke Skywalker',
        },
      },
    );
  });

  it('multidimensional array (#776)', () => {
    storeRoundtrip(
      gql`
        {
          rows {
            value
          }
        }
      `,
      {
        rows: [[{ value: 1 }, { value: 2 }], [{ value: 3 }, { value: 4 }]],
      },
    );
  });

  it('array with null values (#1551)', () => {
    storeRoundtrip(
      gql`
        {
          list {
            value
          }
        }
      `,
      {
        list: [null, { value: 1 }],
      },
    );
  });

  it('enum arguments', () => {
    storeRoundtrip(
      gql`
        {
          hero(episode: JEDI) {
            name
          }
        }
      `,
      {
        hero: {
          name: 'Luke Skywalker',
        },
      },
    );
  });

  it('with an alias', () => {
    storeRoundtrip(
      gql`
        {
          luke: people_one(id: "1") {
            name
          }
          vader: people_one(id: "4") {
            name
          }
        }
      `,
      {
        luke: {
          name: 'Luke Skywalker',
        },
        vader: {
          name: 'Darth Vader',
        },
      },
    );
  });

  it('with variables', () => {
    storeRoundtrip(
      gql`
        {
          luke: people_one(id: $lukeId) {
            name
          }
          vader: people_one(id: $vaderId) {
            name
          }
        }
      `,
      {
        luke: {
          name: 'Luke Skywalker',
        },
        vader: {
          name: 'Darth Vader',
        },
      },
      {
        lukeId: '1',
        vaderId: '4',
      },
    );
  });

  it('with GraphQLJSON scalar type', () => {
    storeRoundtrip(
      gql`
        {
          updateClub {
            uid
            name
            settings
          }
        }
      `,
      {
        updateClub: {
          uid: '1d7f836018fc11e68d809dfee940f657',
          name: 'Eple',
          settings: {
            name: 'eple',
            currency: 'AFN',
            calendarStretch: 2,
            defaultPreAllocationPeriod: 1,
            confirmationEmailCopy: null,
            emailDomains: null,
          },
        },
      },
    );
  });

  describe('directives', () => {
    it('should be able to query with skip directive true', () => {
      storeRoundtrip(
        gql`
          query {
            fortuneCookie @skip(if: true)
          }
        `,
        {},
      );
    });

    it('should be able to query with skip directive false', () => {
      storeRoundtrip(
        gql`
          query {
            fortuneCookie @skip(if: false)
          }
        `,
        { fortuneCookie: 'live long and prosper' },
      );
    });
  });

  describe('fragments', () => {
    it('should work on null fields', () => {
      storeRoundtrip(
        gql`
          query {
            field {
              ... on Obj {
                stuff
              }
            }
          }
        `,
        {
          field: null,
        },
      );
    });

    it('should work on basic inline fragments', () => {
      storeRoundtrip(
        gql`
          query {
            field {
              __typename
              ... on Obj {
                stuff
              }
            }
          }
        `,
        {
          field: {
            __typename: 'Obj',
            stuff: 'Result',
          },
        },
      );
    });

    it('should resolve on union types with inline fragments without typenames with warning', () => {
      return withWarning(() => {
        storeRoundtrip(
          gql`
            query {
              all_people {
                name
                ... on Jedi {
                  side
                }
                ... on Droid {
                  model
                }
              }
            }
          `,
          {
            all_people: [
              {
                name: 'Luke Skywalker',
                side: 'bright',
              },
              {
                name: 'R2D2',
                model: 'astromech',
              },
            ],
          },
        );
      }, /using fragments/);
    });

    // XXX this test is weird because it assumes the server returned an incorrect result
    // However, the user may have written this result with client.writeQuery.
    it('should throw an error on two of the same inline fragment types', () => {
      return expect(() => {
        storeRoundtrip(
          gql`
            query {
              all_people {
                __typename
                name
                ... on Jedi {
                  side
                }
                ... on Jedi {
                  rank
                }
              }
            }
          `,
          {
            all_people: [
              {
                __typename: 'Jedi',
                name: 'Luke Skywalker',
                side: 'bright',
              },
            ],
          },
        );
      }).toThrowError(/Can\'t find field rank on object/);
    });

    it('should resolve fields it can on interface with non matching inline fragments', () => {
      return withError(() => {
        storeRoundtrip(
          gql`
            query {
              dark_forces {
                __typename
                name
                ... on Droid {
                  model
                }
              }
            }
          `,
          {
            dark_forces: [
              {
                __typename: 'Droid',
                name: '8t88',
                model: '88',
              },
              {
                __typename: 'Darth',
                name: 'Anakin Skywalker',
              },
            ],
          },
        );
      }, /IntrospectionFragmentMatcher/);
    });

    it('should resolve on union types with spread fragments', () => {
      return withError(() => {
        storeRoundtrip(
          gql`
            fragment jediFragment on Jedi {
              side
            }

            fragment droidFragment on Droid {
              model
            }

            query {
              all_people {
                __typename
                name
                ...jediFragment
                ...droidFragment
              }
            }
          `,
          {
            all_people: [
              {
                __typename: 'Jedi',
                name: 'Luke Skywalker',
                side: 'bright',
              },
              {
                __typename: 'Droid',
                name: 'R2D2',
                model: 'astromech',
              },
            ],
          },
        );
      }, /IntrospectionFragmentMatcher/);
    });

    it('should work with a fragment on the actual interface or union', () => {
      return withError(() => {
        storeRoundtrip(
          gql`
            fragment jediFragment on Character {
              side
            }

            fragment droidFragment on Droid {
              model
            }

            query {
              all_people {
                name
                __typename
                ...jediFragment
                ...droidFragment
              }
            }
          `,
          {
            all_people: [
              {
                __typename: 'Jedi',
                name: 'Luke Skywalker',
                side: 'bright',
              },
              {
                __typename: 'Droid',
                name: 'R2D2',
                model: 'astromech',
              },
            ],
          },
        );
      }, /IntrospectionFragmentMatcher/);
    });

    it('should throw on error on two of the same spread fragment types', () => {
      expect(() =>
        storeRoundtrip(
          gql`
            fragment jediSide on Jedi {
              side
            }

            fragment jediRank on Jedi {
              rank
            }

            query {
              all_people {
                __typename
                name
                ...jediSide
                ...jediRank
              }
            }
          `,
          {
            all_people: [
              {
                __typename: 'Jedi',
                name: 'Luke Skywalker',
                side: 'bright',
              },
            ],
          },
        ),
      ).toThrowError(/Can\'t find field rank on object/);
    });

    it('should resolve on @include and @skip with inline fragments', () => {
      storeRoundtrip(
        gql`
          query {
            person {
              name
              __typename
              ... on Jedi @include(if: true) {
                side
              }
              ... on Droid @skip(if: true) {
                model
              }
            }
          }
        `,
        {
          person: {
            __typename: 'Jedi',
            name: 'Luke Skywalker',
            side: 'bright',
          },
        },
      );
    });

    it('should resolve on @include and @skip with spread fragments', () => {
      storeRoundtrip(
        gql`
          fragment jediFragment on Jedi {
            side
          }

          fragment droidFragment on Droid {
            model
          }

          query {
            person {
              name
              __typename
              ...jediFragment @include(if: true)
              ...droidFragment @skip(if: true)
            }
          }
        `,
        {
          person: {
            __typename: 'Jedi',
            name: 'Luke Skywalker',
            side: 'bright',
          },
        },
      );
    });
  });
});
