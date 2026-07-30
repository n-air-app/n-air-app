import { Component } from 'vue';

import * as comps from './index';
import { TObsType } from './ObsInput';

type InputComponent = Component & { obsType: TObsType | TObsType[] };

const inputComponents = comps as unknown as Record<string, InputComponent>;

export function propertyComponentForType(type: TObsType | undefined): Component | undefined {
  if (type === undefined) return undefined;
  const component = Object.values(inputComponents).find((comp) => {
    const obsType = comp.obsType;
    return Array.isArray(obsType) ? obsType.includes(type) : obsType === type;
  });

  if (!component) {
    console.warn('Component not found. Type:', type);
  }

  return component;
}
