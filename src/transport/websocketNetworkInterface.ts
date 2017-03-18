import { WebSocket } from './websocket';

import { Request, RequestAndOptions, ResponseAndOptions, SubscriptionNetworkInterface } from './networkInterface';
import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';

import { Observer, Observable } from '../util/Observable';
import { observableShare } from '../util/ObservableShare';
// import { Observer, Observable } from 'rxjs';

import {
  ExecutionResult,
} from 'graphql';

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

  public applyMiddlewares({
    request,
    options,
  }: RequestAndOptions): Observable<RequestAndOptions> {
    return new Observable<RequestAndOptions>((observer: Observer<RequestAndOptions>) => {
      const queue = (funcs: MiddlewareInterface[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            try {
                f && f.applyMiddleware.apply(scope, [{ request, options }, next]);
            } catch (e) {
                observer.error && observer.error(e);
            }
          } else {
            observer.next && observer.next({
              request,
              options,
            });
            observer.complete && observer.complete();
          }
        };
        next();
      };

      // iterate through middlewares using next callback
      queue([...this._middlewares], this);

      return () => { /* noop */ };
    });
  }

  public applyAfterwares({
    response,
    options,
  }: ResponseAndOptions): Observable<ResponseAndOptions> {
    return new Observable<ResponseAndOptions>((observer: Observer<ResponseAndOptions>) => {
      const queue = (funcs: any[], scope: any) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            try {
                f.applyAfterware.apply(scope, [{ response, options }, next]);
            } catch (e) {
                observer.error && observer.error(e);
            }
          } else {
            observer.next && observer.next({
              response,
              options,
            });
            observer.complete && observer.complete();
          }
        };
        next();
      };

      // iterate through afterwares using next callback
      queue([...this._afterwares], this);

      return () => { /* noop */ };
    });
  }

  public fetchFromRemoteEndpoint({
    request,
//    options, # TODO: options in websocket?
  }: RequestAndOptions): Observable<ExecutionResult> {
    return this.connection$.switchMap((ws) => {
        return new Observable<ExecutionResult>((observer: Observer<ExecutionResult>) => {
            let reqId: number = this.nextReqId ++;
            ws.send(JSON.stringify({...request, id: reqId }));

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

    return this.applyMiddlewares({
      request,
      options,
    }).switchMap(this.fetchFromRemoteEndpoint.bind(this))
      .switchMap(result => {
        return this.applyAfterwares({
          response: result as Response,
          options,
        }).map(({response}) => response);
      })
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

  public use(middlewares: MiddlewareInterface[]) {
    middlewares.forEach((middleware) => {
      if (typeof middleware.applyMiddleware === 'function') {
        this._middlewares.push(middleware);
      } else {
        throw new Error('Middleware must implement the applyMiddleware function');
      }
    });

    return this;
  }

  public useAfter(afterwares: AfterwareInterface[]) {
    afterwares.forEach(afterware => {
      if (typeof afterware.applyAfterware === 'function') {
        this._afterwares.push(afterware);
      } else {
        throw new Error('Afterware must implement the applyAfterware function');
      }
    });

    return this;
  }

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
          observer.next && observer.next(JSON.parse(msg));
        };

        return () => {
          ws.onmessage = originalOnmessage;
        };
      });
    }));
  }
}
