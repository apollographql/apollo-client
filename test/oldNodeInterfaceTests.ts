// From diffQueriesAgainstStore
//   it('when the store is missing one field and knows about IDs', () => {
//     const firstQuery = gql`
//       {
//         people_one(id: "1") {
//           __typename
//           id
//           name
//         }
//       }
//     `;

//     const result = {
//       people_one: {
//         __typename: 'Person',
//         id: 'lukeId',
//         name: 'Luke Skywalker',
//       },
//     };

//     const store = writeQueryToStore({
//       result,
//       query: firstQuery,
//       dataIdFromObject: getIdField,
//     });

//     const secondQuery = gql`
//       {
//         people_one(id: "1") {
//           name,
//           age
//         }
//       }
//     `;

//     assert.deepEqual(stripLoc(diffQueryAgainstStore({
//       store,
//       query: secondQuery,
//       dataIdFromObject: getIdField,
//     }).missingSelectionSets), [
//       {
//         id: 'lukeId',
//         typeName: 'Person',
//         selectionSet: {
//           kind: 'SelectionSet',
//           selections: [
//             {
//               'kind': 'Field',
//               'alias': null,
//               'arguments': [],
//               'directives': [],
//               'name': {
//                 'kind': 'Name',
//                 'value': 'age',
//               },
//               'selectionSet': null,
//             },
//           ],
//         },
//       },
//     ]);
//   });

//   it('when the store is missing one field and knows about IDs', () => {
//     const firstQuery = gql`
//       {
//         people_one(id: "1") {
//           __typename,
//           id,
//           name
//         }
//       }
//     `;

//     const result = {
//       people_one: {
//         __typename: 'Person',
//         id: 'lukeId',
//         name: 'Luke Skywalker',
//       },
//     };

//     const store = writeQueryToStore({
//       result,
//       query: firstQuery,
//       dataIdFromObject: getIdField,
//     });

//     const secondQuery = gql`
//       {
//         people_one(id: "1") {
//           name,
//           age
//         }
//       }
//     `;

//     const { missingSelectionSets } = diffQueryAgainstStore({
//       store,
//       query: secondQuery,
//       dataIdFromObject: getIdField,
//     });

//     assert.equal(printQueryForMissingData({
//       missingSelectionSets,
//     }), `{
//   __node_0: node(id: "lukeId") {
//     id
//     ... on Person {
//       age
//     }
//   }
// }
// `);
//   });

//  it('when the store is missing multiple nodes', () => {
//     const firstQuery = gql`
//       {
//         people_one(id: "1") {
//           __typename,
//           id,
//           name
//         }
//       }
//     `;

//     const result = {
//       people_one: {
//         __typename: 'Person',
//         id: 'lukeId',
//         name: 'Luke Skywalker',
//       },
//     };

//     const store = writeQueryToStore({
//       result,
//       query: firstQuery,
//       dataIdFromObject: getIdField,
//     });

//     const secondQuery = gql`
//       {
//         people_one(id: "1") {
//           name,
//           age
//         }
//         people_one(id: "4") {
//           name,
//           age
//         }
//       }
//     `;

//     const { missingSelectionSets } = diffQueryAgainstStore({
//       store,
//       query: secondQuery,
//       dataIdFromObject: getIdField,
//     });

//     assert.equal(printQueryForMissingData({
//       missingSelectionSets,
//     }), `{
//   __node_0: node(id: "lukeId") {
//     id
//     ... on Person {
//       age
//     }
//   }
//   people_one(id: "4") {
//     name
//     age
//   }
// }
// `);
//   });

// From query manager
// it('diffs queries', (done) => {
//   testDiffing([
//     {
//       query: gql`
//         {
//           people_one(id: "1") {
//             __typename,
//             id,
//             name
//           }
//         }
//       `,
//       diffedQuery: gql`
//         {
//           people_one(id: "1") {
//             __typename,
//             id,
//             name
//           }
//         }
//       `,
//       diffedQueryResponse: {
//         people_one: {
//           __typename: 'Person',
//           id: 'lukeId',
//           name: 'Luke Skywalker',
//         },
//       },
//       fullResponse: {
//         people_one: {
//           __typename: 'Person',
//           id: 'lukeId',
//           name: 'Luke Skywalker',
//         },
//       },
//       variables: {},
//     },
//     {
//       query: gql`
//         {
//           people_one(id: "1") {
//             name
//             age
//           }
//         }
//       `,
//       diffedQuery: gql`
//         {
//           __node_0: node(id: "lukeId") {
//             id
//             ... on Person {
//               age
//             }
//           }
//         }
//       `,
//       diffedQueryResponse: {
//         __node_0: {
//           id: 'lukeId',
//           age: 45,
//         },
//       },
//       fullResponse: {
//         people_one: {
//           name: 'Luke Skywalker',
//           age: 45,
//         },
//       },
//       variables: {},
//     },
//     {
//       query: gql`
//         {
//           people_one(id: "1") {
//             id
//             name
//             age
//           }
//         }
//       `,
//       diffedQuery: null,
//       diffedQueryResponse: null,
//       fullResponse: {
//         people_one: {
//           id: 'lukeId',
//           name: 'Luke Skywalker',
//           age: 45,
//         },
//       },
//       variables: {},
//     },
//   ], {
//     dataIdFromObject: getIdField,
//   }, done);
// });
