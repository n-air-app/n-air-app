import merge from 'lodash/merge';

interface Table {
  [serviceName: string]: any;
}
interface Factory {
  (): { [serviceName: string]: any };
}

export function createSetupFunction({
  injectee: defaultInjectee = {},
  state: defaultState = {},
}: {
  injectee?: Table;
  state?: Table;
} = {}) {
  return function setup({
    injectee: injecteeFactory = {},
    state: stateFactory = {},
  }: { injectee?: Table | Factory; state?: Table | Factory } = {}) {
    const state = typeof stateFactory === 'function' ? stateFactory() : stateFactory;
    const injectee = typeof injecteeFactory === 'function' ? injecteeFactory() : injecteeFactory;
    const mockedStatefulService = require('services/core/stateful-service');
    const mockedInjectorUtil = require('services/core/injector');
    if (typeof mockedStatefulService.__setup !== 'function') {
      throw new Error("`jest.mock('services/core/stateful-service')` が必要です");
    }
    if (typeof mockedInjectorUtil.__setup !== 'function') {
      throw new Error("`jest.mock('services/core/injector')` が必要です");
    }
    mockedStatefulService.__setup(merge({}, defaultState, state));
    mockedInjectorUtil.__setup(merge({}, defaultInjectee, injectee));
  };
}
