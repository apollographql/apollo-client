import { Request, RequestAndOptions, ResponseAndOptions, SubscriptionNetworkInterface } from './networkInterface';
import { AfterwareInterface } from './afterware';

import { Observer, Observable, Subscription } from '../util/Observable';
import { observableShare } from '../util/ObservableShare';

import {
  ExecutionResult,
} from 'graphql';

export class WSMessageTypes {
  public static RGQL_MSG_ERROR        = 'error';
  public static RGQL_MSG_COMPLETE     = 'complete';
  public static RGQL_MSG_DATA         = 'data';
  public static RGQL_MSG_START        = 'start';
  public static RGQL_MSG_STOP         = 'stop';
  public static RGQL_MSG_KEEPALIVE    = 'keepalive';
  public static RGQL_MSG_INIT         = 'init';
  public static RGQL_MSG_INIT_SUCCESS = 'init_success';
  public static RGQL_MSG_INIT_FAIL    = 'init_fail';

  /* istanbul ignore next */
  constructor() { throw new Error('Static Class'); }
}

export class WebsocketNetworkInterface implements SubscriptionNetworkInterface {
  public _uri: string;
  public _opts: RequestInit;
  private nextReqId: number = 0;
  private _nextSubId: number = 0;
  private _subscriptions: { [key: number]: Subscription } = {};
  private connection$: Observable<WebSocket>;
  private incoming$: Observable<any>;

  constructor(uri: string, opts: RequestInit = {}) {
    this._uri = uri;
    this._opts = {...opts};
    this._init_connection();
  }

  public fetchFromRemoteEndpoint({
    request,
//    options, # TODO: options in websocket?
  }: RequestAndOptions): Observable<ExecutionResult> {
    return this.connection$.switchMap((ws) => {
        return new Observable<ExecutionResult>((observer: Observer<ExecutionResult>) => {
            let reqId: number = ++this.nextReqId;
            const wsRequest = {type: WSMessageTypes.RGQL_MSG_START, payload: { ...request }, id: reqId };
            ws.send(JSON.stringify(wsRequest));

            let dataSub = this.incoming$
            .filter((v) => (v.id === reqId))
            .subscribe({
              next: (v) => {
                switch ( v.type ) {
                  case WSMessageTypes.RGQL_MSG_DATA:
                    return observer.next && observer.next(v.payload);
                  case WSMessageTypes.RGQL_MSG_ERROR:
                    return observer.error && observer.error(new Error(v.payload));
                  case WSMessageTypes.RGQL_MSG_COMPLETE:
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
                    ws.send(JSON.stringify({id: reqId, type: WSMessageTypes.RGQL_MSG_STOP}));
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

  public subscribe(request: Request, handler: (error: any, result: any) => void): number {
    if ( !handler || typeof handler !== 'function' ) {
      throw new Error('Handler function was not provided');
    }

    const subId = this._nextSubId ++;
    const subscription = this._query(request).subscribe({
      next: (v) => handler(undefined, v),
      error: (e) => handler(e, undefined),
      complete: () => this.unsubscribe(subId),
    });
    this._subscriptions[subId] = subscription;

    return subId;
  }

  public unsubscribe(id: number): void {
    const indexNum: string = id.toString();
    if ( !this._subscriptions[id] ) {
      return;
    }

    this._subscriptions[id].unsubscribe();
    delete this._subscriptions[id];
  }

  private _query(request: Request): Observable<ExecutionResult> {
    const options = {...this._opts};

    return this.fetchFromRemoteEndpoint({ request, options })
    .map((payload: ExecutionResult) => {
      /* istanbul ignore if */
      if (!payload.hasOwnProperty('data') && !payload.hasOwnProperty('errors')) {
        throw new Error(
          `Server response was missing for query '${request.debugName}'.`,
        );
      } else {
        return payload as ExecutionResult;
      }
    });
  };

  private _init_connection(): void {
    let _connection$ = new Observable<WebSocket>((observer: Observer<WebSocket>) => {
      let ws: WebSocket = new WebSocket(this._uri);

      ws.onopen = () => {
        observer.next && observer.next(ws);
      };

      ws.onerror = () => {
        observer.error && observer.error(new Error('Websocket Error'));
      };

      ws.onclose = (ev: CloseEvent) => {
        if ( ev.code !== 1000 /* CLOSE_NORMAL */) {
          observer.error && observer.error(new Error(`Connection Closed with error: ${ev.code}: ${ev.reason}`));
        } else {
          observer.complete && observer.complete();
        }
      };

      return () => {
        ws.close();
      };
    });
    _connection$ = observableShare(_connection$, 1);

    this.incoming$ = observableShare(_connection$.switchMap((ws) => {
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

    this.connection$ = _connection$.switchMap((ws) => {
        return new Observable((observer) => {
          ws.send(JSON.stringify({
            type: WSMessageTypes.RGQL_MSG_INIT,
            payload: this._opts.headers,
          }));

          return this.incoming$.subscribe({
            next: (p) => {
              switch (p.type) {
                case WSMessageTypes.RGQL_MSG_INIT_SUCCESS:
                  observer.next && observer.next(ws);
                  break;
                case WSMessageTypes.RGQL_MSG_INIT_FAIL:
                  observer.error && observer.error(new Error('Connection rejected'));
                  break;
                default:
                  /* noop */
                  return;
              }
            },
            error: (e) => observer.error && observer.error(e),
            complete: () => observer.complete && observer.complete,
          });
        });
    });
    this.connection$ = observableShare(this.connection$, 1);
  }
}
