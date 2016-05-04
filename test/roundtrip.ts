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
