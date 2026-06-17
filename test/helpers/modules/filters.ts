// Source helper functions
import { contextMenuClick } from '../webdriver/context-menu';
import { setFormDropdown, setFormInput } from '../webdriver/forms';

import { click, focusChild, focusMain, waitForDisplayed } from './core';
import { rightClickSource, selectSource } from './sources';

export async function openFiltersWindow(sourceName: string) {
  await focusMain();
  await selectSource(sourceName);
  await rightClickSource(sourceName);
  //await new Promise(x => setTimeout(x, 250));
  await contextMenuClick('Filters');
  await focusChild();
  // wait for the filters window to render
  await waitForDisplayed('[data-test="SourceFilters"]');
}

export async function openFilterProperties(sourceName: string, filterName: string) {
  await openFiltersWindow(sourceName);
  await click(`[data-test="${filterName}"]`);
}

export async function closeFilterProperties() {
  await focusChild();
  await click('[data-test="Done"]');
}

export async function addFilter(sourceName: string, filterType: string, filterName: string) {
  await openFiltersWindow(sourceName);
  await click('[data-test="Add"]');
  await setFormDropdown('[data-test=\'Form/List/type\']', filterType);
  if (filterType !== filterName) {
    await setFormInput('[data-test=\'Form/Text/name\']', filterName);
  }
  await click('[data-test="Done"]');
  await click('[data-test="Done"]');
}

export async function removeFilter(sourceName: string, filterName: string) {
  await openFiltersWindow(sourceName);
  await click(`[data-test="${filterName}"]`);
  await click('[data-test="Remove"]');
  await click('[data-test="Done"]');
}
