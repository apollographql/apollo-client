import React from "react";
import { Global } from "@emotion/react";
import { Grid } from "@chakra-ui/react";

/**
 * This component is actually over in the docs repo, just repeated here so the
 * styles are visible.
 */
export function ResponsiveGridStyles() {
  return (
    <Global
      styles={{
        ".responsive-grid .row": {
          gridColumnStart: 1,
          gridColumnEnd: -1,
        },
        ".responsive-grid details": {
          display: "contents",
        },
        ".responsive-grid .first.cell": {
          gridColumnStart: 1,
        },
        ".responsive-grid .cell": {
          gridColumnEnd: "span 1",
        },
        ".responsive-grid details .cell": {
          gridColumnStart: 1,
          gridColumnEnd: -1,
        },

        ".responsive-grid": {
          background: "var(--chakra-colors-border)",
          gap: "1px",
        },
        ".responsive-grid > *, .responsive-grid > details > *": {
          background: "var(--chakra-colors-bg)",
        },
        ".responsive-grid .cell, .responsive-grid .row": {
          padding: "var(--chakra-space-4)",
        },
        ".responsive-grid details .first.cell + .cell": {
          marginTop: -1,
          paddingTop: 0,
        },
        ".responsive-grid details h6": {
          display: "inline",
        },
        ".responsive-grid .heading": {
          fontFamily: "var(--chakra-fonts-heading)",
          fontWeight: "var(--chakra-fontWeights-normal)",
          textTransform: "uppercase",
          letterSpacing: "var(--chakra-letterSpacings-wider)",
          fontSize: "var(--chakra-fontSizes-xs)",
        },
      }}
    />
  );
}

export function ResponsiveGrid({ children, columns = 2 }) {
  /*
        responsiveness not regarding screen width, but actual available space:
        if less than 350px, show only one column
        show at most two columns (that's where the 45% hack comes - 45% * 3 won't fit)
       */

  return (
    <Grid
      templateColumns={
        columns == 2 ?
          "repeat(auto-fit, minmax(max(350px, 45%), 1fr))"
        : columns
      }
      className="responsive-grid"
      borderWidth="1px"
      rounded="md"
    >
      {children}
    </Grid>
  );
}
