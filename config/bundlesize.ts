import { readFileSync } from "fs";
import { join } from "path";
import { gzipSync } from "zlib";
import bytes from "bytes";

const gzipBundleByteLengthLimit = bytes("35.25KB");
const minFile = join("dist", "apollo-client.min.cjs");
const minPath = join(__dirname, "..", minFile);
const gzipByteLen = gzipSync(readFileSync(minPath)).byteLength;
const overLimit = gzipByteLen > gzipBundleByteLengthLimit;

const message = `Minified + GZIP-encoded bundle size for ${minFile} = ${bytes(
  gzipByteLen,
  { unit: "KB" }
)}, ${overLimit ? "exceeding" : "under"} limit ${bytes(
  gzipBundleByteLengthLimit,
  { unit: "KB" }
)}`;

if (overLimit) {
  throw new Error(message);
} else {
  console.log(message);
}
