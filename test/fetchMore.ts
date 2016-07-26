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

  it.skip('properly fetches more data with a targeted directive and paginationArgs', (done) => {
    const query = gql`
      query people($cur: ID!) {
        allPeople(after: $cur, limit: 1) {
          people @apolloFetchMore(name: "people") {
            name
          }
        }
      }
    `;

    const strippedQuery = gql`
      query people($cur: ID!) {
        allPeople(after: $cur, limit: 1) {
          people {
            name
          }
        }
      }
    `;

    const paginationArguments = ['before', 'after', 'first', 'last'];

    const data1 = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const variables1 = {
      cur: 'start',
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

    const variables2 = {
      cur: 'after-luke',
    };

    const networkInterface = mockNetworkInterface(
      {
        request: {
          query: strippedQuery,
          variables: variables1,
        },
        result: { data: data1 },
      },
      {
        request: {
          query: strippedQuery,
          variables: variables2,
        },
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
      variables: variables1,
      paginationArguments,
    });

    let handleCount = 0;
    handle.subscribe({
      next(result) {
        handleCount ++;
        if (handleCount === 1) {
          assert.deepEqual(result.data, data1);
          handle.fetchMore(['people'], variables2);
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

  it('just concatenates on the selected directives', (done) => {
    const query = gql`
      query people {
        allPeople {
          people @apolloFetchMore(name: "people") {
            name
          }
        }
        allFilms {
          films @apolloFetchMore(name: "films") {
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
        allFilms {
          films {
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
      allFilms: {
        films: [
          {
            name: 'A New Hope',
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
      allFilms: {
        films: [
          {
            name: 'The Phantom Menace',
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
          assert.deepEqual(
            result.data.allFilms,
            data2.allFilms
          );
          done();
        }
      },
    });
  });

  it('takes the most current results for equal IDs', (done) => {
    const query = gql`
      query people {
        allPeople {
          people @apolloFetchMore(name: "people") {
            id
            name
            height
          }
        }
      }
    `;

    const strippedQuery = gql`
      query people {
        allPeople {
          people {
            id
            name
            height
          }
        }
      }
    `;

    const data1 = {
      allPeople: {
        people: [
          {
            id: 'luke',
            name: 'Luke Skywalker',
            height: 170,
          },
        ],
      },
    };

    const data2 = {
      allPeople: {
        people: [
          {
            id: 'luke',
            name: 'Luke Skywalker',
            height: 172,
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
          assert.deepEqual(result.data, data2);
          done();
        }
      },
    });
  });

  it('properly selects multiple directives for update', (done) => {
    const query = gql`
      query people {
        allPeople {
          people @apolloFetchMore(name: "people") {
            id
            name
            filmConnection {
              films @apolloFetchMore(name: "nestedFilms") {
                id
                title
              }
            }
          }
        }
      }
    `;

    const strippedQuery = gql`
      query people {
        allPeople {
          people {
            id
            name
            filmConnection {
              films {
                id
                title
              }
            }
          }
        }
      }
    `;

    const data1 = {
      allPeople: {
        people: [
          {
            id: 'luke',
            name: 'Luke Skywalker',
            filmConnection: {
              films: [
                { id: 'hope', title: 'A New Hope' },
              ],
            },
          },
        ],
      },
    };

    const data2 = {
      allPeople: {
        people: [
          {
            id: 'luke',
            name: 'Luke Skywalker',
            filmConnection: {
              films: [
                { id: 'empire', title: 'The Empire Strikes Back' },
              ],
            },
          },
          {
            id: 'jarjar',
            name: 'Jar Jar binks',
            filmConnection: {
              films: [
                { id: 'phantom', title: 'The Phantom Menace' },
              ],
            },
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
          handle.fetchMore(['people', 'nestedFilms']);
        } else {
          assert.deepEqual(
            result.data, {
            allPeople: {
              people: [
                {
                  id: 'luke',
                  name: 'Luke Skywalker',
                  filmConnection: {
                    films: [
                      { id: 'hope', title: 'A New Hope' },
                      { id: 'empire', title: 'The Empire Strikes Back' },
                    ],
                  },
                },
                {
                  id: 'jarjar',
                  name: 'Jar Jar binks',
                  filmConnection: {
                    films: [
                      { id: 'phantom', title: 'The Phantom Menace' },
                    ],
                  },
                },
              ],
            },
          });
          done();
        }
      },
    });
  });
});
