import { MockedResponse } from './mockLinks';

import mockQueryManager from './mockQueryManager';

import { ObservableQuery } from '../../src/core/ObservableQuery'; // tslint:disable-line

export default (...mockedResponses: MockedResponse[]): ObservableQuery<any> => {
  const queryManager = mockQueryManager(...mockedResponses);
  const firstRequest = mockedResponses[0].request;
  return queryManager.watchQuery({
    query: firstRequest.query!,
    variables: firstRequest.variables,
    notifyOnNetworkStatusChange:
      firstRequest.notifyOnNetworkStatusChange || false, // XXX might not always be the right option. Set for legacy reasons.
  });
};
