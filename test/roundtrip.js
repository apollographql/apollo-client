import { assert } from 'chai';

import { writeQueryToStore } from '../src/writeToStore';
import { readQueryFromStore } from '../src/readFromStore';

describe('roundtrip', () => {
  it('properly normalizes a real graphql result', () => {
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
