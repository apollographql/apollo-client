import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import { asapScheduler, Observable, observeOn, throwError } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import type { Unmasked } from "@apollo/client/masking";
import { addTypenameToDocument, print } from "@apollo/client/utilities";
import {
  checkDocument,
  cloneDeep,
  getDefaultValues,
  getOperationDefinition,
  isDocumentNode,
  makeUniqueId,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

/** @internal */
type CovariantUnaryFunction<out Arg, out Ret> = { fn(arg: Arg): Ret }["fn"];

type VariableMatcher<V = Record<string, any>> = CovariantUnaryFunction<
  V,
  boolean
>;

interface NormalizedMockedResponse {
  original: MockLink.MockedResponse;
  request: MockLink.MockedRequest;
  variablesWithDefaults: Record<string, any>;
  maxUsageCount: number;
  result?: ApolloLink.Result | MockLink.ResultFunction<ApolloLink.Result, any>;
  error?: Error;
  delay: number | MockLink.DelayFunction;
}

type UnmatchedVariables = Array<
  Record<string, any> | "<undefined>" | `<function ${string}>`
>;

export declare namespace MockLink {
  export type DelayFunction = (operation: ApolloLink.Operation) => number;
  export type Delay = number | DelayFunction;
  export interface DefaultOptions {
    delay?: MockLink.Delay;
  }

  export interface MockedRequest<
    TVariables extends OperationVariables = OperationVariables,
  > {
    query: DocumentNode;
    variables?: TVariables | VariableMatcher<TVariables>;
  }

  export interface MockedResponse<
    /** @ts-ignore */
    out TData = Record<string, any>,
    out TVariables extends OperationVariables = Record<string, any>,
  > {
    request: MockedRequest<TVariables>;
    maxUsageCount?: number;
    result?:
      | ApolloLink.Result<Unmasked<TData>>
      | ResultFunction<ApolloLink.Result<Unmasked<TData>>, TVariables>;
    error?: Error;
    delay?: number | MockLink.DelayFunction;
  }

  export type ResultFunction<
    T,
    V = Record<string, any>,
  > = CovariantUnaryFunction<V, T>;

  export interface Options {
    showWarnings?: boolean;
    defaultOptions?: DefaultOptions;
  }
}

export function realisticDelay({
  min = 20,
  max = 50,
}: { min?: number; max?: number } = {}): MockLink.DelayFunction {
  invariant(max > min, "realisticDelay: `min` must be less than `max`");

  return () => Math.floor(Math.random() * (max - min) + min);
}

export class MockLink extends ApolloLink {
  public operation!: ApolloLink.Operation;
  public showWarnings: boolean = true;

  private defaultDelay: MockLink.Delay;
  private mockedResponsesByKey: { [key: string]: NormalizedMockedResponse[] } =
    {};

  public static defaultOptions: MockLink.DefaultOptions = {
    delay: realisticDelay(),
  };

  constructor(
    mockedResponses: ReadonlyArray<
      MockLink.MockedResponse<Record<string, any>, Record<string, any>>
    >,
    options: MockLink.Options = {}
  ) {
    super();
    const defaultOptions = options.defaultOptions ?? MockLink.defaultOptions;

    this.showWarnings = options.showWarnings ?? true;
    this.defaultDelay = defaultOptions?.delay ?? realisticDelay();

    if (mockedResponses) {
      mockedResponses.forEach((mockedResponse) => {
        this.addMockedResponse(mockedResponse);
      });
    }
  }

  public addMockedResponse(mockedResponse: MockLink.MockedResponse) {
    validateMockedResponse(mockedResponse);

    const normalized = this.normalizeMockedResponse(mockedResponse);
    this.getMockedResponses(normalized.request).push(normalized);
  }

  public request(
    operation: ApolloLink.Operation
  ): Observable<ApolloLink.Result> {
    this.operation = operation;
    const unmatchedVars: UnmatchedVariables = [];
    const mocks = this.getMockedResponses(operation);

    const index = mocks.findIndex((mock) => {
      const { variables } = mock.request;

      if (typeof variables === "function") {
        const matched = variables(operation.variables);

        if (!matched) {
          unmatchedVars.push(`<function ${variables.name}>`);
        }

        return matched;
      }

      const withDefaults = mock.variablesWithDefaults;

      if (equal(withDefaults, operation.variables)) {
        return true;
      }

      unmatchedVars.push(
        // Include default variables from the query in unmatched variables
        // output
        Object.keys(withDefaults).length > 0 ?
          withDefaults
        : variables || "<undefined>"
      );
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

      return throwError(() => new Error(message)).pipe(
        observeOn(asapScheduler)
      );
    }

    if (matched.maxUsageCount > 1) {
      matched.maxUsageCount--;
    } else {
      mocks.splice(index, 1);
    }

    const delay =
      typeof matched.delay === "function" ?
        matched.delay(operation)
      : matched.delay;

    if (!matched.result && !matched.error && delay !== Infinity) {
      return throwError(
        () =>
          new Error(
            `Mocked response should contain either \`result\`, \`error\` or a \`delay\` of \`Infinity\`:\n${stringifyMockedResponse(
              matched.original
            )}`
          )
      );
    }

    if (matched.delay === Infinity) {
      return new Observable();
    }

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

  private getMockedResponses(request: MockLink.MockedRequest) {
    const key = JSON.stringify({
      query: print(addTypenameToDocument(request.query)),
    });

    let mockedResponses = this.mockedResponsesByKey[key];

    if (!mockedResponses) {
      mockedResponses = this.mockedResponsesByKey[key] = [];
    }

    return mockedResponses;
  }

  private normalizeMockedResponse(
    mockedResponse: MockLink.MockedResponse
  ): NormalizedMockedResponse {
    const { request } = mockedResponse;
    const response = cloneDeep(mockedResponse) as NormalizedMockedResponse;

    response.original = mockedResponse;
    response.request.query = getServerQuery(request.query);
    response.maxUsageCount ??= 1;
    response.variablesWithDefaults = {
      ...getDefaultValues(getOperationDefinition(request.query)),
      ...request.variables,
    };
    response.delay ??= this.defaultDelay;

    return response;
  }
}

function getErrorMessage(
  operation: ApolloLink.Operation,
  unmatchedVars: UnmatchedVariables
) {
  return `No more mocked responses for the query:
${print(operation.query)}

Request variables: ${stringifyForDebugging(operation.variables)}
${
  unmatchedVars.length > 0 ?
    `
Failed to match variables against ${unmatchedVars.length} mock${
      unmatchedVars.length === 1 ? "" : "s"
    } for this query. The available mocks had the following variables:
${unmatchedVars.map((d) => `  ${stringifyForDebugging(d)}`).join("\n")}
`
  : ""
}`;
}

function getServerQuery(query: DocumentNode) {
  const queryWithoutClientOnlyDirectives = removeDirectivesFromDocument(
    [{ name: "connection" }, { name: "nonreactive" }, { name: "unmask" }],
    query
  );

  invariant(queryWithoutClientOnlyDirectives, "query is required");

  const serverQuery = removeDirectivesFromDocument(
    [{ name: "client", remove: true }],
    queryWithoutClientOnlyDirectives
  );

  invariant(
    serverQuery,
    "Cannot mock a client-only query. Mocked responses should contain at least one non-client field."
  );

  return serverQuery;
}

function validateMockedResponse(mock: MockLink.MockedResponse) {
  checkDocument(mock.request.query);

  invariant(
    (mock.maxUsageCount ?? 1) > 0,
    "Mocked response `maxUsageCount` must be greater than 0. Given %s",
    mock.maxUsageCount
  );
}

/** @internal */
export function stringifyMockedResponse(
  mockedResponse: MockLink.MockedResponse
) {
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
  operation?: ApolloLink.Operation;
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
