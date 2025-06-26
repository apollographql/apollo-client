import { DeepPartial, HKT } from "@apollo/client/utilities";
import { ApplyHKT } from "@apollo/client/utilities/internal";
import { gql, DataValue, TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { expectTypeOf } from "expect-type";

declare const complete: unique symbol;
declare const streaming: unique symbol;

type ExtendedTypedDocumentNode<TCompleteData, TVariables, TStreaming> =
  TypedDocumentNode<
    TCompleteData & {
      [complete]?: TCompleteData;
      [streaming]?: TStreaming;
    },
    TVariables
  >;

declare namespace MyImplementation {
  interface Complete extends HKT {
    arg1: unknown; // TData
    return: this["arg1"] extends { [complete]?: infer TComplete } ? TComplete
    : this["arg1"];
  }
  interface Streaming extends HKT {
    arg1: unknown; // TData
    return: this["arg1"] extends { [streaming]?: infer TStreaming } ? TStreaming
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
    typeof query extends TypedDocumentNode<infer TData, any> ? TData : never;
  expectTypeOf<DataValue.Complete<TData>>().toEqualTypeOf<CompleteData>();
  expectTypeOf<DataValue.Streaming<TData>>().toEqualTypeOf<StreamingData>();
  expectTypeOf<DataValue.Partial<TData>>().toEqualTypeOf<
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
