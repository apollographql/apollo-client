// I'm not sure why mocha doesn't provide something like this, you can't
// always use promises
export default (done: Function, cb: (...args: any[]) => any) => (...args: any[]) => {
  try {
    return cb(...args);
  } catch (e) {
    done(e);
  }
};
