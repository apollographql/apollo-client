import {
  GraphQLRequest,
  NextLink,
  Operation,
  RequestHandler,
  FetchResult,
} from './types';

import {
  validateOperation,
  toLink,
  isTerminating,
  LinkError,
  validateLink,
} from './linkUtils';

import gql from 'graphql-tag';

import Observable from 'zen-observable-ts';
import {
  DocumentNode,
  DefinitionNode,
  OperationDefinitionNode,
} from 'graphql/language/ast';

export abstract class ApolloLink {
  public static from(links: (ApolloLink | RequestHandler)[]) {
    if (links.length === 0) {
      return ApolloLink.empty();
    }

    return links.map(toLink).reduce((x, y) => x.concat(y));
  }

  public static empty(): ApolloLink {
    return new FunctionLink((op, forward) => Observable.of());
  }

  public static passthrough(): ApolloLink {
    return new FunctionLink(
      (op, forward) => (forward ? forward(op) : Observable.of()),
    );
  }

  // split allows for creating a split point in an execution chain
  // like filter, it can be used to direct operations based
  // on request information. Instead of dead ending an execution,
  // split allows for new chains to be formed.
  public static split(
    test: (op: Operation) => boolean,
    left: ApolloLink | RequestHandler,
    right: ApolloLink | RequestHandler = ApolloLink.passthrough(),
  ): ApolloLink {
    const leftLink = validateLink(toLink(left));
    const rightLink = validateLink(toLink(right));

    if (isTerminating(leftLink) && isTerminating(rightLink)) {
      return new FunctionLink(operation => {
        return test(operation)
          ? leftLink.request(operation) || Observable.of()
          : rightLink.request(operation) || Observable.of();
      });
    } else {
      return new FunctionLink((operation, forward) => {
        return test(operation)
          ? leftLink.request(operation, forward) || Observable.of()
          : rightLink.request(operation, forward) || Observable.of();
      });
    }
  }

  public split(
    test: (op: Operation) => boolean,
    left: ApolloLink | RequestHandler,
    right: ApolloLink | RequestHandler = ApolloLink.passthrough(),
  ): ApolloLink {
    return this.concat(ApolloLink.split(test, left, right));
  }

  // join two Links together
  public concat(next: ApolloLink | RequestHandler): ApolloLink {
    validateLink(this);

    if (isTerminating(this)) {
      console.warn(
        new LinkError(
          `You are calling concat on a terminating link, which will have no effect`,
          this,
        ),
      );
      return this;
    }
    const nextLink = validateLink(toLink(next));

    if (isTerminating(nextLink)) {
      return new FunctionLink(
        operation =>
          this.request(
            operation,
            op => nextLink.request(op) || Observable.of(),
          ) || Observable.of(),
      );
    } else {
      return new FunctionLink((operation, forward) => {
        return (
          this.request(operation, op => {
            return nextLink.request(op, forward) || Observable.of();
          }) || Observable.of()
        );
      });
    }
  }

  public abstract request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null;
}

export function execute(
  link: ApolloLink,
  operation: GraphQLRequest,
): Observable<FetchResult> {
  const copy = { ...operation };
  validateOperation(copy);

  if (!copy.context) {
    copy.context = {};
  }
  if (!copy.variables) {
    copy.variables = {};
  }
  if (!copy.query) {
    console.warn(`query should either be a string or GraphQL AST`);
    copy.query = <DocumentNode>{};
  }

  return link.request(transformOperation(copy)) || Observable.of();
}

function transformOperation(operation: GraphQLRequest): Operation {
  let transformedOperation: Operation;

  if (typeof operation.query === 'string') {
    transformedOperation = {
      ...operation,
      query: gql(operation.query),
    };
  } else {
    transformedOperation = {
      ...operation,
    } as Operation;
  }

  if (!transformedOperation.operationName) {
    if (transformedOperation.query && transformedOperation.query.definitions) {
      const operationTypes = ['query', 'mutation', 'subscription'];
      const definitions = <OperationDefinitionNode[]>transformedOperation.query.definitions.filter(
        (x: DefinitionNode) =>
          x.kind === 'OperationDefinition' &&
          operationTypes.indexOf(x.operation) >= 0,
      );

      if (definitions.length) {
        const definition = definitions[0];
        const hasName = definition.name && definition.name.kind === 'Name';
        transformedOperation.operationName = hasName
          ? definitions[0].name.value
          : '';
      }
    } else {
      transformedOperation.operationName = '';
    }
  }

  return transformedOperation;
}

export class FunctionLink extends ApolloLink {
  constructor(public f: RequestHandler) {
    super();
    this.request = f;
  }

  public request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> {
    throw Error('should be overridden');
  }
}
