import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import type { Resolvers } from "../../core/types.js";

interface ProxiedSchemaFns {
  addResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  forkWithResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  reset: () => void;
}

const proxiedSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
): GraphQLSchema & ProxiedSchemaFns => {
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers,
  });

  const fns: ProxiedSchemaFns = {
    addResolvers: (newResolvers: typeof resolvers) =>
      (targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: {
          ...resolvers,
          ...newResolvers,
        },
      })),
    // could also just create a fn that just forks and doesn't take resolvers
    forkWithResolvers: (newResolvers: typeof resolvers) => {
      return proxiedSchema(targetSchema, newResolvers);
    },
    // fork: () => {
    //   return proxiedSchema(targetSchema, {});
    // },
    reset: () => {
      targetSchema = addResolversToSchema({
        schema: schemaWithMocks,
        resolvers,
      });
    },
  };

  // Usage notes:
  // You'd want to fork aka call withResolvers e.g. in a describe block and
  // call addResolvers after/in a single test file, you shouldn't
  const schema = new Proxy(targetSchema, {
    get(_target, p) {
      if (p in fns) {
        return Reflect.get(fns, p);
      }

      if (typeof targetSchema[p] === "function") {
        return targetSchema[p].bind(targetSchema);
      }
      return Reflect.get(targetSchema, p);
    },
  });

  return schema;
};

export { proxiedSchema };
