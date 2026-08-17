import { click, focusChild, focusMain } from '../helpers/modules/core';
import { test, useWebdriver } from '../helpers/webdriver/index';

useWebdriver();

test('Dropdown interaction in output settings', async (t) => {
  const client = t.context.app.client;

  await focusMain();
  await click('[data-test="OpenSettings"]');

  await focusChild();
  await click('[data-test="Settings"] [data-test="SideMenu"] [data-test="Output"]');

  // 画面の準備ができるまで待つ
  await client.pause(500);

  // 出力モードのDropdownを取得（class="dropdown"のものが実際のDropdownコンポーネント）
  const modeDropdowns = await client.$$('[data-test="Form/List/Mode"]');

  let dropdown = null;
  let initialValue = null;

  for (const dd of modeDropdowns) {
    const className = await dd.getAttribute('class');

    // class="dropdown"を持つものが実際のDropdownコンポーネント
    if (className && className.includes('dropdown')) {
      dropdown = dd;
      initialValue = await dd.getAttribute('data-selected-option-label');
      break;
    }
  }

  t.truthy(dropdown, 'Expected to find Mode dropdown with class="dropdown"');
  t.truthy(initialValue, 'Expected Mode dropdown to have an initial value');

  // ドロップダウンを開く
  await dropdown!.click();
  await client.pause(500);

  // ドロップダウンメニューが表示されるまで待つ
  await client.$('.dropdown__menu').waitForDisplayed({ timeout: 3000 });

  // オプションが表示されることを確認
  const options = await dropdown!.$$('.dropdown__item[data-option-label]');
  t.true(options.length > 0, 'Expected dropdown to have options');

  // 現在選択されていない別のオプションを探して選択
  let targetOption = null;
  let targetLabel = '';

  for (const option of options) {
    const label = await option.getAttribute('data-option-label');
    if (label !== initialValue) {
      targetOption = option;
      targetLabel = label;
      break;
    }
  }

  if (targetOption) {
    const optionSpan = await targetOption.$('.dropdown__option');
    await optionSpan.click();
    await client.pause(500);

    // 選択された値が更新されることを確認
    const selectedLabel = await dropdown!.getAttribute('data-selected-option-label');
    t.is(selectedLabel, targetLabel, 'Expected dropdown value to be updated');
  }
});

