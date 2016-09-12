import {
  QueryManager,
} from '../../src/QueryManager';

import mockNetworkInterface, {
  MockedResponse,
} from './mockNetworkInterface';

import {
  createApolloStore,
} from '../../src/store';


// Helper method for the tests that construct a query manager out of a
// a list of mocked responses for a mocked network interface.
export default (...mockedResponses: MockedResponse[]) => {
  return new QueryManager({
    networkInterface: mockNetworkInterface(...mockedResponses),
    store: createApolloStore(),
    reduxRootKey: 'apollo',
  });
};
