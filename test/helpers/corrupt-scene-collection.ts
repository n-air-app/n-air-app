/**
 * Test helper functions to create corrupted scene collection files for testing error handling
 */

/**
 * Creates a minimal valid scene collection for testing
 */
export function createValidSceneCollection(): any {
  return {
    schemaVersion: 1,
    nodeType: 'RootNode',
    sources: {
      schemaVersion: 3,
      nodeType: 'SourcesNode',
      items: [
        {
          id: 'text_source_1',
          name: 'Test Text',
          type: 'text_gdiplus',
          settings: {
            text: 'Hello World',
            font: { face: 'Arial', size: 24, flags: 0 },
          },
          volume: 1,
          hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
          muted: false,
          filters: { items: [] },
          propertiesManager: 'default',
          propertiesManagerSettings: {},
        },
        {
          id: 'image_source_1',
          name: 'Test Image',
          type: 'image_source',
          settings: {
            file: 'C:\\test\\image.png',
            unload: false,
          },
          volume: 1,
          hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
          muted: false,
          filters: { items: [] },
          propertiesManager: 'default',
          propertiesManagerSettings: {},
        },
      ],
    },
    scenes: {
      schemaVersion: 1,
      nodeType: 'ScenesNode',
      items: [
        {
          id: 'scene_1',
          name: 'Test Scene',
          sceneItems: {
            schemaVersion: 1,
            nodeType: 'SceneItemsNode',
            items: [
              {
                id: 'sceneitem_1',
                sourceId: 'text_source_1',
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                visible: true,
                crop: { top: 0, bottom: 0, left: 0, right: 0 },
                locked: false,
                hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
                rotation: 0,
              },
            ],
          },
          hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
          filters: { schemaVersion: 1, nodeType: 'SceneFiltersNode', items: [] },
          active: true,
        },
      ],
    },
    transition: {
      schemaVersion: 1,
      nodeType: 'TransitionNode',
      type: 'cut_transition',
      duration: 300,
      settings: {},
    },
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
  };
}

/**
 * Creates a scene collection with an invalid source type
 * This will cause the source to fail loading while other sources succeed
 */
export function createSceneCollectionWithInvalidSourceType(): any {
  const collection = createValidSceneCollection();
  collection.sources.items.push({
    id: 'invalid_source_1',
    name: 'Invalid Source',
    type: 'nonexistent_source_type', // This type doesn't exist in OBS
    settings: {},
    volume: 1,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    muted: false,
    filters: { items: [] },
    propertiesManager: 'default',
    propertiesManagerSettings: {},
  });
  return collection;
}

/**
 * Creates a scene collection with a dshow_input (webcam) source that references a nonexistent device
 * This simulates a user loading a scene collection when their webcam is not connected
 */
export function createSceneCollectionWithMissingDevice(): any {
  const collection = createValidSceneCollection();
  collection.sources.items.push({
    id: 'dshow_missing_device',
    name: 'Missing Webcam',
    type: 'dshow_input',
    settings: {
      active: true,
      video_device_id: 'NonexistentCamera:\\\\?\\usb#22vid_0000&pid_0000#22{guid}\\global',
      audio_device_id: 'NonexistentMicrophone:',
      res_type: 1,
      resolution: '1280x720',
    },
    volume: 1,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    muted: false,
    filters: { items: [] },
    propertiesManager: 'default',
    propertiesManagerSettings: {},
    forceMono: false,
    syncOffset: { sec: 0, nsec: 0 },
    audioMixers: 255,
    monitoringType: 0,
  });
  return collection;
}

/**
 * Creates a scene collection with invalid settings for a source
 * This may cause the source to fail loading depending on OBS validation
 */
export function createSceneCollectionWithInvalidSettings(): any {
  const collection = createValidSceneCollection();
  collection.sources.items[0].settings = {
    // Missing required 'text' field for text_gdiplus
    font: { face: 'Arial', size: -100, flags: 999 }, // Invalid font size and flags
    invalidField: 'this should not be here',
  };
  return collection;
}

/**
 * Creates a scene collection with a scene item referencing a non-existent source
 * This will cause the scene item to fail loading while the scene itself might succeed
 */
export function createSceneCollectionWithMissingSourceReference(): any {
  const collection = createValidSceneCollection();
  collection.scenes.items[0].sceneItems.items.push({
    id: 'sceneitem_invalid',
    sourceId: 'nonexistent_source_id', // This source doesn't exist
    x: 100,
    y: 100,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    crop: { top: 0, bottom: 0, left: 0, right: 0 },
    locked: false,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    rotation: 0,
  });
  return collection;
}

/**
 * Creates a scene collection with invalid filter settings
 * This will cause the filter to fail loading while the source succeeds
 */
export function createSceneCollectionWithInvalidFilter(): any {
  const collection = createValidSceneCollection();
  collection.sources.items[0].filters = {
    items: [
      {
        id: 'filter_1',
        name: 'Invalid Filter',
        type: 'nonexistent_filter_type',
        settings: {},
        enabled: true,
      },
    ],
  };
  return collection;
}

/**
 * Creates a scene collection with multiple errors across different elements
 * Useful for testing that all errors are collected and reported
 */
export function createSceneCollectionWithMultipleErrors(): any {
  const collection = createValidSceneCollection();

  // Add invalid source type
  collection.sources.items.push({
    id: 'invalid_source_1',
    name: 'Invalid Source 1',
    type: 'nonexistent_type_1',
    settings: {},
    volume: 1,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    muted: false,
    filters: { items: [] },
    propertiesManager: 'default',
    propertiesManagerSettings: {},
  });

  // Add another invalid source
  collection.sources.items.push({
    id: 'invalid_source_2',
    name: 'Invalid Source 2',
    type: 'nonexistent_type_2',
    settings: {},
    volume: 1,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    muted: false,
    filters: { items: [] },
    propertiesManager: 'default',
    propertiesManagerSettings: {},
  });

  // Add scene with invalid source reference
  collection.scenes.items[0].sceneItems.items.push({
    id: 'sceneitem_invalid',
    sourceId: 'nonexistent_source',
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    crop: { top: 0, bottom: 0, left: 0, right: 0 },
    locked: false,
    hotkeys: { schemaVersion: 2, nodeType: 'HotkeysNode', items: [] },
    rotation: 0,
  });

  return collection;
}

/**
 * Helper to write a scene collection to a JSON file
 * Useful for manual testing
 */
export function writeSceneCollectionToFile(collection: any, filePath: string): void {
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
}
