import React from 'react';
import { render, wait } from '@testing-library/react';
import gql from 'graphql-tag';

import { MockSubscriptionLink } from '../mockSubscriptionLink';
import { ApolloClient } from '../../../../ApolloClient';
import { InMemoryCache as Cache } from '../../../../cache/inmemory/inMemoryCache';
import { ApolloProvider } from '../../../../react/context/ApolloProvider';
import { useSubscription } from '../../../../react/hooks/useSubscription';

describe('mockSubscriptionLink', () => {
  it('should work with multiple subscribers to the same mock websocket', () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    let renderCountA = 0;
    const ComponentA = () => {
      useSubscription(subscription);
      renderCountA += 1;
      return null;
    };

    let renderCountB = 0;
    const ComponentB = () => {
      useSubscription(subscription);
      renderCountB += 1;
      return null;
    };

    const results = ['Audi', 'BMW', 'Mercedes', 'Hyundai'].map(make => ({
      result: { data: { car: { make } } }
    }));

    const Component = () => {
      const [index, setIndex] = React.useState(0);
      React.useEffect(() => {
        if (index >= results.length) return;
        link.simulateResult(results[index]);
        setIndex(index + 1);
      }, [index]);
      return null;
    };

    render(
      <ApolloProvider client={client}>
        <div>
          <Component />
          <ComponentA />
          <ComponentB />
        </div>
      </ApolloProvider>
    );

    return wait(() => {
      expect(renderCountA).toBe(results.length + 1);
      expect(renderCountB).toBe(results.length + 1);
    }, { timeout: 1000 });
  });
});
