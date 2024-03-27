import test from 'ava';
import { useSpectron, focusMain, focusChild } from '../helpers/spectron/index';
import {
  addSource,
  addExistingSource,
  clickRemoveSource,
  selectSource,
  sourceIsExisting,
  waitForSourceExist,
  clickAddSource,
} from '../helpers/spectron/sources';

import { addScene } from '../helpers/spectron/scenes';

useSpectron();

const sourceType = 'nair-rtvc-source';

// CI対応のため一時的に中止
test('rtvc Adding and removing source', async t => {
  const sourceName = `Example ${sourceType}`;
  console.log('b1');
  await addSource(t, sourceType, sourceName);
  console.log('b2');

  await focusMain(t);
  console.log('b3');

  t.true(await sourceIsExisting(t, sourceName));
  console.log('b4');

  await selectSource(t, sourceName);
  console.log('b5');
  await clickRemoveSource(t);
  console.log('b6');

  await waitForSourceExist(t, sourceName, true);
  console.log('b7');
});

// CI対応のため一時的に中止
test('rtvc Check conditions that can be added', async t => {
  const sourceName = `Example ${sourceType}`;

  // add rtvc source
  await addSource(t, sourceType, sourceName);
  await focusMain(t);
  t.true(await sourceIsExisting(t, sourceName));

  // can not add more rtvc source
  const app = t.context.app;
  await focusMain(t);
  await clickAddSource(t);
  await focusChild(t);
  await app.client.click(`[data-test="${sourceType}"`);
  t.true((await app.client.$('[data-test="AddSource"]').getAttribute('disabled')) === 'true');
  // can add other souce
  await app.client.click(`[data-test="image_source"`);
  t.true((await app.client.$('[data-test="AddSource"]').getAttribute('disabled')) === null);
  // close
  await app.client.click('[data-test="titlebar-close"]');

  // when other scene, can add rtvc source
  await focusMain(t);
  await addScene(t, 's2');
  await addExistingSource(t, sourceType, sourceName);
  await focusMain(t);
  t.true(await sourceIsExisting(t, sourceName));
});
