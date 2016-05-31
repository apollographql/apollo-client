import { WatchQueryOptions } from './QueryManager';

import {
  NetworkInterface,
  Request,
} from './networkInterface';

export interface QueryFetchRequest {
  options: WatchQueryOptions;
  queryId: String;
};

// QueryScheduler takes a operates on a queue  of QueryFetchRequests. It polls and checks this queue
// for new fetch requests. If there are multiple requests in the queue at a time, it will batch
// them together into one query. Batching can be toggled with the shouldBatch option.
export class QueryScheduler {
  private networkInterface: NetworkInterface;
  private shouldBatch: Boolean;

  constructor({
    networkInterface,
    shouldBatch
  }: {
    networkInterface: NetworkInterface,
    shouldBatch: Boolean,
  }) {
    this.networkInterface = networkInterface;
    this.shouldBatch = shouldBatch;
  }

}



