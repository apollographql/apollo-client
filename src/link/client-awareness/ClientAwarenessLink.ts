import { ApolloLink } from "@apollo/client/link";
import { compact } from "@apollo/client/utilities/internal";

export declare namespace ClientAwarenessLink {
  export interface Options {
    /**
     * A custom name (e.g., `iOS`) that identifies this particular client among your set of clients. Apollo Server and Apollo Studio use this property as part of the [client awareness](https://www.apollographql.com/docs/apollo-server/monitoring/metrics#identifying-distinct-clients) feature.
     *
     * This option can either be set as part of the Apollo Client constructor call or when manually constructing a `HttpLink`, `BatchHttpLink` or `ClientAwarenessLink`.
     */
    name?: string;
    /**
     * A custom version that identifies the current version of this particular client (e.g., `1.2`). Apollo Server and Apollo Studio use this property as part of the [client awareness](https://www.apollographql.com/docs/apollo-server/monitoring/metrics#identifying-distinct-clients) feature.
     *
     * This is **not** the version of Apollo Client that you are using, but rather any version string that helps you differentiate between versions of your client.
     *
     * This option can either be set as part of the Apollo Client constructor call or when manually constructing a `HttpLink`, `BatchHttpLink` or `ClientAwarenessLink`.
     */
    version?: string;
    /**
     * Determines how `name` and `version` are sent in outgoing requests.
     *
     * If `name` and `version` are not provided, this option will be ignored.
     * (These options can either be set as part of the Apollo Client constructor call or when manually constructing a `HttpLink`, `BatchHttpLink` or `ClientAwarenessLink`.)
     *
     * * If set to `"headers"`, `name` and `version` will be sent in the request headers as `apollographql-client-name` and `apollographql-client-version`, respectively.
     * * If set to `false`, `name` and `version` will not be included in outgoing requests.
     *
     * @defaultValue "headers"
     */
    clientAwareness?: "headers" | false;
    /**
     * Determines how the the version information of Apollo Client is sent in outgoing requests.
     *
     * * If set to `"extensions"`, library `name` and `version` will be sent in an object in the request extensions as `clientLibrary`.
     * * If set to `false`, library name and version will not be included in outgoing requests.
     *
     * @defaultValue "extensions"
     */
    enhancedClientAwareness?: "extensions" | false;
  }
}

export class ClientAwarenessLink extends ApolloLink {
  constructor(constructorOptions?: ClientAwarenessLink.Options) {
    super((operation, forward) => {
      const client = operation.client;

      const clientOptions = client["queryManager"].clientOptions;
      const context = operation.getContext();

      const {
        name,
        version,
        clientAwareness = "headers",
        enhancedClientAwareness = "extensions",
      } = {
        ...clientOptions,
        ...context.clientAwareness,
        ...constructorOptions,
      };
      if (clientAwareness === "headers") {
        operation.setContext(({ headers, extensions }) => {
          return {
            headers: compact(
              // setting these first so that they can be overridden by user-provided headers
              {
                "apollographql-client-name": name,
                "apollographql-client-version": version,
              },
              headers
            ),
          };
        });
      }

      if (enhancedClientAwareness === "extensions") {
        operation.extensions = compact(
          // setting these first so that it can be overridden by user-provided extensions
          {
            clientLibrary: {
              name: "@apollo/client",
              version: client.version,
            },
          },
          operation.extensions
        );
      }

      return forward(operation);
    });
  }
}
