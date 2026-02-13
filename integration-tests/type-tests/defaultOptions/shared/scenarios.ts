import {
  ApolloClient,
  type DataState,
  type TypedDocumentNode,
} from "@apollo/client";
import {
  useBackgroundQuery,
  useLazyQuery,
  useLoadableQuery,
  useQuery,
  useSuspenseQuery,
  type QueryRef,
  type SkipToken,
} from "@apollo/client/react";
import { expectTypeOf } from "expect-type";

export interface Data {
  foo: string;
}

export interface Variables {
  bar?: number;
}

export declare const client: ApolloClient;
export declare const QUERY: TypedDocumentNode<Data, Variables>;
export const bool = true as any as boolean;
type bool = boolean;

namespace clientQueryCase {
  export type QueryResultNone = ApolloClient.QueryResult<Data, "none">;
  export type QueryResultAll = ApolloClient.QueryResult<Data, "all">;
  export type QueryResultIgnore = ApolloClient.QueryResult<Data, "ignore">;
}

namespace useQueryCase {
  export type Result<TStates extends DataState<Data>["dataState"]> =
    useQuery.Result<Data, Variables, TStates, Variables>;
  export namespace returnPartialData {
    export const defaults = expectTypeOf(useQuery(QUERY));
    export const _false = expectTypeOf(
      useQuery(QUERY, { returnPartialData: false })
    );
    export const _true = expectTypeOf(
      useQuery(QUERY, { returnPartialData: true })
    );
    export const _bool = expectTypeOf(
      useQuery(QUERY, { returnPartialData: bool })
    );
  }
}

namespace useLazyQueryCase {
  export type Result<TStates extends DataState<Data>["dataState"]> =
    useLazyQuery.ResultTuple<Data, Variables, TStates>;
  export namespace returnPartialData {
    export const defaults = expectTypeOf(useLazyQuery(QUERY));
    export const _false = expectTypeOf(
      useLazyQuery(QUERY, { returnPartialData: false })
    );
    export const _true = expectTypeOf(
      useLazyQuery(QUERY, { returnPartialData: true })
    );
    export const _bool = expectTypeOf(
      useLazyQuery(QUERY, { returnPartialData: bool })
    );
  }
}

namespace useSuspenseQueryCase {
  export type Result<TStates extends DataState<Data>["dataState"]> =
    useSuspenseQuery.Result<Data, Variables, TStates>;

