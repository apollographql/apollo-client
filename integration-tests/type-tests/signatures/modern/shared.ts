import { TypedDocumentNode } from "@apollo/client";
import type { GraphQLCodegenDataMasking } from "@apollo/client/masking";
import { MockLink } from "../../../../src/testing/index.js";

declare module "@apollo/client" {
  export interface TypeOverrides
    extends GraphQLCodegenDataMasking.TypeOverrides {
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

export declare function useMaskedVariablesQueryCase(): {
  query: TypedDocumentNode<MaskedVariablesCaseData, VariablesCaseVariables>;
  unmaskedQuery: TypedDocumentNode<
    MaskedVariablesCaseData,
    VariablesCaseVariables
  >;
};
