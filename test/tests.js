import { assert } from 'chai';
import { normalizeResult } from '../src/normalize';
import _ from 'lodash';

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

describe('normalize', async () => {
  it('properly normalizes a trivial item', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    assert.deepEqual(normalizeResult(result), {
      [result.id]: result
    });
  });

  it('properly normalizes a nested object with an ID', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        id: 'abcde',
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    assert.deepEqual(normalizeResult(result), {
      [result.id]: _.omit(result, 'nestedObj'),
      [result.nestedObj.id]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object without an ID', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    assert.deepEqual(normalizeResult(result), {
      [result.id]: _.omit(result, 'nestedObj'),
      [result.id + '.nestedObj']: result.nestedObj,
    });
  });
});
