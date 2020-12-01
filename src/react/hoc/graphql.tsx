import { DocumentNode } from 'graphql';

import { parser, DocumentType } from '../parser';
import { withQuery } from './query-hoc';
import { withMutation } from './mutation-hoc';
import { withSubscription } from './subscription-hoc';
import { OperationOption, DataProps, MutateProps } from './types';

export function graphql<
  TProps extends TGraphQLVariables | {} = {},
  TData = {},
  TGraphQLVariables = {},
  TChildProps = Partial<DataProps<TData, TGraphQLVariables>> &
    Partial<MutateProps<TData, TGraphQLVariables>>
>(
  document: DocumentNode,
  operationOptions: OperationOption<
    TProps,
    TData,
    TGraphQLVariables,
    TChildProps
  > = {}
): (
  WrappedComponent: React.ComponentType<TProps & TChildProps>
) => React.ComponentClass<TProps> {
  switch (parser(document).type) {
    case DocumentType.Mutation:
      return withMutation(document, operationOptions);
    case DocumentType.Subscription:
      return withSubscription(document, operationOptions);
    case DocumentType.Query:
    default:
      return withQuery(document, operationOptions);
  }
}
