import gql from 'graphql-tag';

import ApolloClient from '../..';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink, Observable } from 'apollo-link';

describe('Basic functionality', () => {
  it('should not break subscriptions', done => {
    const query = gql`
      subscription {
        field
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({ data: { field: 1 } }, { data: { field: 2 } }),
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    let counter = 0;
    expect.assertions(2);
    return client.subscribe({ query }).forEach(item => {
      expect(item).toMatchObject({ data: { field: ++counter } });
      if (counter === 2) {
        done();
      }
    });
  });

  it('should be able to mix @client fields with subscription results', done => {
    const query = gql`
      subscription {
        field
        count @client
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({ data: { field: 1 } }, { data: { field: 2 } }),
    );

    let subCounter = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Subscription: {
          count: () => {
            subCounter += 1;
            return subCounter;
          }
        },
      },
    });

    expect.assertions(2);
    const obs = client.subscribe({ query });
    let resultCounter = 1;
    obs.subscribe({
      next(result) {
        try {
          expect(result).toMatchObject({
            data: {
              field: resultCounter,
              count: resultCounter,
            },
          });
        } catch (error) {
          done.fail(error);
        }
        resultCounter += 1;
      },
      complete() {
        done();
      }
    });
  });
});
