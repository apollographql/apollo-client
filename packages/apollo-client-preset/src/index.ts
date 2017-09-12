export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-core-inmemory';
import InMemoryCache from 'apollo-cache-core-inmemory';

import gql from 'graphql-tag';
import ApolloClient from 'apollo-client';

export { gql, InMemoryCache };

export default ApolloClient;