  export namespace errorPolicy {
    export namespace defaults {
      export const result = expectTypeOf(useSuspenseQuery(QUERY));
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useSuspenseQuery(QUERY, { returnPartialData: false })
        );
        export const _true = expectTypeOf(
          useSuspenseQuery(QUERY, { returnPartialData: true })
        );
        export const _bool = expectTypeOf(
          useSuspenseQuery(QUERY, { returnPartialData: bool })
        );
      }
    }
    export namespace none {
      export const result = expectTypeOf(
        useSuspenseQuery(QUERY, { errorPolicy: "none" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace all {
      export const result = expectTypeOf(
        useSuspenseQuery(QUERY, { errorPolicy: "all" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace ignore {
      export const result = expectTypeOf(
        useSuspenseQuery(QUERY, { errorPolicy: "ignore" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useSuspenseQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: bool,
          })
        );
      }
    }
  }
  export namespace skipToken {
    export const result = expectTypeOf(
      useSuspenseQuery(QUERY, {} as SkipToken)
    );
    export namespace returnPartialData {
      export const _false = expectTypeOf(
        useSuspenseQuery(QUERY, {} as SkipToken | { returnPartialData: false })
      );
      export const _true = expectTypeOf(
        useSuspenseQuery(QUERY, {} as SkipToken | { returnPartialData: true })
      );
      export const _bool = expectTypeOf(
        useSuspenseQuery(QUERY, {} as SkipToken | { returnPartialData: bool })
      );
    }
  }
  export namespace skip {
    export namespace _true {
      export const result = expectTypeOf(
        useSuspenseQuery(QUERY, { skip: true })
      );
      // `skip: true` seems very impractical, so we're not testing for combinations with `returnPartialData` here.
    }
    // `skip: false` should probably never be specified, so we don't test any types around it.
    // it might behave like `skip: true` or `skip: boolean` though, which is technically wrong
    export namespace _bool {
      export const result = expectTypeOf(
        useSuspenseQuery(QUERY, { skip: bool })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useSuspenseQuery(QUERY, { skip: bool, returnPartialData: false })
        );
        export const _true = expectTypeOf(
          useSuspenseQuery(QUERY, { skip: bool, returnPartialData: true })
        );
        export const _bool = expectTypeOf(
          useSuspenseQuery(QUERY, { skip: bool, returnPartialData: bool })
        );
      }
    }
  }
}

namespace useBackgroundQueryCase {
  export type Result<
    TStates extends DataState<Data>["dataState"],
    AdditionalReturnValue = never,
  > = [
    QueryRef<Data, Variables, TStates> | AdditionalReturnValue,
    useBackgroundQuery.Result<Data, Variables>,
  ];
  export type UndefinedResult = [
    undefined,
    useBackgroundQuery.Result<Data, Variables>,
  ];

  export namespace errorPolicy {
    export namespace defaults {
      export const result = expectTypeOf(useBackgroundQuery(QUERY));
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useBackgroundQuery(QUERY, { returnPartialData: false })
        );
        export const _true = expectTypeOf(
          useBackgroundQuery(QUERY, { returnPartialData: true })
        );
        export const _bool = expectTypeOf(
          useBackgroundQuery(QUERY, { returnPartialData: bool })
        );
      }
    }
    export namespace none {
      export const result = expectTypeOf(
        useBackgroundQuery(QUERY, { errorPolicy: "none" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace all {
      export const result = expectTypeOf(
        useBackgroundQuery(QUERY, { errorPolicy: "all" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace ignore {
      export const result = expectTypeOf(
        useBackgroundQuery(QUERY, { errorPolicy: "ignore" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useBackgroundQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: bool,
          })
        );
      }
    }
  }
  export namespace skipToken {
    export const result = expectTypeOf(
      useBackgroundQuery(QUERY, {} as SkipToken)
    );
    export namespace returnPartialData {
      export const _false = expectTypeOf(
        useBackgroundQuery(
          QUERY,
          {} as SkipToken | { returnPartialData: false }
        )
      );
      export const _true = expectTypeOf(
        useBackgroundQuery(QUERY, {} as SkipToken | { returnPartialData: true })
      );
      export const _bool = expectTypeOf(
        useBackgroundQuery(QUERY, {} as SkipToken | { returnPartialData: bool })
      );
    }
  }
  export namespace skip {
    export namespace _true {
      export const result = expectTypeOf(
        useBackgroundQuery(QUERY, { skip: true })
      );
      // `skip: true` seems very impractical, so we're not testing for combinations with `returnPartialData` here.
    }
    // `skip: false` should probably never be specified, so we don't test any types around it.
    // it might behave like `skip: true` or `skip: boolean` though, which is technically wrong
    export namespace _bool {
      export const result = expectTypeOf(
        useBackgroundQuery(QUERY, { skip: bool })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useBackgroundQuery(QUERY, { skip: bool, returnPartialData: false })
        );
        export const _true = expectTypeOf(
          useBackgroundQuery(QUERY, { skip: bool, returnPartialData: true })
        );
        export const _bool = expectTypeOf(
          useBackgroundQuery(QUERY, { skip: bool, returnPartialData: bool })
        );
      }
    }
  }
}
namespace useLoadableQueryCase {
  export type Result<TStates extends DataState<Data>["dataState"]> =
    useLoadableQuery.Result<Data, Variables, TStates>;

  export namespace errorPolicy {
    export namespace defaults {
      export const result = expectTypeOf(useLoadableQuery(QUERY));
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useLoadableQuery(QUERY, { returnPartialData: false })
        );
        export const _true = expectTypeOf(
          useLoadableQuery(QUERY, { returnPartialData: true })
        );
        export const _bool = expectTypeOf(
          useLoadableQuery(QUERY, { returnPartialData: bool })
        );
      }
    }
    export namespace none {
      export const result = expectTypeOf(
        useLoadableQuery(QUERY, { errorPolicy: "none" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "none",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace all {
      export const result = expectTypeOf(
        useLoadableQuery(QUERY, { errorPolicy: "all" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "all",
            returnPartialData: bool,
          })
        );
      }
    }
    export namespace ignore {
      export const result = expectTypeOf(
        useLoadableQuery(QUERY, { errorPolicy: "ignore" })
      );
      export namespace returnPartialData {
        export const _false = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: false,
          })
        );
        export const _true = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: true,
          })
        );
        export const _bool = expectTypeOf(
          useLoadableQuery(QUERY, {
            errorPolicy: "ignore",
            returnPartialData: bool,
          })
        );
      }
    }
  }
}

export {
  type clientQueryCase as clientQuery,
  useQueryCase as useQuery,
  useSuspenseQueryCase as useSuspenseQuery,
  useBackgroundQueryCase as useBackgroundQuery,
  useLoadableQueryCase as useLoadableQuery,
  useLazyQueryCase as useLazyQuery,
};
