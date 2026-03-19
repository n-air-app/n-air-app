import { focusMain } from '../helpers/modules/core';
import { addScene } from '../helpers/modules/scenes';
import {
  addExistingSource,
  addSource,
  clickRemoveSource,
  selectSource,
} from '../helpers/modules/sources';
import { test, useWebdriver } from '../helpers/webdriver';

useWebdriver();

test('Adding and removing a AudioSource', async t => {
  const client = t.context.app.client;

  await addSource('ffmpeg_source', 'Source With Audio');
  await addSource('color_source', 'Source Without Audio');
  await focusMain();

  t.true(await client.$('.mixer-panel').$('div=Source With Audio').isExisting());
  t.false(await client.$('.mixer-panel').$('div=Source Without Audio').isExisting());

  await selectSource('Source With Audio');
  await clickRemoveSource('Source With Audio');

  await client
    .$('.mixer-panel')
    .$('div=Source With Audio')
    .waitForExist({ timeout: 5000, reverse: true });
});

test('Nested scenes should provide audio sources to mixer', async t => {
  const client = t.context.app.client;

  await addScene('1st Scene');
  await addSource('ffmpeg_source', 'Nested Media Source');
  await focusMain();

  await addScene('2nd Scene');
  await addSource('ffmpeg_source', 'Simple Media Source');
  await addExistingSource('scene', '1st Scene');

  await focusMain();
  t.true(await client.$('.mixer-panel').$('div=Simple Media Source').isExisting());
  t.true(await client.$('.mixer-panel').$('div=Nested Media Source').isExisting());
});

test('Mixer volume slider and mute functionality', async t => {
  const client = t.context.app.client;

  await addSource('ffmpeg_source', 'Audio Test Source');
  await focusMain();

  const mixerItem = await client.$('[data-test-source-name="Audio Test Source"]');

  // Test slider interaction
  const slider = await mixerItem.$('input[type="range"]');
  t.true(await slider.isExisting());

  // Get initial slider value
  const initialValue = await slider.getValue();
  t.is(initialValue, '1', 'Initial volume should be 1 (100%)');

  // Set slider value to 50%
  await slider.setValue('0.5');

  // Verify slider value changed
  const sliderValue = await slider.getValue();
  const numValue = parseFloat(sliderValue);
  t.is(numValue, 0.5, 'Slider value should be 0.5 after adjustment');

  // Test mute functionality
  const speakerIcon = await mixerItem.$('.icon-speaker');
  t.true(await speakerIcon.isExisting());

  // Click speaker icon to mute
  await speakerIcon.click();

  // Verify muted state
  const mixerItemClass = await mixerItem.getAttribute('class');
  t.true(mixerItemClass.includes('muted'), 'Mixer item should have muted class');
  t.true(await mixerItem.$('.icon-mute').isExisting(), 'Mute icon should be visible');
  t.false(await speakerIcon.isExisting(), 'Speaker icon should be hidden');

  // Click mute icon to unmute
  const muteIcon = await mixerItem.$('.icon-mute');
  await muteIcon.click();

  // Verify unmuted state
  const mixerItemClassAfter = await mixerItem.getAttribute('class');
  t.false(mixerItemClassAfter.includes('muted'), 'Mixer item should not have muted class');
  t.true(await speakerIcon.isExisting(), 'Speaker icon should be visible');
  t.false(await muteIcon.isExisting(), 'Mute icon should be hidden');
});
