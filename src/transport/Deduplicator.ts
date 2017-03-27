import {
  NetworkInterface,
  Request,
} from '../transport/networkInterface';

import {
  print,
} from 'graphql/language/printer';

export class Deduplicator {

  private inFlightRequestPromises: { [key: string]: Promise<any>};
  private networkInterface: NetworkInterface;

  constructor(networkInterface: NetworkInterface) {
    this.networkInterface = networkInterface;
    this.inFlightRequestPromises = {};
  }

  public query(request: Request, deduplicate = true) {

    // sometimes we might not want to deduplicate a request, for example when we want to force fetch it.
    if (!deduplicate) {
      return this.networkInterface.query(request);
    }

    const key = this.getKey(request);
    if (!this.inFlightRequestPromises[key]) {
      this.inFlightRequestPromises[key] = this.networkInterface.query(request);
    }
    return this.inFlightRequestPromises[key]
    .then( res => {
      delete this.inFlightRequestPromises[key];
      return res;
    })
    .catch( err => {
        delete this.inFlightRequestPromises[key];
        throw err;
    });
  }

  private getKey(request: Request) {
    // XXX we're assuming here that variables will be serialized in the same order.
    // that might not always be true
    return `${print(request.query)}|${JSON.stringify(request.variables)}|${request.operationName}`;
  }
}
