export * from 'apollo-client';
export * from 'apollo-link';
export * from 'apollo-cache-inmemory';
import InMemoryCache from 'apollo-cache-inmemory';

import gql from 'graphql-tag';
import ApolloClient from 'apollo-client';

export { gql, InMemoryCache };

export default ApolloClient;
