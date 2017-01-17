export default class HttpNetworkError extends Error {
  public readonly response: IResponse;
  public readonly request: any;
  public readonly message: string;

  constructor({
    response,
    request = {},
    message = 'A network error has ocurred',
  }: {
    response: IResponse,
    request?: any,
    message?: string,
  }) {
    super(message);

    this.response = response;
    this.request = request;
  }
}
