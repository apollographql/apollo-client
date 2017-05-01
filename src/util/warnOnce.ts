
const haveWarned = Object.create({});

export function warnOnce(msg: string, type = 'warn') {
  if (!haveWarned[msg]) {
    haveWarned[msg] = true;
    switch (type) {
      case 'error':
        console.error(msg);
        break;
      default:
        console.warn(msg);
    }
  }
}
