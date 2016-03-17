import { assert } from 'chai';

import { normalizeResult } from '../src';

// Uncomment the below to generate a new schema JSON
// describe("graphql", () => {
//   it("can introspect star wars", async () => {
//     const result = await introspectStarwars();
//
//     fs.writeFileSync(path.join(__dirname, "starwars.json"),
//       JSON.stringify(result, null, 2));
//
//     assert.ok(result.data);
//     assert.ok(result.data.__schema);
//   });
// });

describe('normalization', async () => {
  it('properly normalizes a trivial item', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5
    };

    assert.deepEqual(normalizeResult(result), {
      [result.id]: result
    });
  });
});
