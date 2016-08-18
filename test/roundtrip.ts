import { assert } from 'chai';

import { writeQueryToStore } from '../src/data/writeToStore';
import { readQueryFromStore } from '../src/data/readFromStore';
import {
  getFragmentDefinitions,
  createFragmentMap,
} from '../src/queries/getFromAST';

import {
  Document,
} from 'graphql';

import gql from 'graphql-tag';

describe('roundtrip', () => {
  it('real graphql result', () => {
    storeRoundtrip(gql`
      {
        people_one(id: "1") {
          name
        }
      }
    `, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });
  });

  it('with an alias', () => {
    storeRoundtrip(gql`
      {
        luke: people_one(id: "1") {
          name,
        },
        vader: people_one(id: "4") {
          name,
        }
      }
    `, {
      luke: {
        name: 'Luke Skywalker',
      },
      vader: {
        name: 'Darth Vader',
      },
    });
  });

  it('with variables', () => {
    storeRoundtrip(gql`
      {
        luke: people_one(id: $lukeId) {
          name,
        },
        vader: people_one(id: $vaderId) {
          name,
        }
      }
    `, {
      luke: {
        name: 'Luke Skywalker',
      },
      vader: {
        name: 'Darth Vader',
      },
    }, {
      lukeId: '1',
      vaderId: '4',
    });
  });

  it('with GraphQLJSON scalar type', () => {
    storeRoundtrip(gql`
      {
        updateClub {
          uid,
          name,
          settings
        }
      }
    `, {
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
    });
  });

  describe('directives', () => {
    it('should be able to query with skip directive true', () => {
      storeRoundtrip(gql`
        query {
          fortuneCookie @skip(if: true)
        }
      `, {});
    });

    it('should be able to query with skip directive false', () => {
      storeRoundtrip(gql`
        query {
          fortuneCookie @skip(if: false)
        }
      `, {fortuneCookie: 'live long and prosper'});
    });
  });

  describe('fragments', () => {
    it('should resolve on union types with inline fragments', () => {
      storeRoundtrip(gql`
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
        }`, {
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
      });
    });

    it('should throw an error on two of the same inline fragment types', () => {
      assert.throws(() => {
        storeRoundtrip(gql`
          query {
            all_people {
              name
              ... on Jedi {
                side
              }
              ... on Jedi {
                rank
              }
            }
          }`, {
          all_people: [
            {
              name: 'Luke Skywalker',
              side: 'bright',
            },
          ],
          });
      }, /Can\'t find field rank on result object/);
    });

    it('should resolve on union types with spread fragments', () => {
      storeRoundtrip(gql`
        fragment jediFragment on Jedi {
          side
        }

        fragment droidFragment on Droid {
          model
        }

        query {
          all_people {
            name
            ...jediFragment
            ...droidFragment
          }
        }`, {
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
      });
    });

    it('should throw on error on two of the same spread fragment types', () => {
      assert.throws(() =>
        storeRoundtrip(gql`
          fragment jediSide on Jedi {
            side
          }

          fragment jediRank on Jedi {
            rank
          }

          query {
            all_people {
              name
              ...jediSide
              ...jediRank
            }
          }`, {
          all_people: [
            {
              name: 'Luke Skywalker',
              side: 'bright',
            },
          ],
        })
      , /Can\'t find field rank on result object/);
    });

    it('should resolve on @include and @skip with inline fragments', () => {
      storeRoundtrip(gql`
        query {
          person {
            name
            ... on Jedi @include(if: true) {
              side
            }
            ... on Droid @skip(if: true) {
              model
            }
          }
        }`, {
        person: {
          name: 'Luke Skywalker',
          side: 'bright',
        },
      });
    });

    it('should resolve on @include and @skip with spread fragments', () => {
      storeRoundtrip(gql`
        fragment jediFragment on Jedi {
          side
        }

        fragment droidFragment on Droid {
          model
        }

        query {
          person {
            name
            ...jediFragment @include(if: true)
            ...droidFragment @skip(if: true)
          }
        }`, {
        person: {
          name: 'Luke Skywalker',
          side: 'bright',
        },
      });
    });
  });
});

function storeRoundtrip(query: Document, result: any, variables = {}) {
  const fragmentMap = createFragmentMap(getFragmentDefinitions(query));
  const store = writeQueryToStore({
    result,
    query,
    variables,
    fragmentMap,
  });

  const reconstructedResult = readQueryFromStore({
    store,
    query,
    variables,
    fragmentMap,
  });

  assert.deepEqual(result, reconstructedResult);
}
