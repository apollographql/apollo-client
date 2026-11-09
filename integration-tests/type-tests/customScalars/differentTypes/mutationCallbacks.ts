import type { ApolloClient, TypedDocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";

declare const client: ApolloClient;
declare const mutation: TypedDocumentNode<{
  createEvent: { startDate: Date };
}>;

client.mutate({
  mutation,
  refetchQueries(result) {
    if (result.dataState === "complete") {
      expectTypeOf(result.data.createEvent.startDate).toEqualTypeOf<Date>();
    }
    return [];
  },
  updateQueries: {
    Events(previous, { mutationResult }) {
      if (mutationResult.dataState === "complete") {
        expectTypeOf(
          mutationResult.data.createEvent.startDate
        ).toEqualTypeOf<Date>();
      }
      return previous;
    },
  },
  update(_cache, result) {
    if (result.data) {
      expectTypeOf(result.data.createEvent.startDate).toEqualTypeOf<Date>();
    }
  },
});
