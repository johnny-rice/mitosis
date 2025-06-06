import { StencilPropOption, ToStencilOptions } from '@/generators/stencil/types';
import { dashCase } from '@/helpers/dash-case';
import { checkIsEvent, getEventNameWithoutOn } from '@/helpers/event-handlers';
import { renderPreComponent } from '@/helpers/render-imports';
import { MitosisComponent, MitosisState } from '@/types/mitosis-component';
import { MitosisNode } from '@/types/mitosis-node';

export const getTagName = (name: string, { prefix }: ToStencilOptions): string => {
  const dashName = dashCase(name);

  if (prefix) {
    const dashPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
    if (!dashName.startsWith(dashPrefix)) {
      return `${dashPrefix}${dashName}`;
    }
  }

  return dashName;
};

export const getPropsAsCode = ({
  props,
  propOptions,
  defaultProps,
  json,
}: {
  props: string[];
  json: MitosisComponent;
  defaultProps?: MitosisState | undefined;
  propOptions: Record<string, StencilPropOption>;
}): string => {
  const propsTypeRef: string | undefined = json.propsTypeRef;
  const internalTypes: string[] | undefined = json.types;
  const isInternalType =
    propsTypeRef && internalTypes && internalTypes.find((iType) => iType.includes(propsTypeRef));

  return props
    .map((item: string) => {
      const defaultProp: string | undefined = defaultProps ? defaultProps[item]?.code : undefined;
      const defaultPropString = defaultProp ? ` = ${defaultProp}` : '';
      const propOption = propOptions[item];

      const hasTyping =
        propsTypeRef &&
        propsTypeRef !== 'any' &&
        propsTypeRef !== 'unknown' &&
        propsTypeRef !== 'never' &&
        !isInternalType;

      if (checkIsEvent(item)) {
        // Stencil adds "on" to every `@Event` so we need to remove "on" from event props
        // https://stenciljs.com/docs/events#using-events-in-jsx
        const eventType = hasTyping
          ? `EventEmitter<Parameters<Required<${propsTypeRef}>["${item}"]>[number]> | void`
          : 'any';

        return `@Event() ${getEventNameWithoutOn(item)}: ${eventType}${defaultPropString}`;
      }

      const propType = hasTyping ? `${propsTypeRef}["${item}"]` : 'any';
      return `@Prop(${
        propOption ? JSON.stringify(propOption) : ''
      }) ${item}: ${propType}${defaultPropString}`;
    })
    .join(';\n');
};

/**
 * Check for root element if it needs a wrapping <Host>
 * @param children
 */
export const needsWrap = (children: MitosisNode[]): boolean => {
  if (children.length !== 1) {
    return true;
  } else if (children.length === 1) {
    const firstChild = children.at(0);
    if (firstChild?.name === 'Show' || firstChild?.name === 'For') {
      return true;
    }
  }

  return false;
};

/**
 * Dynamically creates all imports from `@stencil/core`
 * @param wrap
 * @param events
 * @param props
 * @param dataString
 * @param watch
 */
export const getStencilCoreImportsAsString = ({
  wrap,
  events,
  props,
  dataString,
  watch,
}: {
  wrap: boolean;
  events: string[];
  props: string[];
  dataString: string;
  watch: boolean;
}): string => {
  const stencilCoreImports: Record<string, boolean> = {
    Component: true,
    h: true,
    Fragment: true,
    Host: wrap,
    Watch: watch,
    Event: events.length > 0,
    EventEmitter: events.length > 0,
    Prop: props.length > 0,
    State: dataString.length > 0,
  };
  return Object.entries(stencilCoreImports)
    .map(([key, bool]) => (bool ? key : ''))
    .filter((key) => !!key)
    .join(', ');
};

export const getImports = (
  json: MitosisComponent,
  options: ToStencilOptions,
  childComponents: string[],
) => {
  return renderPreComponent({
    explicitImportFileExtension: options.explicitImportFileExtension,
    component: json,
    target: 'stencil',
    excludeExportAndLocal: true,
    importMapper: (_: any, theImport: any, importedValues: any) => {
      const childImport = importedValues.defaultImport;
      if (childImport && childComponents.includes(childImport)) {
        return `import {${childImport}} from '${theImport.path}';`;
      }

      return undefined;
    },
  });
};

/**
 * Converts the deps string into an array of strings
 * @param deps The hook dependencies as string e.g.: "[this.a,this.b]"
 */
export const getDepsAsArray = (deps: string): string[] => {
  return deps
    .replace('[', '')
    .replace(']', '')
    .replaceAll('this.', '')
    .split(',')
    .map((dep) => dep.trim());
};

export const getExportsAndLocal = (json: MitosisComponent) => {
  return Object.entries(json.exports || {})
    .map(([key, { usedInLocal, code }]) => {
      if (usedInLocal) {
        return `${key} = ${code.substring(code.indexOf('=') + 1)}`;
      }

      return '';
    })
    .join('\n');
};
