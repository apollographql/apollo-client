import packageJson from "../package-lock.json" assert { type: 'json' };

const lockfileVersion = packageJson.lockfileVersion;
const expectedVersion = 2;

if (typeof lockfileVersion !== "number" ||
    lockfileVersion < expectedVersion) {
  throw new Error(
    `Old lockfileVersion (${
      lockfileVersion
    }) found in package-lock.json (expected ${
      expectedVersion
    } or later)`
  );
}

console.log("ok", {
  lockfileVersion,
  expectedVersion,
});
