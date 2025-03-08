interface ServerErrorOptions {
  response: Response;
  result: Record<string, any> | string;
}

export class ServerError extends Error {
  response: Response;
  statusCode: number;
  result: Record<string, any> | string;

  constructor(message: string, options: ServerErrorOptions) {
    super(message);
    this.name = "ServerError";
    this.response = options.response;
    this.statusCode = options.response.status;
    this.result = options.result;

    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
