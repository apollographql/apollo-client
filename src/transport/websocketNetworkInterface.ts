import isString = require('lodash.isstring');
import assign = require('lodash.assign');
import { Request, RequestAndOptions, ResponseAndOptions, ReactiveNetworkInterface } from './networkInterface';
import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';
import { Observer, Observable } from 'rxjs';
import * as WebSocket from 'ws';
import 'rxjs-diff-operator';

import {
  GraphQLResult,
} from 'graphql';

interface CustomWebSocket extends WebSocket {
    incoming$?: Observable<any>;
}

export class WebsocketNetworkInterface implements ReactiveNetworkInterface {
  public _uri: string;
  public _opts: RequestInit;
  public _middlewares: MiddlewareInterface[];
  public _afterwares: AfterwareInterface[];
  private nextReqId: number = 0;
  private connection$: Observable<CustomWebSocket>;

  constructor(uri: string, opts: RequestInit = {}) {
    if (!uri) {
      throw new Error('A remote enpdoint is required for a network layer');
    }

    if (!isString(uri)) {
      throw new Error('Remote endpoint must be a string');
    }

    this._uri = uri;
    this._opts = assign({}, opts);
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
  }: RequestAndOptions): Observable<GraphQLResult> {
    return this.connection$.retry(3).switchMap((ws) => {
        return new Observable<GraphQLResult>((observer: Observer<GraphQLResult>) => {
            let reqId: number = this.nextReqId ++;
            ws.send(JSON.stringify(assign({}, request, {
                id: reqId,
            })));

            let dataSub = ws.incoming$
            .filter((v) => v.id === reqId)
            .fromDiff()
            .subscribe(observer);

            return () => {
                if ( ws.readyState === WebSocket.OPEN ) {
                    ws.send(JSON.stringify({'id': reqId, 'operationName': 'cancel'}));
                }

                dataSub.unsubscribe();
            };
        });
    });
  };

  public query(request: Request): Observable<GraphQLResult> {
    const options = assign({}, this._opts);

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
      .map((payload: GraphQLResult) => {
        if (!payload.hasOwnProperty('data') && !payload.hasOwnProperty('errors')) {
          throw new Error(
            `Server response was missing for query '${request.debugName}'.`
          );
        } else {
          return payload as GraphQLResult;
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
      this.connection$ = new Observable<CustomWebSocket>((observer: Observer<WebSocket>) => {
          let ws: CustomWebSocket = new WebSocket(this._uri);
          ws.incoming$ = new Observable<any>((msgObserver: Observer<any>) => {
              let onMsg = (msg: any) => {
                  msgObserver.next(JSON.parse(msg));
              };
              ws.on('message', onMsg);

              let statusSub = this.connection$.subscribe(undefined,
              msgObserver.error.bind(msgObserver),
              msgObserver.complete.bind(msgObserver));

              return () => {
                  ws.removeListener('message', onMsg);
                  statusSub.unsubscribe();
              };
          }).share();

          ws.on('open', () => {
              observer.next(ws);
          });

          ws.on('error', (e) => {
              observer.error(e);
          });

          ws.on('close', () => {
              observer.complete();
          });

          return () => {
              ws.close();
          };
      }).publishReplay(1).refCount();
  }
}
