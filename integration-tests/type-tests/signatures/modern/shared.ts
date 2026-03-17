import { TypedDocumentNode } from "@apollo/client";
import type { GraphQLCodegenDataMasking } from "@apollo/client/masking";
import { MockLink } from "@apollo/client/testing";
import type { HKT } from "@apollo/client/utilities";

// This type override is used in tests only so we can differentiate between
// `TData` and `Streaming<TData>` in our type tests. This file doesn't make it
// into the final build, so it doesn't affect the userland behavior of the library.

type StreamingOverride<TData> = TData & { __streaming?: true };
interface StreamingOverrideHKT extends HKT {
  return: StreamingOverride<this["arg1"]>;
}

declare module "@apollo/client" {
  export interface TypeOverrides
    extends GraphQLCodegenDataMasking.TypeOverrides {
    Streaming: StreamingOverrideHKT;
    signatureStyle: "modern";
  }
}

export declare function test(name: string, test: () => void): void;
export declare function it(name: string, test: () => void): void;
export declare function setupVariablesCase(): {
  query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables>;
};
export declare function setupMaskedVariablesCase(): {
  query: TypedDocumentNode<MaskedVariablesCaseData, VariablesCaseVariables>;
  unmaskedQuery: TypedDocumentNode<
    UnmaskedVariablesCaseData,
    VariablesCaseVariables
  >;
};

export interface VariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

export interface VariablesCaseVariables {
  id: string;
}

type MaskedVariablesCaseFragment = {
  __typename: "Character";
  name: string;
} & { " $fragmentName"?: "MaskedVariablesCaseFragment" };

export interface MaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
  } & {
    " $fragmentRefs"?: {
      MaskedVariablesCaseFragment: MaskedVariablesCaseFragment;
    };
  };
}

export interface UnmaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

export declare const query: TypedDocumentNode<
  VariablesCaseData,
  VariablesCaseVariables
>;
export declare const maskedQuery: TypedDocumentNode<
  MaskedVariablesCaseData,
  VariablesCaseVariables
>;
export declare const unmaskedQuery: TypedDocumentNode<
  UnmaskedVariablesCaseData,
  VariablesCaseVariables
>;
export declare function useVariablesQueryCase(): {
  query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables>;
};
export interface SimpleCaseData {
  greeting: string;
}
export declare const simpleQuery: TypedDocumentNode<
  SimpleCaseData,
  Record<string, never>
>;
export declare const simpleMocks: MockLink.MockedResponse<
  SimpleCaseData,
  Record<string, any>
>[];
export declare function setupSimpleCase(): {
  query: TypedDocumentNode<SimpleCaseData, Record<string, never>>;
  mocks: MockLink.MockedResponse<SimpleCaseData, Record<string, any>>[];
};

export declare function useMaskedVariablesQueryCase(): {
  query: TypedDocumentNode<MaskedVariablesCaseData, VariablesCaseVariables>;
  unmaskedQuery: TypedDocumentNode<
    MaskedVariablesCaseData,
    VariablesCaseVariables
  >;
};
