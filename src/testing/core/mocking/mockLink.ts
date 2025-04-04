import { equal } from "@wry/equality";
import { Observable, throwError } from "rxjs";

import type {
  DocumentNode,
  FetchResult,
  GraphQLRequest,
  Operation,
} from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import type { Unmasked } from "@apollo/client/masking";
import {
  addTypenameToDocument,
  checkDocument,
  cloneDeep,
  getDefaultValues,
  getOperationDefinition,
  isDocumentNode,
  makeUniqueId,
  print,
  removeClientSetsFromDocument,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities";
import { invariant } from "@apollo/client/utilities/invariant";

/** @internal */
type CovariantUnaryFunction<out Arg, out Ret> = { fn(arg: Arg): Ret }["fn"];

export type ResultFunction<T, V = Record<string, any>> = CovariantUnaryFunction<
  V,
  T
>;

type VariableMatcher<V = Record<string, any>> = CovariantUnaryFunction<
  V,
  boolean
>;

export interface MockedResponse<
  // @ts-ignore
  out TData = Record<string, any>,
  out TVariables = Record<string, any>,
> {
  request: GraphQLRequest<TVariables>;
  maxUsageCount?: number;
  result?:
    | FetchResult<Unmasked<TData>>
    | ResultFunction<FetchResult<Unmasked<TData>>, TVariables>;
  error?: Error;
  delay?: number;
  variableMatcher?: VariableMatcher<TVariables>;
  newData?: ResultFunction<FetchResult<Unmasked<TData>>, TVariables>;
}

interface NormalizedMockedResponse {
  request: GraphQLRequest;
  maxUsageCount: number;
  result?: FetchResult | ResultFunction<FetchResult, any>;
  error?: Error;
  delay?: number;
  variableMatcher: VariableMatcher;
  newData?: ResultFunction<FetchResult, any>;
}

export interface MockLinkOptions {
  showWarnings?: boolean;
}

export class MockLink extends ApolloLink {
  public showWarnings: boolean = true;
  private mockedResponsesByKey: { [key: string]: NormalizedMockedResponse[] } =
    {};

  constructor(
    mockedResponses: ReadonlyArray<MockedResponse<any, any>>,
    options: MockLinkOptions = {}
  ) {
    super();
    this.showWarnings = options.showWarnings ?? true;

    if (mockedResponses) {
      mockedResponses.forEach((mockedResponse) => {
        this.addMockedResponse(mockedResponse);
      });
    }
  }

  public addMockedResponse(mockedResponse: MockedResponse) {
    validateMockedResponse(mockedResponse);

    const normalized = normalizeMockedResponse(mockedResponse);
    this.getMockedResponses(normalized.request).push(normalized);
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    const unmatchedVars: Array<Record<string, any> | "<undefined>"> = [];
    const mocks = this.getMockedResponses(operation);

    const index = mocks.findIndex((mock) => {
      if (mock.variableMatcher(operation.variables)) {
        return true;
      }

      unmatchedVars.push(mock.request.variables || "<undefined>");
      return false;
    });

    const matched = index >= 0 ? mocks[index] : void 0;

    if (!matched) {
      const message = getErrorMessage(operation, unmatchedVars);

      if (this.showWarnings) {
        console.warn(
          message +
            "\nThis typically indicates a configuration error in your mocks " +
            "setup, usually due to a typo or mismatched variable."
        );
      }

      return throwError(() => new Error(message));
    }

    if (matched.maxUsageCount > 1) {
      matched.maxUsageCount--;
    } else {
      mocks.splice(index, 1);
    }

    if (matched.delay === Infinity) {
      return new Observable();
    }

    const { newData } = matched;

    if (newData) {
      matched.result = newData(operation.variables);
      mocks.push(matched);
    }

    const delay = matched.delay ?? 0;

    return new Observable((observer) => {
      const timer = setTimeout(() => {
        if (matched.error) {
          return observer.error(matched.error);
        }

        if (matched.result) {
          observer.next(
            typeof matched.result === "function" ?
              matched.result(operation.variables)
            : matched.result
          );
        }
        observer.complete();
      }, delay);

      return () => {
        clearTimeout(timer);
      };
    });
  }

  private getMockedResponses(request: GraphQLRequest) {
    const key = JSON.stringify({
      query: print(addTypenameToDocument(request.query)),
    });

    let mockedResponses = this.mockedResponsesByKey[key];

    if (!mockedResponses) {
      mockedResponses = this.mockedResponsesByKey[key] = [];
    }

    return mockedResponses;
  }
}

function getErrorMessage(
  operation: Operation,
  unmatchedVars: Array<Record<string, any> | "<undefined>">
) {
  return `No more mocked responses for the query:
${print(operation.query)}

Request variables: ${stringifyForDebugging(operation.variables)}
${
  unmatchedVars.length > 0 ?
    `
Failed to match ${unmatchedVars.length} mock${
      unmatchedVars.length === 1 ? "" : "s"
    } for this query. The mocked responses had the following variables:
${unmatchedVars.map((d) => `  ${stringifyForDebugging(d)}`).join("\n")}
`
  : ""
}`;
}

function normalizeMockedResponse(
  mockedResponse: MockedResponse
): NormalizedMockedResponse {
  const response = cloneDeep(mockedResponse);
  const request = response.request;

  request.query = getServerQuery(request.query);
  response.maxUsageCount = response.maxUsageCount ?? 1;

  const withDefaults = {
    ...getDefaultValues(getOperationDefinition(request.query)),
    ...request.variables,
  };

  if (Object.keys(withDefaults).length) {
    request.variables = withDefaults;
  }

  response.variableMatcher ||= (vars) => {
    return equal(vars || {}, {
      ...getDefaultValues(getOperationDefinition(request.query)),
      ...request.variables,
    });
  };

  return response as NormalizedMockedResponse;
}

function getServerQuery(query: DocumentNode) {
  const queryWithoutClientOnlyDirectives = removeDirectivesFromDocument(
    [{ name: "connection" }, { name: "nonreactive" }, { name: "unmask" }],
    query
  );

  invariant(queryWithoutClientOnlyDirectives, "query is required");

  const serverQuery = removeClientSetsFromDocument(
    queryWithoutClientOnlyDirectives
  );

  invariant(
    serverQuery,
    "Cannot mock a client-only query. Mocked responses should contain at least one non-client field."
  );

  return serverQuery;
}

function validateMockedResponse(mockedResponse: MockedResponse) {
  checkDocument(mockedResponse.request.query);

  invariant(
    mockedResponse.result ||
      mockedResponse.error ||
      mockedResponse.delay === Infinity,
    `Mocked response should contain either \`result\`, \`error\` or a \`delay\` of \`Infinity\`:\n%s`,
    stringifyMockedResponse(mockedResponse)
  );

  invariant(
    (mockedResponse.maxUsageCount ?? 1) > 0,
    "Mocked response `maxUsageCount` must be greater than 0. Given %s",
    mockedResponse.maxUsageCount
  );

  invariant(
    !mockedResponse.variableMatcher || !mockedResponse.request.variables,
    "Mocked response should use either `request.variables` or `variableMatcher` but not both"
  );
}

/** @internal */
export function stringifyMockedResponse(mockedResponse: MockedResponse) {
  return JSON.stringify(
    mockedResponse,
    (_, value) => {
      if (isDocumentNode(value)) {
        return print(value);
      }

      if (typeof value === "function") {
        return "<function>";
      }

      return value;
    },
    2
  );
}

export interface MockApolloLink extends ApolloLink {
  operation?: Operation;
}

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server.
export function mockSingleLink(
  ...mockedResponses: Array<MockedResponse<any, any>>
): MockApolloLink {
  return new MockLink(mockedResponses);
}

// This is similiar to the stringifyForDisplay utility we ship, but includes
// support for NaN in addition to undefined. More values may be handled in the
// future. This is not added to the primary stringifyForDisplay helper since it
// is used for the cache and other purposes. We need this for debuggging only.
function stringifyForDebugging(value: any, space = 0): string {
  if (typeof value === "string") {
    return value;
  }

  const undefId = makeUniqueId("undefined");
  const nanId = makeUniqueId("NaN");

  return JSON.stringify(
    value,
    (_, value) => {
      if (value === void 0) {
        return undefId;
      }

      if (Number.isNaN(value)) {
        return nanId;
      }

      return value;
    },
    space
  )
    .replace(new RegExp(JSON.stringify(undefId), "g"), "<undefined>")
    .replace(new RegExp(JSON.stringify(nanId), "g"), "NaN");
}
