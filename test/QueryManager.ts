/// <reference path="../typings/main.d.ts" />

import {
  QueryManager,
} from '../src/QueryManager';

import {
  NetworkInterface,
} from '../src/networkInterface';

import {
  Store,
} from 'redux';

import {
  writeSelectionSetToStore,
} from '../src/writeToStore';

import {
  QueryResultAction,
} from '../src/store';

import { assert } from 'chai';

describe('QueryManager', () => {
  it('properly roundtrips through a Redux store', (done) => {
    const networkInterface: NetworkInterface = {
      _uri: '',
      _opts: {},
      query: (requests) => {
        return Promise.resolve(true).then(() => {
          const response = {
            data: {
              allPeople: {
                people: [
                  {
                    name: 'Luke Skywalker',
                  },
                ],
              },
            },
          };

          return [response];
        });
      },
    };

    let callback;

    const store = {
      subscribe: (cb) => {
        callback = cb;
      },
      dispatch: (action: QueryResultAction) => {
        const state = writeSelectionSetToStore(action);
        callback(state);
      },
    };

    const queryManager = new QueryManager({
      networkInterface,
      store: store as Store,
    });

    // Done mocking, now we can get to business!
    const query = `
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const handle = queryManager.watchQuery({
      query,
    });

    handle.onData((result) => {
      assert.deepEqual(result, {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      });

      done();
    });
  });
});
