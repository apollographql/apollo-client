import * as PropTypes from "prop-types";
import type * as ReactTypes from "react";

import type { OperationVariables } from "../../core/index.js";
import type { QueryComponentOptions } from "./types.js";
import { useQuery } from "../hooks/index.js";
import { invariant } from "../../utilities/globals/index.js";
import { useWarnRemoved } from "../hooks/internal/index.js";

/**
 * @deprecated
 * Official support for React Apollo render prop components ended in March 2020.
 * This library is still included in the `@apollo/client` package,
 * but it no longer receives feature updates or bug fixes.
 */
export function Query<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  props: QueryComponentOptions<TData, TVariables>
): ReactTypes.JSX.Element | null {
  useWarnRemoved("<Query />", () => {
    invariant.warn(
      "[Query]: The `<Query />` component is deprecated and will be removed in Apollo Client 4.0. Please use an available React hook such as `useQuery` instead."
    );
  });
  const { children, query, ...options } = props;
  const result = useQuery(query, options);
  return result ? children(result as any) : null;
}

export interface Query<TData, TVariables extends OperationVariables> {
  propTypes: PropTypes.InferProps<QueryComponentOptions<TData, TVariables>>;
}

Query.propTypes = {
  client: PropTypes.object,
  children: PropTypes.func.isRequired,
  fetchPolicy: PropTypes.string,
  notifyOnNetworkStatusChange: PropTypes.bool,
  onCompleted: PropTypes.func,
  onError: PropTypes.func,
  pollInterval: PropTypes.number,
  query: PropTypes.object.isRequired,
  variables: PropTypes.object,
  ssr: PropTypes.bool,
  partialRefetch: PropTypes.bool,
  returnPartialData: PropTypes.bool,
} as Query<any, any>["propTypes"];
