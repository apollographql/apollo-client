import { Request } from './networkInterface';

export interface MiddlewareRequest {
  request: Request;
  options: RequestInit;
}

export interface MiddlewareInterface {
  applyMiddleware(request: MiddlewareRequest, next: Function);
}

export class AuthTokenHeaderMiddleware implements MiddlewareInterface {
  private _token = null;
  private _header = 'Authorization';

  public setToken = (token: string) => {
    this._token = token;
  };

  public setHeader = (header: string) => {
    this._header = header;
  };

  public applyMiddleware = (request: MiddlewareRequest, next: Function) => {
    if (!this._token) {
      return;
    }

    if (!request.options.headers) {
      request.options.headers = new Headers();
    }

    request.options.headers[this._header] = this._token;
  };

}
