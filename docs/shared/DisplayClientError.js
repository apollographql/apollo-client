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

/**
 * @param version {string}
 * @param messageId {number}
 * @returns {{data: null; loading: true; error: null} | {data: Messages[number]; loading: false; error: null}| {data: null; loading: false; error: Error}}
 */
function useLoadedErrorMessage(version, messageId) {
  const [state, setState] = useState(
    /** @type {{data: null; loading: true; error: null} | {data: Messages[number]; loading: false; error: null}| {data: null; loading: false; error: Error}} */ ({
      data: null,
      loading: true,
      error: null,
    })
  );

  const scriptInitialized = useInjectLoaderScript();

  useEffect(() => {
    if (!scriptInitialized) return;
    let active = true;

    loadData(version)
      .then((data) => {
        if (!active) {
          return;
        }

        const details = data[messageId];

        setState(
          details
            ? { loading: false, error: null, data: details }
            : {
                loading: false,
                error: new Error('Error message could not be found.'),
                data: null,
              }
        );
      })
      .catch((error) => setState({ error, loading: false, data: null }));

    return () => {
      active = false;
    };
  }, [version, scriptInitialized]);

  return state;
}

function UnexpectedError({ message }) {
  const MDX = /** @type {any} */ (useMDXComponents());

  return (
    <>
      <MDX.h3>⚠️ Unable to fetch error code</MDX.h3>
      <MDX.blockquote>{message}</MDX.blockquote>
    </>
  );
}

function ErrorDetails({ version, messageId, args }) {
  const MDX = /** @type {any} */ (useMDXComponents());
  const { data, loading, error } = useLoadedErrorMessage(version, messageId);
  const errorMessage = useMemo(() => {
    return data?.message
      ? args.reduce(
          (/** @type{string} */ acc, arg) => acc.replace(/%[sdfo]/, String(arg)),
          String(data.message)
        )
      : null;
  }, [data]);

  if (error) {
    return <UnexpectedError message={error.toString()} />;
  }

  return (
    <div style={{ filter: loading ? 'blur(5px)' : undefined }}>
      {(loading || errorMessage) && (
        <>
          <MDX.h2>Error message</MDX.h2>
          <MDX.blockquote style={{ lineHeight: "normal", whiteSpace: "pre-wrap" }}>{loading ? 'Loading' : errorMessage}</MDX.blockquote>
        </>
      )}

      <MDX.h3>File</MDX.h3>
      <MDX.inlineCode>{loading ? 'Loading' : data.file}</MDX.inlineCode>

      <div style={{visibility: data?.condition ? 'visible' : 'hidden'}}>
        <MDX.h3>Condition</MDX.h3>
        <MDX.inlineCode>{data?.condition || ''}</MDX.inlineCode>
      </div>
    </div>
  );
}

/**
 * @param hash {string}
 */
function useErrorDetailsFromHash(hash) {
  return useMemo(() => {
    try {
      return {
        data: JSON.parse(decodeURIComponent(hash.substring(1)) || '{}'),
      };
    } catch {
      return { error: 'Could not parse URL.' };
    }
  }, [hash]);
}

export default function DisplayClientError() {
  const [hash] = useHash();
  const { data, error } = useErrorDetailsFromHash(hash);

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

  return error ? (
    <UnexpectedError message={error} />
  ) : (
    <ErrorDetails
      version={data.version || 'latest'}
      messageId={data.message || -1}
      args={data.args || []}
    />
  );
}
