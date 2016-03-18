import { assert } from 'chai';

import { normalizeResult } from '../src/normalize';
import { runFragment } from '../src/runFragment';


// describe('execute', () => {
//   it('properly normalizes a real graphql result', () => {
//     const query = `
//       {
//         people_one(id: "1") {
//           name
//         }
//       }
//     `;
//
//     // This is the query we would run if we were actually running one
//     // const query = `
//     //   people_one(id: "1") {
//     //     name
//     //   }
//     // `;
//
//     const fullResult = {
//       people_one: {
//         id: '1',
//         name: 'Luke Skywalker',
//       },
//     };
//
//     const store = normalizeResult({
//       result: fullResult,
//       query,
//     });
//
//     const reconstructedFragResult = runQuery({
//       store,
//       fragment,
//       rootId: '1',
//     });
//
//     assert.deepEqual(fragResult, reconstructedFragResult);
//   });
// });
