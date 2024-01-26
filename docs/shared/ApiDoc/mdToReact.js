import PropTypes from "prop-types";
import React from "react";
import ReactMarkdown from "react-markdown";
import { useMDXComponents } from "@mdx-js/react";

export function mdToReact(text) {
  const sanitized = text
    .replace(/\{@link (\w*)\}/g, "[$1](#$1)")
    .replace(/<p\s?\/>/g, "");
  return <RenderMd markdown={sanitized} />;
}

function RenderMd({ markdown }) {
  return (
    <ReactMarkdown components={useMDXComponents()}>{markdown}</ReactMarkdown>
  );
}
RenderMd.propTypes = {
  markdown: PropTypes.string.isRequired,
};
