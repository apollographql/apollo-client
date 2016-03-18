import { assert } from 'chai';

import { writeQueryResult } from '../src/normalize';
import { runQuery } from '../src/runFragment';

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
  const store = writeQueryResult({
    result,
    query,
  });

  const reconstructedResult = runQuery({
    store,
    query,
  });

  assert.deepEqual(result, reconstructedResult);
}
