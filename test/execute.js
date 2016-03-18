import { assert } from 'chai';

import { writeQueryResult } from '../src/normalize';
import { runQuery } from '../src/runFragment';

describe('execute', () => {
  it('properly normalizes a real graphql result', () => {
    const query = `
      {
        people_one(id: "1") {
          name
        }
      }
    `;

    const fullResult = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryResult({
      result: fullResult,
      query,
    });

    const reconstructedResult = runQuery({
      store,
      query,
    });

    assert.deepEqual(fullResult, reconstructedResult);
  });
});
