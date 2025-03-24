import type {
  ApolloQueryResult,
  FetchMoreQueryOptions,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
  Unmasked,
} from "@apollo/client/core";
import type { OnlyRequiredProperties } from "@apollo/client/utilities";

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

export type RefetchFunction<
  TData,
  TVariables extends OperationVariables,
> = ObservableQuery<TData, TVariables>["refetch"];

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = (
  fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> & {
    updateQuery?: (
      previousQueryResult: Unmasked<TData>,
      options: {
        fetchMoreResult: Unmasked<TData>;
        variables: TVariables;
      }
    ) => Unmasked<TData>;
  }
) => Promise<ApolloQueryResult<MaybeMasked<TData>>>;
