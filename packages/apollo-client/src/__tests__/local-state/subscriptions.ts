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
      Observable.of({ data: { field: 0 } }, { data: { field: 1 } }),
    );

    let counter = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Subscription: {
          count: () => counter,
        },
      },
    });

    return client.subscribe({ query }).forEach(item => {
      expect(item).toMatchObject({
        data: {
          field: counter,
          count: counter,
        },
      });
      if (counter === 1) {
        done();
      }
      counter += 1;
    });
  });
});
