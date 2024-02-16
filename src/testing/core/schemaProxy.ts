import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import type { Resolvers } from "../../core/types.js";

const proxiedSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
) => {
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers,
  });

  const schema = new Proxy(targetSchema, {
    get(target, p) {
      if (p === "use") {
        return (newResolvers: typeof resolvers) =>
          (targetSchema = addResolversToSchema({
            schema: schemaWithMocks,
            resolvers: {
              ...resolvers,
              ...newResolvers,
            },
          }));
      }
      // @ts-expect-error
      if (typeof targetSchema[p] === "function") {
        // @ts-expect-error
        return targetSchema[p].bind(targetSchema);
      }
      return Reflect.get(target, p);
    },
  });

  return schema;
};

export { proxiedSchema };
