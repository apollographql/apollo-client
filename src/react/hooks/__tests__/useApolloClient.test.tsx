import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { InvariantError } from 'ts-invariant';

import { ApolloLink } from '../../../link/core/ApolloLink';
import { ApolloProvider } from '../../context/ApolloProvider';
import { ApolloClient } from '../../../ApolloClient';
import { InMemoryCache } from '../../../cache/inmemory/inMemoryCache';
import { useApolloClient } from '../useApolloClient';
import { resetApolloContext } from '../../context/ApolloContext';

describe('useApolloClient Hook', () => {
  afterEach(() => {
    cleanup();
    resetApolloContext();
  });

  it('should return a client instance from the context if available', () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty()
    });

    function App() {
      expect(useApolloClient()).toEqual(client);
      return null;
    }

    render(
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    );
  });

  it("should error if a client instance can't be found in the context", () => {
    function App() {
      expect(() => useApolloClient()).toThrow(InvariantError);
      return null;
    }

    render(<App />);
  });
});
