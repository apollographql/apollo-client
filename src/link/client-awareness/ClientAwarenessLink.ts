import { ApolloLink } from "@apollo/client/link";
import { compact } from "@apollo/client/utilities/internal";

export declare namespace ClientAwarenessLink {
  /**
   * Options passed to `ClientAwarenessLink` through [request context](https://apollographql.com/docs/react/api/link/introduction#managing-context). Previous
   * non-terminating links in the link chain also can set these values to
   * customize the behavior of `ClientAwarenessLink` for each operation.
   *
   * > [!NOTE]
   * > Some of these values can also be provided to the `ClientAwarenessLink`
   * > constructor. If a value is provided to both, the value in `context` takes
   * > precedence.
   */
  export interface ContextOptions {
    /** {@inheritDoc @apollo/client/link/client-awareness!ClientAwarenessLink.Options#clientAwareness:member} */
    clientAwareness?: ClientAwarenessLink.ClientAwarenessOptions;
  }

  export interface ClientAwarenessOptions {
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
     * - If set to `"headers"`, `name` and `version` will be sent in the request headers as `apollographql-client-name` and `apollographql-client-version`, respectively.
     * - If set to `false`, `name` and `version` will not be included in outgoing requests.
     *
     * @defaultValue "headers"
     */
    transport?: "headers" | false;
  }
  export interface EnhancedClientAwarenessOptions {
    /**
     * Determines how the the version information of Apollo Client is sent in outgoing requests.
     *
     * - If set to `"extensions"`, library `name` and `version` will be sent in an object in the request extensions as `clientLibrary`.
     * - If set to `false`, library name and version will not be included in outgoing requests.
     *
     * @defaultValue "extensions"
     */
    transport?: "extensions" | false;
  }

  export interface Options {
    /**
     * Configures the "client awareness" feature.
     * This feature allows you to identify distinct applications in Apollo Studio
     * and Apollo Server logs (and other monitoring or analytics tools) by adding
     * information about the your application to outgoing requests.
     */
    clientAwareness?: ClientAwarenessLink.ClientAwarenessOptions;
    /**
     * Configures the "enhanced client awareness" feature.
     * This feature allows you to identify the version of the Apollo Client library
     * used in your application in Apollo Studio (and other monitoring or analytics tools)
     * by adding information about the Apollo Client library to outgoing requests.
     */
    enhancedClientAwareness?: ClientAwarenessLink.EnhancedClientAwarenessOptions;
  }
}

/**
 * `ClientAwarenessLink` provides support for providing client awareness
 * features.
 *
 * @remarks
 *
 * Client awareness adds identifying information about the client to HTTP
 * requests for use with metrics reporting tools, such as [Apollo GraphOS](https://apollographql.com/docs/graphos/platform).
 * It is included in the functionality of [`HttpLink`](https://apollographql.com/docs/react/api/link/apollo-link-http) by default.
 *
 * Client awareness distinguishes between user-provided client awareness
 * (provided by the `clientAwareness` option) and enhanced client awareness
 * (provided by the `enhancedClientAwareness` option). User-provided client
 * awareness enables you to set a customized client name and version for
 * identification in metrics reporting tools. Enhanced client awareness enables
 * the identification of the Apollo Client package name and version.
 *
 * @example
 *
 * ```ts
 * import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
 *
 * const link = new ClientAwarenessLink({
 *   clientAwareness: {
 *     name: "My Client",
 *     version: "1",
 *   },
 *   enhancedClientAwareness: {
 *     transport: "extensions",
 *   },
 * });
 * ```
 */
export class ClientAwarenessLink extends ApolloLink {
  constructor(options: ClientAwarenessLink.Options = {}) {
    super((operation, forward) => {
      const client = operation.client;

      const clientOptions = client["queryManager"].clientOptions;
      const context = operation.getContext();
      {
        const {
          name,
          version,
          transport = "headers",
        } = compact(
          {},
          clientOptions.clientAwareness,
          options.clientAwareness,
          context.clientAwareness
        );

        if (transport === "headers") {
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
      }
      {
        const { transport = "extensions" } = compact(
          {},
          clientOptions.enhancedClientAwareness,
          options.enhancedClientAwareness
        );
        if (transport === "extensions") {
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
      }

      return forward(operation);
    });
  }
}
