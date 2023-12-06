import InlineCode from '../InlineCode';
import PropTypes from 'prop-types';
import React from 'react';
import {GridItem, chakra} from '@chakra-ui/react';
import {PropertySignatureTable, useApiDocContext} from '.';
import {ResponsiveGrid} from './ResponsiveGrid';
import {mdToReact} from './mdToReact';

export function ParameterTable({canonicalReference}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  if (item.parameters.length === 0) return null;

  return (
    <>
      <GridItem className="row">
        <chakra.h6
          mb="4"
          fontWeight="bold"
          textTransform="uppercase"
          fontSize="sm"
          letterSpacing="wider"
        >
          Parameters
        </chakra.h6>
      </GridItem>
      <ResponsiveGrid>
        <GridItem className="first cell heading">Name / Type</GridItem>
        <GridItem className="cell heading">Description</GridItem>

        {item.parameters.map(parameter => {
          const baseType = parameter.type.split('<')[0];
          const reference = getItem(
            item.references?.find(r => r.text === baseType)?.canonicalReference,
            false
          );
          const interfaceReference =
            reference?.kind === 'Interface' ? reference : null;

          return (
            <React.Fragment key={parameter.id}>
              <GridItem
                className="first cell"
                fontSize="md"
                sx={{code: {bg: 'none', p: 0}}}
                borderBottom={interfaceReference ? 'none' : undefined}
              >
                <chakra.h6 fontSize="lg" mb="1">
                  <InlineCode>{parameter.name}</InlineCode>
                  {parameter.optional ? <em> (optional)</em> : null}
                </chakra.h6>
                <InlineCode color="tertiary">{parameter.type}</InlineCode>
              </GridItem>
              <GridItem
                className="cell"
                fontSize="md"
                lineHeight="base"
                borderBottom={interfaceReference ? 'none' : undefined}
              >
                {mdToReact(parameter.comment)}
              </GridItem>
              {interfaceReference && (
                <details>
                  <GridItem as="summary" className="row">
                    Show/hide child attributes
                  </GridItem>
                  <PropertySignatureTable
                    canonicalReference={interfaceReference.canonicalReference}
                    display="child"
                    prefix={`${parameter.name}.`}
                    showHeaders={false}
                  />
                </details>
              )}
            </React.Fragment>
          );
        })}
      </ResponsiveGrid>
    </>
  );
}

ParameterTable.propTypes = {
  canonicalReference: PropTypes.string.isRequired
};
