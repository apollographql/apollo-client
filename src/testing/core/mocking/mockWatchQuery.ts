import { MockedResponse } from './mockLink';
import mockQueryManager from './mockQueryManager';
import { ObservableQuery } from '../../../core';

export default (
  reject: (reason: any) => any,
  ...mockedResponses: MockedResponse[]
): ObservableQuery<any> => {
  const queryManager = mockQueryManager(reject, ...mockedResponses);
  const firstRequest = mockedResponses[0].request;
  return queryManager.watchQuery({
    query: firstRequest.query!,
    variables: firstRequest.variables,
    notifyOnNetworkStatusChange: false // XXX might not always be the right option. Set for legacy reasons.
  });
};
