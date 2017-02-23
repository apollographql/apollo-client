import { Request, RequestAndOptions, ResponseAndOptions, ReactiveNetworkInterface } from './networkInterface';
import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';

// import { Observable } from '../util/Observable';
import { Observer, Observable } from 'rxjs';

import {
  ExecutionResult,
} from 'graphql';

export class WebsocketNetworkInterface implements ReactiveNetworkInterface {
  public _uri: string;
  public _opts: RequestInit;
  public _middlewares: MiddlewareInterface[];
  public _afterwares: AfterwareInterface[];
  private nextReqId: number = 0;
  private connection$: Observable<WebSocket>;
  private incoming$: Observable<any>;

  constructor(uri: string, opts: RequestInit = {}) {
    if (!uri) {
      throw new Error('A remote enpdoint is required for a network layer');
    }

    if (typeof uri === 'string') {
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
                f.applyMiddleware.apply(scope, [{ request, options }, next]);
            } catch (e) {
                observer.error(e);
            }
          } else {
            observer.next({
              request,
              options,
            });
            observer.complete();
          }
        };
        next();
      };

      // iterate through middlewares using next callback
      queue([...this._middlewares], this);
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
                observer.error(e);
            }
          } else {
            observer.next({
              response,
              options,
            });
            observer.complete();
          }
        };
        next();
      };

      // iterate through afterwares using next callback
      queue([...this._afterwares], this);
    });
  }

  public fetchFromRemoteEndpoint({
    request,
//    options, # TODO: options in websocket?
  }: RequestAndOptions): Observable<ExecutionResult> {
    return this.connection$.retry(3).switchMap((ws) => {
        return new Observable<ExecutionResult>((observer: Observer<ExecutionResult>) => {
            let reqId: number = this.nextReqId ++;
            ws.send(JSON.stringify({...request, id: reqId }));

            let dataSub = this.incoming$
            .filter((v) => (v.id === reqId))
            .subscribe({
              next: (v) => {
                switch ( v.type ) {
                  case 'data':
                    return observer.next(v.payload);
                  case 'error':
                    return observer.error(new Error(v.payload));
                  case 'complete':
                    return observer.complete();
                  default:
                    return observer.error('unexpected message arrived.');
                }
              },
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
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

  public query(request: Request): Observable<ExecutionResult> {
    const options = {...this._opts};

    return this.applyMiddlewares({
      request,
      options,
    }).switchMap(this.fetchFromRemoteEndpoint.bind(this))
      .switchMap(result => {
        return this.applyAfterwares({
          // TODO: How to support same interface...? intersting case.
          // response: response as IResponse,
          response: result,
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
  }

  public useAfter(afterwares: AfterwareInterface[]) {
    afterwares.forEach(afterware => {
      if (typeof afterware.applyAfterware === 'function') {
        this._afterwares.push(afterware);
      } else {
        throw new Error('Afterware must implement the applyAfterware function');
      }
    });
  }

  private _init_connection(): void {
      this.connection$ = new Observable<WebSocket>((observer: Observer<WebSocket>) => {
          let ws: WebSocket = new WebSocket(this._uri);

          ws.on('open', () => {
              observer.next(ws);
          });

          ws.on('error', (e: Error) => {
              observer.error(e);
          });

          ws.on('close', () => {
              observer.complete();
          });

          return () => {
              ws.close();
          };
      }).publishReplay(1).refCount();

      this.incoming$ = this.connection$.switchMap((ws) => {
          return new Observable<any>((observer: Observer<any>) => {
              let onMsg = (msg: any) => {
                  observer.next(JSON.parse(msg));
              };
              ws.on('message', onMsg);

              return () => {
                  ws.removeListener('message', onMsg);
              };
          }).share();
      });
  }
}
