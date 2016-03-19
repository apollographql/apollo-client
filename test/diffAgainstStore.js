import { assert } from 'chai';

import { diffQueryAgainstStore } from '../src/diffAgainstStore';
import { writeQueryToStore } from '../src/writeToStore';

describe('diffing queries against the store', () => {
  it('returns nothing when the store is enough', () => {
    const query = `
      {
        people_one(id: "1") {
          name
        }
      }
    `;

    const result = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query,
    });

    assert.deepEqual(diffQueryAgainstStore({
      store,
      query,
    }).missingFields, []);
  });
});
