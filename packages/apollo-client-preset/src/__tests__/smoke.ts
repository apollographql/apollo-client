import ApolloClient, { gql, HttpLink, InMemoryCache } from '../';

it('should have the required exports', () => {
  expect(ApolloClient).toBeDefined();
  expect(gql).toBeDefined();
  expect(HttpLink).toBeDefined();
  expect(InMemoryCache).toBeDefined();
});
