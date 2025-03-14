import { invariant } from "../../../utilities/globals/index.js";

import { equal } from "@wry/equality";

import type {
  Operation,
  GraphQLRequest,
  FetchResult,
} from "../../../link/core/index.js";
import { ApolloLink } from "../../../link/core/index.js";

import {
  Observable,
  addTypenameToDocument,
  removeClientSetsFromDocument,
  cloneDeep,
  print,
  getOperationDefinition,
  getDefaultValues,
  removeDirectivesFromDocument,
  checkDocument,
  makeUniqueId,
} from "../../../utilities/index.js";
import type { Unmasked } from "../../../masking/index.js";

/** @internal */
type CovariantUnaryFunction<out Arg, out Ret> = { fn(arg: Arg): Ret }["fn"];

export type ResultFunction<T, V = Record<string, any>> = CovariantUnaryFunction<
  V,
  T
>;

export type VariableMatcher<V = Record<string, any>> = CovariantUnaryFunction<
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

export interface MockLinkOptions {
  showWarnings?: boolean;
}

function requestToKey(request: GraphQLRequest, addTypename: Boolean): string {
  const queryString =
    request.query &&
    print(addTypename ? addTypenameToDocument(request.query) : request.query);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

export class MockLink extends ApolloLink {
  public operation!: Operation;
  public addTypename: Boolean = true;
  public showWarnings: boolean = true;
  private mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};

  constructor(
    mockedResponses: ReadonlyArray<MockedResponse<any, any>>,
    addTypename: Boolean = true,
    options: MockLinkOptions = Object.create(null)
  ) {
    super();
    this.addTypename = addTypename;
    this.showWarnings = options.showWarnings ?? true;

    if (mockedResponses) {
      mockedResponses.forEach((mockedResponse) => {
        this.addMockedResponse(mockedResponse);
      });
    }
  }

  public addMockedResponse(mockedResponse: MockedResponse) {
    const normalizedMockedResponse =
      this.normalizeMockedResponse(mockedResponse);
    const key = requestToKey(
      normalizedMockedResponse.request,
      this.addTypename
    );
    let mockedResponses = this.mockedResponsesByKey[key];
    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }
    mockedResponses.push(normalizedMockedResponse);
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    this.operation = operation;
    const key = requestToKey(operation, this.addTypename);
    const unmatchedVars: Array<Record<string, any>> = [];
    const requestVariables = operation.variables || {};
    const mockedResponses = this.mockedResponsesByKey[key];
    const responseIndex =
      mockedResponses ?
        mockedResponses.findIndex((res, index) => {
          const mockedResponseVars = res.request.variables || {};
          if (equal(requestVariables, mockedResponseVars)) {
            return true;
          }
          if (res.variableMatcher && res.variableMatcher(operation.variables)) {
            return true;
          }
          unmatchedVars.push(mockedResponseVars);
          return false;
        })
      : -1;

    const response =
      responseIndex >= 0 ? mockedResponses[responseIndex] : void 0;

    // There have been platform- and engine-dependent differences with
    // setInterval(fn, Infinity), so we pass 0 instead (but detect
    // Infinity where we call observer.error or observer.next to pend
    // indefinitely in those cases.)
    const delay = response?.delay === Infinity ? 0 : response?.delay ?? 0;

    let configError: Error;

    if (!response) {
      configError = new Error(
        `No more mocked responses for the query: ${print(operation.query)}
Expected variables: ${stringifyForDebugging(operation.variables)}
${
  unmatchedVars.length > 0 ?
    `
Failed to match ${unmatchedVars.length} mock${
      unmatchedVars.length === 1 ? "" : "s"
    } for this query. The mocked response had the following variables:
${unmatchedVars.map((d) => `  ${stringifyForDebugging(d)}`).join("\n")}
`
  : ""
}`
      );

      if (this.showWarnings) {
        console.warn(
          configError.message +
            "\nThis typically indicates a configuration error in your mocks " +
            "setup, usually due to a typo or mismatched variable."
        );
      }
    } else {
      if (response.maxUsageCount && response.maxUsageCount > 1) {
        response.maxUsageCount--;
      } else {
        mockedResponses.splice(responseIndex, 1);
      }
      const { newData } = response;
      if (newData) {
        response.result = newData(operation.variables);
        mockedResponses.push(response);
      }

      if (!response.result && !response.error && response.delay !== Infinity) {
        configError = new Error(
          `Mocked response should contain either \`result\`, \`error\` or a \`delay\` of \`Infinity\`: ${key}`
        );
      }
    }

    return new Observable((observer) => {
      const timer = setTimeout(() => {
        if (configError) {
          try {
            // The onError function can return false to indicate that
            // configError need not be passed to observer.error. For
            // example, the default implementation of onError calls
            // observer.error(configError) and then returns false to
            // prevent this extra (harmless) observer.error call.
            if (this.onError(configError, observer) !== false) {
              throw configError;
            }
          } catch (error) {
            observer.error(error);
          }
        } else if (response && response.delay !== Infinity) {
          if (response.error) {
            observer.error(response.error);
          } else {
            if (response.result) {
              observer.next(
                typeof response.result === "function" ?
                  response.result(operation.variables)
                : response.result
              );
            }
            observer.complete();
          }
        }
      }, delay);

      return () => {
        clearTimeout(timer);
      };
    });
  }

  private normalizeMockedResponse(
    mockedResponse: MockedResponse
  ): MockedResponse {
    const newMockedResponse = cloneDeep(mockedResponse);
    const queryWithoutClientOnlyDirectives = removeDirectivesFromDocument(
      [{ name: "connection" }, { name: "nonreactive" }, { name: "unmask" }],
      checkDocument(newMockedResponse.request.query)
    );
    invariant(queryWithoutClientOnlyDirectives, "query is required");
    newMockedResponse.request.query = queryWithoutClientOnlyDirectives!;
    const query = removeClientSetsFromDocument(newMockedResponse.request.query);
    if (query) {
      newMockedResponse.request.query = query;
    }

    mockedResponse.maxUsageCount = mockedResponse.maxUsageCount ?? 1;
    invariant(
      mockedResponse.maxUsageCount > 0,
      `Mock response maxUsageCount must be greater than 0, %s given`,
      mockedResponse.maxUsageCount
    );

    this.normalizeVariableMatching(newMockedResponse);
    return newMockedResponse;
  }

  private normalizeVariableMatching(mockedResponse: MockedResponse) {
    const request = mockedResponse.request;
    if (mockedResponse.variableMatcher && request.variables) {
      throw new Error(
        "Mocked response should contain either variableMatcher or request.variables"
      );
    }

    if (!mockedResponse.variableMatcher) {
      request.variables = {
        ...getDefaultValues(getOperationDefinition(request.query)),
        ...request.variables,
      };
      mockedResponse.variableMatcher = (vars) => {
        const requestVariables = vars || {};
        const mockedResponseVariables = request.variables || {};
        return equal(requestVariables, mockedResponseVariables);
      };
    }
  }
}

export interface MockApolloLink extends ApolloLink {
  operation?: Operation;
}

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server.
// NOTE: The last arg can optionally be an `addTypename` arg.
export function mockSingleLink(...mockedResponses: Array<any>): MockApolloLink {
  // To pull off the potential typename. If this isn't a boolean, we'll just
  // set it true later.
  let maybeTypename = mockedResponses[mockedResponses.length - 1];
  let mocks = mockedResponses.slice(0, mockedResponses.length - 1);

  if (typeof maybeTypename !== "boolean") {
    mocks = mockedResponses;
    maybeTypename = true;
  }

  return new MockLink(mocks, maybeTypename);
}

// This is similiar to the stringifyForDisplay utility we ship, but includes
// support for NaN in addition to undefined. More values may be handled in the
// future. This is not added to the primary stringifyForDisplay helper since it
// is used for the cache and other purposes. We need this for debuggging only.
export function stringifyForDebugging(value: any, space = 0): string {
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
