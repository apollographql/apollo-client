import { assert } from 'chai';

import {
  ApolloClient
} from '../src';

import {
  createNetworkInterface,
  NetworkInterface
} from '../src/networkInterface';

describe('client', () => {
  it('does not require any arugments', () => {
    const client = new ApolloClient();
    assert.isDefined(client.apolloStore);
  });

  it('can allow passing in a network interface', () => {
    const networkInterface: NetworkInterface = createNetworkInterface('swapi');
    const client = new ApolloClient({
      networkInterface
    });

    assert.equal(client.networkInterface._uri, networkInterface._uri);
  });

  it('can allow passing in a store', () => {
    const networkInterface: NetworkInterface = createNetworkInterface('swapi');
    const client = new ApolloClient({
      networkInterface
    });

    assert.equal(client.networkInterface._uri, networkInterface._uri);
  });
})