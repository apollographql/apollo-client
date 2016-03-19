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

  it('returns something when the store is not enough', () => {
    const firstQuery = `
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
      query: firstQuery,
    });

    const secondQuery = `
      {
        people_one(id: "1") {
          name,
          age
        }
      }
    `;

    assert.deepEqual(diffQueryAgainstStore({
      store,
      query: secondQuery,
    }).missingFields, [
      {
        field: 'age',
        id: 'ROOT_QUERY.people_one({\"id\":\"1\"})',
      },
    ]);
  });
});
