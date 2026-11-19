import type { HotkeysService } from 'services/hotkeys';
import type { ScenesService } from 'services/scenes';

import { getApiClient } from '../helpers/api-client';
import { focusMain } from '../helpers/modules/core';
import { addScene, DefaultSceneName, selectScene } from '../helpers/modules/scenes';
import { pressF24 } from '../helpers/native-key-input';
import { test, useWebdriver } from '../helpers/webdriver';

useWebdriver();

test('A native hotkey switches to the bound scene', async (t) => {
  const sceneName = 'Hotkey target';
  await addScene(sceneName);
  await focusMain();

  const api = await getApiClient();
  const scenes = api.getResource<ScenesService>('ScenesService');
  const hotkeys = api.getResource<HotkeysService>('HotkeysService');
  const targetSceneId = scenes.activeSceneId;
  await selectScene(DefaultSceneName);
  t.true(scenes.activeSceneId !== targetSceneId, 'The target must not already be active');

  await hotkeys.applyHotkeySet({
    general: [],
    sources: {},
    scenes: {
      [targetSceneId]: [{
        actionName: 'SWITCH_TO_SCENE',
        sceneId: targetSceneId,
        bindings: [{
          key: 'F24',
          modifiers: { alt: false, ctrl: false, shift: false, meta: false },
        }],
      }],
    },
  });
  await pressF24();
  await t.context.app.client.waitUntil(() => scenes.activeSceneId === targetSceneId, {
    timeout: 5000,
    timeoutMsg: 'Pressing F24 did not switch to the bound scene through the native hotkey',
  });
  t.is(scenes.activeSceneId, targetSceneId);
});
