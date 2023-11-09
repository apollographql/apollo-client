const assert = require("node:assert");
const path = require("path");

const { ApolloClient } = require("@apollo/client");
const { useQuery } = require("@apollo/client/react");
const { HttpLink } = require("@apollo/client/link/http");

console.log("Testing Node with CJS imports...");

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
  ["@apollo/client", "/main.cjs"],
  ["@apollo/client/react", "/react/react.cjs"],
  ["@apollo/client/link/http", "/link/http/http.cjs"],
];

for (let [moduleName, expectedFilename] of moduleNames) {
  const modulePath = require.resolve(moduleName);
  const posixPath = modulePath.split(path.sep).join(path.posix.sep);
  console.log(`Module: ${moduleName}, path: ${posixPath}`);
  assert(posixPath.endsWith(expectedFilename));
}

console.log("CJS test succeeded");
