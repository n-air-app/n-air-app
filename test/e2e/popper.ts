import { CompactModeService } from 'services/compact-mode';
import { SceneCollectionsService } from 'services/scene-collections';
import { sleep } from '../../app/util/sleep';
import { getApiClient } from '../helpers/api-client';
import { click, focusMain, isDisplayed, waitForDisplayed } from '../helpers/modules/core';
import { TExecutionContext, test, useWebdriver } from '../helpers/webdriver/index';

useWebdriver();

// pnpm compile-tests && npx ava test-dist/test/e2e/popper.js -v -s

test('Popper basic functionality', async (t: TExecutionContext) => {
  const client = await getApiClient();
  const sceneCollectionsService =
    client.getResource<SceneCollectionsService>('SceneCollectionsService');
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
  const webdriverClient = await import('../helpers/modules/core').then(m => m.getClient());
  const toggleButton = await webdriverClient.$('.scene-collections__toggle');
  console.log('[Popper Test] Waiting for toggle button to be displayed...');
  await toggleButton.waitForDisplayed({ timeout: 10000 });
  console.log('[Popper Test] Toggle button displayed');
  await toggleButton.waitForClickable({ timeout: 10000 });
  console.log('[Popper Test] Toggle button clickable');

  // Vueコンポーネントのマウントとイベントリスナー登録を待つ
  console.log('[Popper Test] Waiting for Vue component to be fully mounted...');
  await sleep(1000);
  console.log('[Popper Test] Vue component should be ready');

  // デバッグ: Popperコンポーネントの存在確認
  const popperComponent = await webdriverClient.$('.scene-collections__dropdown');
  const popperExists = await popperComponent.isExisting();
  console.log('[Popper Test] Popper component exists:', popperExists);

  if (popperExists) {
    const popperHtml = await popperComponent.getHTML();
    console.log('[Popper Test] Popper HTML:', popperHtml.substring(0, 300));
  }

  // テスト1: ポップアップを開いて項目を選択できる
  console.log('[Popper Test] Clicking toggle button...');
  await toggleButton.click();
  console.log('[Popper Test] Toggle button clicked');
  await sleep(1000); // クリック後、nextTick待ち（CI環境では長めに）
  console.log('[Popper Test] Waited 1000ms after click');

  // デバッグ: ドロップダウンメニューが存在するか確認
  const dropdownMenu = await webdriverClient.$('.scene-collections-menu');
  const exists = await dropdownMenu.isExisting();
  console.log('[Popper Test] Dropdown menu exists:', exists);

  if (exists) {
    const displayed = await dropdownMenu.isDisplayed();
    console.log('[Popper Test] Dropdown menu displayed:', displayed);
    const html = await dropdownMenu.getHTML();
    console.log('[Popper Test] Dropdown menu HTML:', html.substring(0, 200));
  }

  console.log('[Popper Test] Waiting for dropdown menu to be displayed...');
  await waitForDisplayed('.scene-collections-menu');
  console.log('[Popper Test] Dropdown menu is now displayed');
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

  const webdriver = await import('../helpers/modules/core').then(m => m.getClient());
  const button = await webdriver.$('.scene-collections__toggle');
  const dropdown = await webdriver.$('.scene-collections-menu');

  const buttonRect = await button.getLocation();
  const dropdownRect = await dropdown.getLocation();

  // bottom-start なので、ドロップダウンはボタンの下、左端揃えで表示される
  t.true(dropdownRect.y > buttonRect.y, 'Dropdown should be below button');
  // 左端が揃っている（多少の誤差は許容）
  t.true(
    Math.abs(dropdownRect.x - buttonRect.x) < 50,
    'Dropdown should be aligned to the left of button',
  );

  t.pass();
});
