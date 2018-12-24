import buildUmdConfig, { globals } from "../../config/buildUmdConfig";

const globalsOverride = {
  ...globals,
  "graphql/language/printer": "print"
};

export default [
  buildUmdConfig("apollo.cache.inmemory", {
    output: {
      globals: globalsOverride
    }
  })
];
