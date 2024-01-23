import React from "react";
import { useMDXComponents } from "@mdx-js/react";
import { useApiDocContext, PropertySignatureTable } from ".";
import PropTypes from "prop-types";

export function ManualTuple({ elements = [], idPrefix = "" }) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();

  return (
    <MDX.table>
      <MDX.thead>
        <MDX.tr>
          <MDX.td>Name</MDX.td>
          <MDX.td>Type</MDX.td>
          <MDX.td>Description</MDX.td>
        </MDX.tr>
      </MDX.thead>
      <MDX.tbody>
        {elements.map(
          ({ name, type, description, canonicalReference }, idx) => {
            const item = getItem(canonicalReference);
            const separatorStyle = item ? { borderBottom: 0 } : {};
            return (
              <React.Fragment key={idx}>
                <MDX.tr>
                  <MDX.td style={separatorStyle}>{name}</MDX.td>
                  <MDX.td style={separatorStyle}>
                    <code className="language-ts">{type}</code>
                  </MDX.td>
                  <MDX.td style={separatorStyle}>{description}</MDX.td>
                </MDX.tr>
                {item ?
                  <MDX.tr>
                    <MDX.td colSpan="3">
                      <details>
                        <summary>Show/hide child attributes</summary>
                        <PropertySignatureTable
                          canonicalReference={canonicalReference}
                          idPrefix={
                            idPrefix ?
                              `${idPrefix}-${name.toLowerCase()}`
                            : undefined
                          }
                        />
                      </details>
                    </MDX.td>
                  </MDX.tr>
                : null}
              </React.Fragment>
            );
          }
        )}
      </MDX.tbody>
    </MDX.table>
  );
}
ManualTuple.propTypes = {
  elements: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.oneOfType([PropTypes.node, PropTypes.string])
        .isRequired,
      canonicalReference: PropTypes.string,
    })
  ).isRequired,
};
