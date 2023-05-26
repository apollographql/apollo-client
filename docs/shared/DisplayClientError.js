// @ts-check
// this whole file

import React, { useEffect, useState, useMemo } from 'react';
// @ts-ignore
import { useHash as _useHash } from 'react-use';
// @ts-ignore
import { useMDXComponents } from '@mdx-js/react';

const useHash = typeof window !== 'undefined' ? _useHash : () => '#{}';

/**
 * @typedef {{ [key: number]: { file: string, condition?: string, message?: string }}} Messages
 */

async function loadData(version) {
  /** @type {{[key: string]: Messages}} */
  const invariantErrorCodes = await globalThis[
    Symbol.for('importInvariantErrorCodes')
  ](version);

  /** @type {Messages} */
  const data = {};
  for (const codes of Object.values(invariantErrorCodes)) {
    Object.assign(data, codes);
  }
  return data;
}

function useInjectLoaderScript() {
  // do not do this in SSR
  if (typeof window === 'undefined') return false;

  const scriptLoader = globalThis[Symbol.for('importInvariantErrorCodes')];
  const [scriptInitialized, setScriptInitialized] = useState(!!scriptLoader);
  useEffect(() => {
    if (scriptInitialized) {
      return;
    }
    if (scriptLoader) {
      setScriptInitialized(true);
      return;
    }
    addEventListener(
      'importInvariantErrorCodes',
      () => {
        setScriptInitialized(true);
      },
      { once: true }
    );
    addScript();
  }, []);

  return scriptInitialized;

  function addScript() {
    if (!document.querySelector('script#importInvariantErrorCodes')) {
      const script = document.createElement('script');
      script.id = 'importInvariantErrorCodes';
      script.type = 'module';
      script.textContent = `
        globalThis[Symbol.for("importInvariantErrorCodes")] = (version) => {
          if (!version || !/^[0-9a-zA-Z.-]+$/.test(version)) {
            throw 'Invalid Version!';
          }
          return import("https://cdn.jsdelivr.net/npm/@apollo/client@" + version + "/invariantErrorCodes.js");
        }
        dispatchEvent(new CustomEvent('importInvariantErrorCodes'));
        `;
      document.body.appendChild(script);
    }
  }
}

export default function DisplayClientError() {
  const MDX = /** @type {any} */ (useMDXComponents());

  const [hash] = useHash();
  const parsedHash = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(hash.substring(1)) || '{}');
    } catch {
      return { parsingError: 'Could not parse URL.' };
    }
  }, [hash]);
  const {
    version = 'latest',
    message: id = -1,
    args = [],
    parsingError,
  } = parsedHash;

  const [data, setData] = useState(
    /** @type {null | Messages | { dataError: string }} */ (null)
  );
  const scriptInitialized = useInjectLoaderScript();
  useEffect(() => {
    if (!scriptInitialized) return;
    let active = true;
    loadData(version)
      .then((data) => {
        if (active) setData(data);
      })
      .catch((dataError) => setData({ dataError }));
    return () => {
      active = false;
    };
  }, [version, scriptInitialized]);

  const {
    file,
    errorMessage,
    condition,
    error: dataError,
  } = useMemo(() => {
    if (!data)
      return {
        file: 'Loading...',
        errorMessage: 'Loading...',
        condition: 'Loading...',
      };

    if ('dataError' in data) {
      return { error: data.dataError };
    }

    if (!data[id]) {
      return { error: 'Error message could not be found!' };
    }
    let { file, condition, message: errorMessage } = data[id];

    if (errorMessage) {
      errorMessage = /** @type{string} */ (
        args.reduce(
          (/** @type{string} */ acc, arg) => acc.replace('%s', String(arg)),
          String(errorMessage)
        )
      );
    }

    return { file, condition, errorMessage };
  }, [data, id, args]);

  useEffect(() => {
    // replacing all links within this help page with spans to prevent them
    // from navigating the user to a different anchor
    for (const link of [...document.querySelectorAll('main h2 a, main h3 a')]) {
      var replacement = document.createElement('span');
      replacement.innerHTML = link.innerHTML;
      link.replaceWith(replacement);
    }
  }, []);

  if (hash.length === 0) {
    // the page was loaded without a hash, so we don't know what to display
    // just display the page itself without error information
    return null;
  }

  const error = dataError || parsingError;

  return (
    <div
      style={errorMessage == 'Loading...' ? { filter: 'blur(5px)' } : undefined}
    >
      {error ? (
        <>
          <MDX.h3>⚠️ Unable to fetch error code</MDX.h3>
          <MDX.blockquote>{error.toString()}</MDX.blockquote>
        </>
      ) : (
        <>
          {!errorMessage ? null : (
            <>
              <MDX.h2>Error message</MDX.h2>
              <MDX.blockquote>{errorMessage}</MDX.blockquote>
            </>
          )}
          {!file ? null : (
            <>
              <MDX.h3>File</MDX.h3>
              <MDX.inlineCode>{file}</MDX.inlineCode>
            </>
          )}
          {!condition ? null : (
            <>
              <MDX.h3>Condition</MDX.h3>
              <MDX.inlineCode>{condition}</MDX.inlineCode>
            </>
          )}
        </>
      )}
    </div>
  );
}
