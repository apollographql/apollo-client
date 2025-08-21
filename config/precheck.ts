import lockfile from "../package-lock.json" with { type: "json" };
const { lockfileVersion } = lockfile;

const expectedVersion = 3;

if (typeof lockfileVersion !== "number" || lockfileVersion < expectedVersion) {
  throw new Error(
    `Old lockfileVersion (${lockfileVersion}) found in package-lock.json (expected ${expectedVersion} or later)`
  );
}

console.log("ok", {
  lockfileVersion,
  expectedVersion,
});
