import { DeepPartial, HKT } from "@apollo/client/utilities";
import { ApplyHKT } from "@apollo/client/utilities/internal";
import { gql, TypedDocumentNode, TData } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { expectTypeOf } from "expect-type";
import { DocumentTypeDecoration } from "@graphql-typed-document-node/core";

type ExtendedTypedDocumentNode<TCompleteData, TVariables, TStreaming> =
  TypedDocumentNode<
    TCompleteData & {
      _complete?: TCompleteData;
      _streaming?: TStreaming;
    },
    TVariables
  >;

declare namespace MyImplementation {
  interface Complete extends HKT {
    arg1: unknown; // TData
    return: this["arg1"] extends { _complete?: infer TComplete } ? TComplete
    : this["arg1"];
  }
  interface Streaming extends HKT {
    arg1: unknown; // TData
    return: this["arg1"] extends { _streaming?: infer TStreaming } ? TStreaming
    : DeepPartial<this["arg1"]>;
  }
  interface Partial extends HKT {
    arg1: unknown; // TData
    return: DeepPartial<ApplyHKT<Complete, this["arg1"]>>;
  }
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    Complete: MyImplementation.Complete;
    Streaming: MyImplementation.Streaming;
    Partial: MyImplementation.Partial;
  }
}

type CompleteData = {
  __typename: string;
  id: string;
  name: string;
  age: number;
  description: string;
};
type StreamingData = {
  __typename: string;
  id: string;
} & (
  | {
      name: string;
      age: number;
    }
  | {
      name?: undefined;
      age?: undefined;
    }
) &
  (
    | {
        description: string;
      }
    | {
        description?: undefined;
      }
  );

const query: ExtendedTypedDocumentNode<
  CompleteData,
  { id: string },
  StreamingData
> = gql`
  query GetUser($Id: String!) {
    user(id: $Id) {
      __typename
      id
      ... @defer {
        name
        age
      }
      ... @defer {
        description
      }
    }
  }
`;

if (1 > 2 /* skip running this */) {
  type TData =
    typeof query extends DocumentTypeDecoration<infer TData, any> ? TData
    : never;
  expectTypeOf<TData.Complete<TData>>().toEqualTypeOf<CompleteData>();
  expectTypeOf<TData.Streaming<TData>>().toEqualTypeOf<StreamingData>();
  expectTypeOf<TData.PartialData<TData>>().toEqualTypeOf<
    DeepPartial<CompleteData>
  >();

  const result = useQuery(query, {
    variables: { id: "123" },
    returnPartialData: true,
  });
  if (result.dataState === "complete") {
    expectTypeOf(result.data).toEqualTypeOf<CompleteData>();
  }
  if (result.dataState === "streaming") {
    expectTypeOf(result.data).toEqualTypeOf<StreamingData>();
    if (result.data.name) {
      expectTypeOf(result.data.name).toEqualTypeOf<string>();
      expectTypeOf(result.data.age).toEqualTypeOf<number>();
    } else {
      expectTypeOf(result.data.name).toEqualTypeOf<string | undefined>();
      expectTypeOf(result.data.age).toEqualTypeOf<number | undefined>();
    }
  }
  if (result.dataState === "partial") {
    expectTypeOf(result.data).toEqualTypeOf<DeepPartial<CompleteData>>();
  }
}
