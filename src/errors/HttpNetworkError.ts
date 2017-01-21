export interface Response {
  status: number;
  statusText?: string;
}

export default class HttpNetworkError extends Error {
  public readonly response: Response;
  public readonly request: any;
  public readonly message: string;

  constructor({
    response,
    request = {},
    message,
  }: {
    response: Response,
    request?: any,
    message?: string,
  }) {
    const defaultMessage = `Network request failed with status ${response.status} - "${response.statusText}"`;
    super(message || defaultMessage);

    this.response = response;
    this.request = request;
  }
}
