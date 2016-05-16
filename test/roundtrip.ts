import { assert } from 'chai';

import { writeQueryToStore } from '../src/data/writeToStore';
import { readQueryFromStore } from '../src/data/readFromStore';

import {
  Document,
} from 'graphql';

import gql from '../src/gql';

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
});

function storeRoundtrip(query: Document, result, variables = {}) {
  const store = writeQueryToStore({
    result,
    query,
    variables,
  });

  const reconstructedResult = readQueryFromStore({
    store,
    query,
    variables,
  });

  assert.deepEqual(result, reconstructedResult);
}
