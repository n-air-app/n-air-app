import * as remote from '@electron/remote';
import { DateTime } from 'luxon';
import { $t } from 'services/i18n';
import { SceneCollectionsService } from 'services/scene-collections';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'EditableSceneCollection',

  props: {
    collectionId: { type: String },
    selected: { type: Boolean },
  },

  data() {
    return {
      renaming: false,
      editableName: '',
      duplicating: false,
    };
  },

  computed: {
    needsRename() {
      return this.collection.needsRename;
    },

    collection() {
      return SceneCollectionsService.instance().collections.find((coll: any) => coll.id === this.collectionId);
    },

    modified() {
      return DateTime.fromISO(this.collection.modified).toRelative();
    },

    isActive() {
      const collection = this.collection;
      if (!collection) return false;
      const activeCollection = SceneCollectionsService.instance().activeCollection;
      if (!activeCollection) return false;

      return collection.id === activeCollection.id;
    },
  },

  watch: {
    needsRename(newVal: boolean) {
      if (newVal) this.startRenaming();
    },
  },

  mounted() {
    if (this.collection.needsRename) this.startRenaming();
  },

  methods: {
    handleKeypress(e: KeyboardEvent) {
      if (e.code === 'Enter') this.submitRename();
    },

    makeActive() {
      SceneCollectionsService.instance().load(this.collection.id);
    },

    duplicate() {
      this.duplicating = true;

      setTimeout(() => {
        SceneCollectionsService.instance()
          .duplicate(this.collection.name, this.collection.id)
          .then(() => {
            this.duplicating = false;
          })
          .catch(() => {
            this.duplicating = false;
          });
      }, 500);
    },

    startRenaming() {
      this.renaming = true;
      this.editableName = this.collection.name;
      this.$nextTick(() => (this.$refs.rename as HTMLInputElement).focus());
    },

    submitRename() {
      SceneCollectionsService.instance().rename(this.editableName, this.collectionId);
      this.renaming = false;
    },

    cancelRename() {
      this.renaming = false;
    },

    remove() {
      remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          buttons: [$t('common.ok'), $t('common.cancel')],
          title: $t('scenes.removeSceneCollectionConfirmTitle'),
          message: $t('scenes.removeSceneCollectionConfirm', {
            collectionName: this.collection.name,
          }),
          noLink: true,
          defaultId: 1,
          cancelId: 1,
        })
        .then(({ response: cancel }) => {
          if (cancel) return;
          SceneCollectionsService.instance().delete(this.collectionId);
        });
    },

    async exportCollection() {
      const { filePath, canceled } = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
        defaultPath: `${this.collection.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return;

      try {
        await SceneCollectionsService.instance().exportCollection(this.collectionId, filePath);
      } catch (e) {
        remote.dialog.showMessageBox(remote.getCurrentWindow(), {
          type: 'error',
          title: $t('scenes.exportSceneCollectionErrorTitle'),
          message: $t('scenes.exportSceneCollectionError'),
        });
      }
    },
  },
});
