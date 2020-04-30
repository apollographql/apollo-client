import { WatchQueryOptions } from './watchQueryOptions';
import { NetworkStatus } from './networkStatus';
import { ApolloQueryResult } from './types';
import { Concast } from '../utilities/observables/observables';
import { Observer } from '../utilities/observables/Observable';
import { invariant } from 'ts-invariant';

export class Reobserver<TData, TVars> {
  constructor(
    private observer: Observer<ApolloQueryResult<TData>>,
    private options: WatchQueryOptions<TVars>,
    private fetch: (
      options: WatchQueryOptions<TVars>,
      newNetworkStatus?: NetworkStatus,
    ) => Concast<ApolloQueryResult<TData>>,
    private shouldFetch: (() => boolean) | false,
  ) {}

  private concast?: Concast<ApolloQueryResult<TData>>;

  public reobserve(
    newOptions?: Partial<WatchQueryOptions<TVars>>,
    newNetworkStatus?: NetworkStatus,
  ): Promise<ApolloQueryResult<TData>> {
    if (newOptions) {
      this.updateOptions(newOptions);
    } else {
      // When we call this.updatePolling(newOptions) in the branch above,
      // it takes care of calling this.updatePolling(). In this branch, we
      // still need to update polling, even if there were no newOptions.
      this.updatePolling();
    }

    const concast = this.fetch(this.options, newNetworkStatus);

    if (this.concast) {
      // We use the {add,remove}Observer methods directly to avoid
      // wrapping observer with an unnecessary SubscriptionObserver
      // object, in part so that we can remove it here without triggering
      // any unsubscriptions, because we just want to ignore the old
      // observable, not prematurely shut it down, since other consumers
      // may be awaiting this.concast.promise.
      this.concast.removeObserver(this.observer, true);
    }

    concast.addObserver(this.observer);

    return (this.concast = concast).promise;
  }

  public updateOptions(newOptions: Partial<WatchQueryOptions<TVars>>) {
    Object.keys(newOptions).forEach(key => {
      const value = (newOptions as any)[key];
      if (value !== void 0) {
        (this.options as any)[key] = value;
      }
    });

    this.updatePolling();

    return this;
  }

  public stop() {
    if (this.concast) {
      this.concast.removeObserver(this.observer);
      delete this.concast;
    }

    if (this.pollingInfo) {
      clearTimeout(this.pollingInfo.timeout);
      this.options.pollInterval = 0;
      this.updatePolling();
    }
  }

  private pollingInfo?: {
    interval: number;
    timeout: NodeJS.Timeout;
  };

  // Turns polling on or off based on this.options.pollInterval.
  private updatePolling() {
    const {
      pollingInfo,
      options: {
        pollInterval,
      },
    } = this;

    if (!pollInterval) {
      if (pollingInfo) {
        clearTimeout(pollingInfo.timeout);
        delete this.pollingInfo;
      }
      return;
    }

    if (pollingInfo &&
        pollingInfo.interval === pollInterval) {
      return;
    }

    invariant(
      pollInterval,
      'Attempted to start a polling query without a polling interval.',
    );

    // Go no further if polling is disabled.
    if (this.shouldFetch === false) {
      return;
    }

    const info = pollingInfo || (
      this.pollingInfo = {} as Reobserver<TData, TVars>["pollingInfo"]
    )!;

    info.interval = pollInterval;

    const maybeFetch = () => {
      if (this.pollingInfo) {
        if (this.shouldFetch && this.shouldFetch()) {
          this.reobserve({
            fetchPolicy: "network-only",
          }, NetworkStatus.poll).then(poll, poll);
        } else {
          poll();
        }
      };
    };

    const poll = () => {
      const info = this.pollingInfo;
      if (info) {
        clearTimeout(info.timeout);
        info.timeout = setTimeout(maybeFetch, info.interval);
      }
    };

    poll();
  }
}
