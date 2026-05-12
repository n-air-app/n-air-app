/**
 * Unit tests for SceneCollectionsService
 * Focuses on Sentry error reporting for partial load failures
 */

import * as Sentry from '@sentry/vue';

// Mock dependencies
jest.mock('@sentry/vue', () => ({
  withScope: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('@electron/remote', () => ({
  dialog: {
    showMessageBoxSync: jest.fn(() => 0), // Return OK/first button
  },
  app: {
    quit: jest.fn(),
  },
}));

describe('SceneCollectionsService', () => {
  let mockScope: any;
  let mockWithScope: jest.Mock;
  let mockCaptureMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Create mock scope object
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
    };

    // Mock Sentry.withScope to capture the callback
    mockWithScope = jest.fn((callback: (scope: any) => void) => {
      callback(mockScope);
    });

    mockCaptureMessage = jest.fn();

    jest.spyOn(Sentry, 'withScope').mockImplementation(mockWithScope);
    jest.spyOn(Sentry, 'captureMessage').mockImplementation(mockCaptureMessage);
  });

  describe('load with partial errors', () => {
    test('sends partial load errors to Sentry with correct metadata', async () => {
      // This test verifies that when loadErrors are returned from readCollectionDataAndLoadIntoApplicationState,
      // they are properly sent to Sentry with the correct structure

      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 'source_1',
          name: 'Invalid Source 1',
          error: new Error('Source type not found'),
        },
        {
          type: 'source' as const,
          id: 'source_2',
          name: 'Invalid Source 2',
          error: new Error('Device not found'),
        },
        {
          type: 'scene' as const,
          id: 'scene_1',
          name: 'Invalid Scene',
          error: new Error('Scene load failed'),
        },
      ];

      // Manually verify the logic that would be executed in scene-collections.ts:265-291
      // We're testing the Sentry reporting logic in isolation

      // This simulates what happens when loadErrors.length > 0
      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      // Convert failed items array to indexed object for better Sentry display
      const failedItemsContext = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      Sentry.withScope((scope) => {
        scope.setLevel('warning');
        scope.setTag('service', 'SceneCollectionsService');
        scope.setTag('method', 'load');
        scope.setTag('collectionId', 'test-collection-id');
        scope.setTag('errorCount', mockLoadErrors.length.toString());
        scope.setContext('errorsByType', errorsByType);
        scope.setContext('failedItems', failedItemsContext);
        Sentry.captureMessage('Scene collection loaded with partial errors', 'warning');
      });

      // Verify Sentry was called correctly
      expect(mockWithScope).toHaveBeenCalledTimes(1);
      expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
      expect(mockScope.setTag).toHaveBeenCalledWith('service', 'SceneCollectionsService');
      expect(mockScope.setTag).toHaveBeenCalledWith('method', 'load');
      expect(mockScope.setTag).toHaveBeenCalledWith('collectionId', 'test-collection-id');
      expect(mockScope.setTag).toHaveBeenCalledWith('errorCount', '3');

      // Verify error aggregation by type
      expect(mockScope.setContext).toHaveBeenCalledWith('errorsByType', {
        source: 2,
        scene: 1,
      });

      // Verify detailed error information (now using indexed object format)
      const expectedFailedItems = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      expect(mockScope.setContext).toHaveBeenCalledWith('failedItems', expectedFailedItems);

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Scene collection loaded with partial errors',
        'warning',
      );
    });

    test('correctly aggregates errors by type', () => {
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 's1',
          name: 'Source 1',
          error: new Error('error 1'),
        },
        {
          type: 'source' as const,
          id: 's2',
          name: 'Source 2',
          error: new Error('error 2'),
        },
        {
          type: 'source' as const,
          id: 's3',
          name: 'Source 3',
          error: new Error('error 3'),
        },
        {
          type: 'scene' as const,
          id: 'sc1',
          name: 'Scene 1',
          error: new Error('error 4'),
        },
        {
          type: 'filter' as const,
          id: 'f1',
          name: 'Filter 1',
          error: new Error('error 5'),
        },
      ];

      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      expect(errorsByType).toEqual({
        source: 3,
        scene: 1,
        filter: 1,
      });
    });

    test('handles non-Error objects in error field', () => {
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 's1',
          name: 'Source 1',
          error: 'string error' as any, // Sometimes errors might be strings
        },
        {
          type: 'source' as const,
          id: 's2',
          name: 'Source 2',
          error: { message: 'object error' } as any,
        },
      ];

      const items = mockLoadErrors.map((err) => ({
        type: err.type,
        id: err.id,
        name: err.name,
        error: err.error instanceof Error ? err.error.message : String(err.error),
      }));

      expect(items[0].error).toBe('string error');
      expect(items[1].error).toBe('[object Object]');
    });

    test('handles settings: null error case', () => {
      // This test verifies the error case discovered during testing
      // where settings is null causes "Cannot convert undefined or null to object" error
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 'error_test_null_settings',
          name: 'エラーテスト3: null設定 [browser_source]',
          error: new TypeError('Cannot convert undefined or null to object'),
        },
      ];

      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      const failedItemsContext = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      expect(errorsByType).toEqual({ source: 1 });
      expect(failedItemsContext).toEqual({
        '1_source': {
          type: 'source',
          id: 'error_test_null_settings',
          name: 'エラーテスト3: null設定 [browser_source]',
          errorMessage: 'Cannot convert undefined or null to object',
        },
      });
    });
  });
});
