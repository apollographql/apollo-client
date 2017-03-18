import { Request, RequestAndOptions, ResponseAndOptions, SubscriptionNetworkInterface } from './networkInterface';
import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';

import { Observer, Observable } from '../util/Observable';
import { observableShare } from '../util/ObservableShare';

import {
  ExecutionResult,
} from 'graphql';

import { WebSocket } from './websocket';

//export class WebsocketNetworkInterface implements SubscriptionNetworkInterface {
import { NetworkInterface } from './networkInterface';
export class WebsocketNetworkInterface implements NetworkInterface {
  public _uri: string;
  public _opts: RequestInit;
  public _middlewares: MiddlewareInterface[];
  public _afterwares: AfterwareInterface[];
  private nextReqId: number = 0;
  private connection$: Observable<WebSocket>;
  private incoming$: Observable<any>;

  constructor(uri: string | undefined, opts: RequestInit = {}) {
    if (!uri) {
      throw new Error('A remote enpdoint is required for a network layer');
    }

    if (typeof uri !== 'string') {
      throw new Error('Remote endpoint must be a string');
    }

    this._uri = uri;
    this._opts = {...opts};
    this._middlewares = [];
    this._afterwares = [];
    this._init_connection();
  }

  public fetchFromRemoteEndpoint({
    request,
//    options, # TODO: options in websocket?
  }: RequestAndOptions): Observable<ExecutionResult> {
    return this.connection$.switchMap((ws) => {
        return new Observable<ExecutionResult>((observer: Observer<ExecutionResult>) => {
            let reqId: number = ++this.nextReqId;
            const wsRequest = {type: 'start', payload: { ...request }, id: reqId };
            ws.send(JSON.stringify(wsRequest));

            let dataSub = this.incoming$
            .filter((v) => (v.id === reqId))
            .subscribe({
              next: (v) => {
                switch ( v.type ) {
                  case 'data':
                    return observer.next && observer.next(v.payload);
                  case 'error':
                    return observer.error && observer.error(new Error(v.payload));
                  case 'complete':
                    return observer.complete && observer.complete();
                  default:
                    return observer.error && observer.error(new Error('unexpected message arrived.'));
                }
              },
              error: observer.error && observer.error.bind(observer),
              complete: observer.complete && observer.complete.bind(observer),
            });

            return () => {
                if ( ws.readyState === WebSocket.OPEN ) {
                    ws.send(JSON.stringify({'id': reqId, 'type': 'stop'}));
                }

                if ( dataSub ) {
                  dataSub.unsubscribe();
                }
            };
        });
    });
  };

  public query(request: Request): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const sub = this._query(request).subscribe({
        next: (v: ExecutionResult) => {
          resolve(v);
          process.nextTick(() => sub.unsubscribe());
        },
        error: (e: Error) => reject(e),
        complete: () => resolve(undefined),
      });
    });
  }

  private _query(request: Request): Observable<ExecutionResult> {
    const options = {...this._opts};

    return this.fetchFromRemoteEndpoint({ request, options })
    .map((payload: ExecutionResult) => {
      if (!payload.hasOwnProperty('data') && !payload.hasOwnProperty('errors')) {
        throw new Error(
          `Server response was missing for query '${request.debugName}'.`
        );
      } else {
        return payload as ExecutionResult;
      }
    });
  };

  private _init_connection(): void {
    this.connection$ = new Observable<WebSocket>((observer: Observer<WebSocket>) => {
      let ws: WebSocket = new WebSocket(this._uri);

      ws.onopen = () => {
        observer.next && observer.next(ws);
      };

      ws.onerror = () => {
        observer.error && observer.error(new Error('Websocket Error'));
      };

      ws.onclose = (ev: CloseEvent) => {
        if ( ev.code !== 0 ) {
          observer.error && observer.error(new Error(`Connection Closed with error: ${ev.code}: ${ev.reason}`));
        } else {
          observer.complete && observer.complete();
        }
      };

      return () => {
        ws.close();
      };
    });
    this.connection$ = observableShare(this.connection$, 1);

    this.incoming$ = observableShare(this.connection$.switchMap((ws) => {
      return new Observable<any>((observer: Observer<any>) => {
        let originalOnmessage = ws.onmessage;
        ws.onmessage = (msg: any) => {
          observer.next && observer.next(msg.data);
        };

        return () => {
          ws.onmessage = originalOnmessage;
        };
      }).map((v) => JSON.parse(v));
    }));
  }
}
