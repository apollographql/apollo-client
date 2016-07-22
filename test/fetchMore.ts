import gql from 'graphql-tag';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import {
  QueryManager,
} from '../src/QueryManager';
import {
  createApolloStore,
} from '../src/store';
import {
  assert,
} from 'chai';


describe('fetchMore-kind queries on QueryManager', () => {
  it('properly fetches more data with just a targeted directive', (done) => {
    const query = gql`
      query people {
        allPeople {
          people @apolloFetchMore(name: "people") {
            name
          }
        }
      }
    `;

    const strippedQuery = gql`
      query people {
        allPeople {
          people {
            name
          }
        }
      }
    `;

    const data1 = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const data2 = {
      allPeople: {
        people: [
          {
            name: 'Jar Jar binks',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface(
      {
        request: { query: strippedQuery },
        result: { data: data1 },
      },
      {
        request: { query: strippedQuery },
        result: { data: data2 },
      }
    );

    const queryManager = new QueryManager({
      networkInterface,
      store: createApolloStore(),
      reduxRootKey: 'apollo',
    });

    const handle = queryManager.watchQuery({
      query,
    });

    let handleCount = 0;
    handle.subscribe({
      next(result) {
        handleCount ++;
        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          handle.fetchMore(['people']);
        } else {
          assert.deepEqual(
            result.data.allPeople.people,
            [].concat(data1.allPeople.people, data2.allPeople.people)
          );
          done();
        }
      },
    });
  });
});
