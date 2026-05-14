import { CompactModeService } from 'services/compact-mode';
import { SceneCollectionsService } from 'services/scene-collections';

import { sleep } from '../../app/util/sleep';
import { getApiClient } from '../helpers/api-client';
import { click, focusMain, isDisplayed, waitForDisplayed } from '../helpers/modules/core';
import { test, TExecutionContext, useWebdriver } from '../helpers/webdriver/index';

useWebdriver();

// pnpm compile-tests && npx ava test-dist/test/e2e/popper.js -v -s

test('Popper basic functionality', async (t: TExecutionContext) => {
  const client = await getApiClient();
  const sceneCollectionsService = client.getResource<SceneCollectionsService>('SceneCollectionsService');
  const compactModeService = client.getResource<CompactModeService>('CompactModeService');

  // コンパクトモードを無効にする（シーンコレクションドロップダウンを表示するため）
  compactModeService.isCompactMode = false;
  await sleep(200);

  // 複数のシーンコレクションを作成してドロップダウンをテスト可能にする
  await sceneCollectionsService.create({ name: 'Test Collection 1' });
  await sceneCollectionsService.create({ name: 'Test Collection 2' });
  await sleep(200);

  await focusMain();

  // シーンコレクション切り替えボタンが表示されてクリック可能になるまで待つ
  const webdriverClient = await import('../helpers/modules/core').then((m) => m.getClient());
  const toggleButton = await webdriverClient.$('.scene-collections__toggle');
  await toggleButton.waitForDisplayed({ timeout: 10000 });
  await toggleButton.waitForClickable({ timeout: 10000 });

  // Vueコンポーネントのマウントとイベントリスナー登録を待つ
  await sleep(1000);

  // テスト1: ポップアップを開いて項目を選択できる
  await toggleButton.click();
  await sleep(1000); // クリック後、nextTick待ち（CI環境では長めに）
  await waitForDisplayed('.scene-collections-menu');
  t.true(await isDisplayed('.scene-collections-menu'));
  t.true(await isDisplayed('.scene-collections-menu__item'));

  await click('.scene-collections-menu__item');
  await sleep(100);
  t.false(await isDisplayed('.scene-collections-menu'));

  // テスト2: もう一度クリックするとポップアップが閉じる（トグル動作）
  await click('.scene-collections__toggle');
  await sleep(300);
  await waitForDisplayed('.scene-collections-menu');
  t.true(await isDisplayed('.scene-collections-menu'));

  await click('.scene-collections__toggle');
  await sleep(100);
  t.false(await isDisplayed('.scene-collections-menu'));

  // テスト3: 外側をクリックするとポップアップが閉じる
  await click('.scene-collections__toggle');
  await sleep(300);
  await waitForDisplayed('.scene-collections-menu');
  t.true(await isDisplayed('.scene-collections-menu'));

  await click('[data-test="SceneSelector"]');
  await sleep(100);
  t.false(await isDisplayed('.scene-collections-menu'));

  // テスト4: ポップアップの位置が正しい（bottom-start）
  await click('.scene-collections__toggle');
  await sleep(300);
  await waitForDisplayed('.scene-collections-menu');

  const webdriver = await import('../helpers/modules/core').then((m) => m.getClient());
  const button = await webdriver.$('.scene-collections__toggle');
  const dropdown = await webdriver.$('.scene-collections-menu');

  const buttonRect = await button.getLocation();
  const dropdownRect = await dropdown.getLocation();

  t.true(dropdownRect.y > buttonRect.y, 'Dropdown should be below button');
  t.true(
    Math.abs(dropdownRect.x - buttonRect.x) < 50,
    'Dropdown should be aligned to the left of button',
  );

  t.pass();
});
