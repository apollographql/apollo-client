import { assert } from 'chai';

import { normalizeResult } from '../src/normalize';
import { runFragment } from '../src/runFragment';


describe('execute', () => {
  it('properly normalizes a real graphql result', () => {
    const fragment = `
      fragment Name on People {
        id,
        name
      }
    `;

    // This is the query we would run if we were actually running one
    // const query = `
    //   {
    //     people_one(id: "1") {
    //       ...Name
    //     }
    //   }
    //
    //   ${fragment}
    // `;

    const fullResult = {
      data: {
        people_one: {
          id: '1',
          name: 'Luke Skywalker',
        },
      },
    };

    const fragResult = fullResult.data.people_one;

    const store = normalizeResult({
      result: fragResult,
      fragment,
    });

    const reconstructedFragResult = runFragment({
      store,
      fragment,
      rootId: '1',
    });

    assert.deepEqual(fragResult, reconstructedFragResult);
  });
});
