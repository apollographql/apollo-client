// TODO This entire file doesn't work yet without appending `/index.js` to all imports manually!

import assert from "node:assert";
import path from "path";
import { importMetaResolve } from "resolve-esm";

import { ApolloClient } from "@apollo/client/index.js";
import { useQuery } from "@apollo/client/react/index.js";
import { HttpLink } from "@apollo/client/link/http/index.js";

console.log(
  "Testing Node with ESM imports...  (user-side workaround with `/index.js)"
);

function checkFunctionName(fn, name, category) {
  console.log(`Checking ${category} '${name}' === '${fn.name}'`);
  assert(
    fn.name === name,
    `${category} \`${name}\` did not import correctly (name: '${fn.name}')`
  );
}

const entries = [
  [ApolloClient, "ApolloClient", "Barrel Import"],
  [useQuery, "useQuery", "Apollo React"],
  [HttpLink, "HttpLink", "Link"],
];

for (let [fn, name, category] of entries) {
  try {
    checkFunctionName(fn, name, category);
  } catch (error) {
    console.error(error);
  }
}

const moduleNames = [
  ["@apollo/client/index.js", "/index.js"],
  ["@apollo/client/react/index.js", "/react/index.js"],
  ["@apollo/client/link/http/index.js", "/link/http/index.js"],
];

(async () => {
  for (let [moduleName, expectedFilename] of moduleNames) {
    const modulePath = await importMetaResolve(moduleName);
    const posixPath = modulePath.split(path.sep).join(path.posix.sep);
    console.log(`Module: ${moduleName}, path: ${posixPath}`);
    assert(posixPath.endsWith(expectedFilename));
  }
})();
