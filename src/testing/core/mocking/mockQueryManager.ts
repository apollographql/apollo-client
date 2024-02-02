import { QueryManager } from "../../../core/QueryManager.js";
import type { MockedResponse } from "./mockLink.js";
import { mockSingleLink } from "./mockLink.js";
import { InMemoryCache } from "../../../cache/index.js";

// Helper method for the tests that construct a query manager out of a
// a list of mocked responses for a mocked network interface.
export default (...mockedResponses: MockedResponse[]) => {
  return new QueryManager({
    link: mockSingleLink(...mockedResponses),
    cache: new InMemoryCache({ addTypename: false }),
  });
};
