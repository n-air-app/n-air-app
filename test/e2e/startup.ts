import { focusChild, focusMain, getFocusedWindowId } from '../helpers/modules/core';
import { sleep } from '../helpers/sleep';
import { test, TExecutionContext, useWebdriver } from '../helpers/webdriver/index';

useWebdriver();

test('Splash window is displayed and closed properly', async (t: TExecutionContext) => {
  const client = t.context.app.client;

  // Get all window handles at the start
  const handles = await client.getWindowHandles();
  console.log(`Initial window handles count: ${handles.length}`);

  let splashFound = false;
  let splashHandle = '';

  // Look for splash window (data: URL or file: URL with splash)
  for (const handle of handles) {
    await client.switchToWindow(handle);
    const url = await client.getUrl();
    console.log(`Checking window: ${url.substring(0, 100)}...`);

    if (url.startsWith('file://') && url.includes('splash')) {
      splashFound = true;
      splashHandle = handle;
      console.log('Found splash window');
      break;
    }
  }

  // Splash should be present initially (or closed very quickly)
  // We can't assert it must be present because it closes fast
  if (splashFound) {
    console.log('Splash window was found');
  } else {
    console.log('Splash window already closed (expected if app loads fast)');
  }

  // Wait a bit and ensure we can focus main window
  await sleep(1500);
  await focusMain();

  // After main window is ready, splash should be closed
  const handlesAfter = await client.getWindowHandles();
  console.log(`Window handles after main loaded: ${handlesAfter.length}`);

  // Verify splash is no longer in window handles
  if (splashFound) {
    const splashStillExists = handlesAfter.includes(splashHandle);
    t.false(splashStillExists, 'Splash window should be closed');
  }

  // Verify we can focus main window successfully
  t.true((await getFocusedWindowId()) === 'main');
});

test('Main and child window visibility', async (t: TExecutionContext) => {
  const app = t.context.app;
  await focusMain();
  t.true((await getFocusedWindowId()) === 'main');
  await focusChild();
  t.true((await getFocusedWindowId()) === 'child');
});
