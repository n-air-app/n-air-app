import fs from 'fs';
import path from 'path';

import * as remote from '@electron/remote';
import ModalLayout from 'components/shared/ModalLayout.vue';
import EditableSceneCollection from 'components/studio/EditableSceneCollection.vue';
import Fuse from 'fuse.js';
import { $t } from 'services/i18n';
import { ObsImporterService } from 'services/obs-importer';
import { OnboardingService } from 'services/onboarding';
import { SceneCollectionsService } from 'services/scene-collections';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ManageSceneCollections',

  components: { ModalLayout, EditableSceneCollection },

  data() {
    return {
      searchQuery: '',
    };
  },

  computed: {
    collections() {
      const list = SceneCollectionsService.instance().collections;

      if (this.searchQuery) {
        const fuse = new Fuse(list, {
          shouldSort: true,
          keys: ['name'],
        });

        return fuse.search(this.searchQuery).map((result) => result.item);
      }

      return list;
    },

    canImportFromOBS() {
      return ObsImporterService.instance().canImportFromOBS;
    },
  },

  methods: {
    close() {
      SceneCollectionsService.instance().stateService.flushManifestFile();
      WindowsService.instance().closeChildWindow();
    },

    create() {
      SceneCollectionsService.instance().create({ needsRename: true });
    },

    importFromOBS() {
      WindowsService.instance().closeChildWindow();
      OnboardingService.instance().start({ skipLogin: true });
    },

    async importFromFile() {
      const { filePaths, canceled } = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths[0]) return;

      const filePath = filePaths[0];
      const name = path.basename(filePath, path.extname(filePath));

      try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        await SceneCollectionsService.instance().importCollection(name, data);
      } catch (e) {
        remote.dialog.showMessageBox(remote.getCurrentWindow(), {
          type: 'error',
          title: $t('scenes.importSceneCollectionErrorTitle'),
          message: $t('scenes.importSceneCollectionError'),
        });
      }
    },
  },
});
