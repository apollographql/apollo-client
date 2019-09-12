import { MockedResponse } from './mockLinks';

import mockQueryManager from './mockQueryManager';

import { ObservableQuery } from '../core/ObservableQuery';

export default (...mockedResponses: MockedResponse[]): ObservableQuery<any> => {
  const queryManager = mockQueryManager(...mockedResponses);
  const firstRequest = mockedResponses[0].request;
  return queryManager.watchQuery({
    query: firstRequest.query!,
    variables: firstRequest.variables,
    notifyOnNetworkStatusChange: false // XXX might not always be the right option. Set for legacy reasons.
  });
};
