// import { createStore as createReduxStore } from 'redux';
//
// import {
//   RECEIVE_RESULT,
// } from './actionTypes';
//
// export function createStore() {
//   return {
//     reduxStore: createReduxStore(graphQLReducer),
//   };
// }
//
// const initialState = {};
// export function graphQLReducer(previousState = initialState, action) {
//   switch (action.type) {
//     case RECEIVE_RESULT:
//       return saveResultToCache(state, action.result);
//     default:
//       return state;
//   }
// }
//
// function saveResultToCache(previousState, result) {
//   const normalizedResult = normalizeResult(result);
// }
