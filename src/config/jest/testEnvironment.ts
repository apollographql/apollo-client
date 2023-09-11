import JSDOMEnvironment from "jest-environment-jsdom";

export default (...args: ConstructorParameters<typeof JSDOMEnvironment>) => {
  const env = new JSDOMEnvironment(...args);
  env.global.fetch = fetch;
  env.global.Headers = Headers;
  env.global.Request = Request;
  env.global.Response = Response;
  return env;
};
