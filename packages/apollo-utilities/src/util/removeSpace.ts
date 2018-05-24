export function removeSpace(strings: any, ...placeholders: any[]) {
  const raw = typeof strings === 'string' ? [strings] : strings.raw;

  // Interweave the strings with the
  // substitution vars first.
  let output = '';
  for (let i = 0; i < raw.length; i++) {
    output += raw[i].replace(/\\\n[ \t]*/g, '');

    if (i < placeholders.length) {
      output += placeholders[i];
    }
  }

  // Split on newlines.
  let lines = output.split('\n');

  let maxIndentation: number | null = null;
  lines.forEach(l => {
    let m = l.match(/^(\s+)\S+/);
    if (m) {
      let indent = m[1].length;
      if (!maxIndentation) {
        // this is the first indented line
        maxIndentation = indent;
      } else {
        maxIndentation = Math.min(maxIndentation, indent);
      }
    }
  });

  if (maxIndentation !== null) {
    output = lines
      .map(l => (l[0] === ' ' ? l.slice(maxIndentation) : l))
      .join('\n');
  }

  return output.trim().replace(/\\n/g, '\n');
}
