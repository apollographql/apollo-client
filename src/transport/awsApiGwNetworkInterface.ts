import {
  BaseNetworkInterface,
  RequestAndOptions,
  ResponseAndOptions,
  printRequest,
} from './networkInterface';
import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';
import { ExecutionResult } from 'graphql';
import {
  Request as RequestMyApollo,
  HTTPNetworkInterface,
} from './networkInterface';

export interface AwsApiGwClient {
  isAuthenticated(): Boolean;
  authenticationExpired(): void;
  graphqlPost(param: Object, body: Object, extra: Object): Promise<any>;
}

export class AwsApiGwNetworkInterface extends BaseNetworkInterface {
  public _middlewares: MiddlewareInterface[];
  public _afterwares: AfterwareInterface[];
  private awsApiGatewayClient: AwsApiGwClient;

  constructor(client: AwsApiGwClient) {
    super('http://');
    this.awsApiGatewayClient = client;
  }

  public fetchFromAwsApiGw({
    request,
    options,
  }: RequestAndOptions): Promise<Response> {
    return this.awsApiGatewayClient.graphqlPost({}, printRequest(request), {
      request,
      options,
    });
  }

  public query(request: RequestMyApollo): Promise<ExecutionResult> {
    const options = { ...this._opts };

    if (!this.awsApiGatewayClient.isAuthenticated()) {
      return new Promise((resolve, reject) => {
        reject(new Error('AWS API GW client not ready/authenticated !'));
      });
    } else {
      return this.fetchFromAwsApiGw({ request, options })
        .then((response: any) => {
          const httpResponse = response['data'] as Response;

          if (response.status === 401 || response.status === 403) {
            this.awsApiGatewayClient.authenticationExpired();
          }

          if (response.status >= 300) {
            const httpError = new Error(
              `Network request failed with status ${response.status} - "${response.statusText}"`,
            );
            (httpError as any).response = httpResponse;

            throw httpError;
          }
          return httpResponse;
        })
        .then(payload => {
          if (
            !payload.hasOwnProperty('data') &&
            !payload.hasOwnProperty('errors')
          ) {
            throw new Error(
              `Server response was missing for query '${request.debugName}'.`,
            );
          } else {
            return payload as ExecutionResult;
          }
        });
    }
  }
}
