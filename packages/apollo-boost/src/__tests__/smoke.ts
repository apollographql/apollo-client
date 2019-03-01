import ApolloClient, { gql, HttpLink, InMemoryCache } from '../';

global.fetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({}) }),
);
it('should have the required exports', () => {
  expect(ApolloClient).toBeDefined();
  expect(gql).toBeDefined();
  expect(HttpLink).toBeDefined();
  expect(InMemoryCache).toBeDefined();
});

it('should make a client with defaults', () => {
  const client = new ApolloClient();
  expect(client.link).toBeDefined();
  expect(client.store.cache).toBeDefined();
});
