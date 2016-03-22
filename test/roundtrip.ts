/// <reference path="../typings/main.d.ts" />

import { assert } from 'chai';

import { writeQueryToStore } from '../src/writeToStore';
import { readQueryFromStore } from '../src/readFromStore';

describe('roundtrip', () => {
  it('real graphql result', () => {
    storeRoundtrip(`
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
    storeRoundtrip(`
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
});

function storeRoundtrip(query, result) {
  const store = writeQueryToStore({
    result,
    query,
  });

  const reconstructedResult = readQueryFromStore({
    store,
    query,
  });

  assert.deepEqual(result, reconstructedResult);
}
