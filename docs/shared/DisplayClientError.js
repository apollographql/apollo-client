import React, {useEffect} from 'react';
import {useMDXComponents} from '@mdx-js/react';

/** @returns {{ file: string, condition?: string, errorMessage?: string }} */
async function getErrorMessage(
  /** @type {string} */ version,
  /** @type {number} */ id,
  /** @type {unknown[]} */ args
) {
  /** @type {{ [key: string]: { [key: number]: { file: string, condition?: string, message?: string } }}} */
  const invariantErrorCodes = await window[
    Symbol.for('importInvariantErrorCodes')
  ](version);

  /** @type { [key: number]: { file: string, condition?: string, message?: string }} */
  const data = {};
  for (const codes of Object.values(invariantErrorCodes)) {
    Object.assign(data, codes);
  }
  if (!data[id]) {
    throw 'Error message could not be found!';
  }
  // eslint-disable-next-line prefer-const
  let {file, condition, message: errorMessage} = data[id];

  if (errorMessage) {
    errorMessage = /** @type{string} */ (
      args.reduce(
        (/** @type{string} */ acc, arg) => acc.replace('%s', String(arg)),
        String(errorMessage)
      )
    );
  }
  return {file, condition, errorMessage};
}

export default function DisplayClientError() {

  const MDX = useMDXComponents()

  const [{file, errorMessage, condition, error}, updateErrorDetails] =
    React.useState({
      file: '',
      errorMessage: '',
      condition: ''
    });
  const scriptRef = React.useRef(null);
  useEffect(() => {
    if (scriptRef.current.children.length === 0) {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent =`
        globalThis[Symbol.for("importInvariantErrorCodes")] = (version) => {
          if (!version || !/^[0-9a-zA-Z.-]+$/.test(version)) {
            throw 'Invalid Version!';
          }
          return import("https://cdn.jsdelivr.net/npm/@apollo/client@" + version + "/invariantErrorCodes.js");
        }
        `;
      scriptRef.current.appendChild(script);
    }

    let mounted = true;
    const listener = async () => {
      const hash = decodeURIComponent(location.hash.substring(1)) || '{}';
      const parsedHash = JSON.parse(hash);

      const {version = 'latest', message = -1, args = []} = parsedHash;

      try {
        const data = await getErrorMessage(version, message, args)
        if (!mounted) return;
        updateErrorDetails(data);
      } catch (e) {
        updateErrorDetails({error: String(e)});
      }
    };
    addEventListener('hashchange', listener);
    listener();
    return () => {
      mounted = false;
      removeEventListener('hashchange', listener);
    }
  }, []);
  return (
    <div>
      <div ref={scriptRef}></div>
      {error ? (
        <>
          <MDX.h3>
            ⚠️ Unable to fetch error code
          </MDX.h3>
          <MDX.blockquote>{error}</MDX.blockquote>
        </>
      ) : (
        <>
          {!errorMessage ? null : (
            <>
              <MDX.h2>
                Error message
              </MDX.h2>
              <MDX.blockquote>{errorMessage}</MDX.blockquote>
            </>
          )}
          {!file ? null : (
            <>
              <MDX.h3>
                File
              </MDX.h3>
              <MDX.inlineCode>{file}</MDX.inlineCode>
            </>
          )}
          {!condition ? null : (
            <>
              <MDX.h3>
                Condition
              </MDX.h3>
              <MDX.inlineCode>{condition}</MDX.inlineCode>
            </>
          )}
        </>
      )}
    </div>
  );
}
