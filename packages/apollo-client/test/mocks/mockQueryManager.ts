import { QueryManager } from '../../src/core/QueryManager';

import { mockSingleLink, MockedResponse } from './mockLinks';

// Helper method for the tests that construct a query manager out of a
// a list of mocked responses for a mocked network interface.
export default (...mockedResponses: MockedResponse[]) => {
  return new QueryManager({
    link: mockSingleLink(...mockedResponses),
    addTypename: false,
  });
};
