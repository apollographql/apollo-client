import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { DocumentNode } from "graphql";
import type * as ReactTypes from "react";

import type {
  ApolloClient,
  DefaultContext,
  ErrorLike,
  ErrorPolicy,
  FetchPolicy,
  OperationVariables,
} from "@apollo/client/core";
import type { MaybeMasked } from "@apollo/client/masking";
import type { OnlyRequiredProperties } from "@apollo/client/utilities";

/* Common types */

export type { DefaultContext as Context } from "../../core/index.js";

/* Subscription types */

export interface OnDataOptions<TData = unknown> {
  client: ApolloClient;
  data: SubscriptionResult<TData>;
}

export interface OnSubscriptionDataOptions<TData = unknown> {
  client: ApolloClient;
  subscriptionData: SubscriptionResult<TData>;
}

export interface BaseSubscriptionOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#variables:member} */
  variables?: TVariables;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: FetchPolicy;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#shouldResubscribe:member} */
  shouldResubscribe?:
    | boolean
    | ((options: BaseSubscriptionOptions<TData, TVariables>) => boolean);
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#client:member} */
  client?: ApolloClient;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#skip:member} */
  skip?: boolean;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#extensions:member} */
  extensions?: Record<string, any>;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onComplete:member} */
  onComplete?: () => void;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onData:member} */
  onData?: (options: OnDataOptions<TData>) => any;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onSubscriptionData:member} */
  onSubscriptionData?: (options: OnSubscriptionDataOptions<TData>) => any;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onError:member} */
  onError?: (error: ErrorLike) => void;
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onSubscriptionComplete:member} */
  onSubscriptionComplete?: () => void;
  /**
   * {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#ignoreResults:member}
   * @defaultValue `false`
   */
  ignoreResults?: boolean;
}

export interface SubscriptionResult<
  TData = unknown,
  TVariables = OperationVariables,
> {
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#loading:member} */
  loading: boolean;
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#data:member} */
  data?: MaybeMasked<TData>;
  /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#error:member} */
  error?: ErrorLike;
  // This was added by the legacy useSubscription type, and is tested in unit
  // tests, but probably shouldn’t be added to the result.
  /**
   * @internal
   */
  variables?: TVariables;
}

export interface SubscriptionHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {}

/**
 * @deprecated This type is not used anymore. It will be removed in the next major version of Apollo Client
 */
export interface SubscriptionDataOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?:
    | null
    | ((result: SubscriptionResult<TData>) => ReactTypes.ReactNode);
}

export type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: Record<string, never>;
    }
  : Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };

export type { NoInfer } from "../../utilities/index.js";
