import * as remote from '@electron/remote';
import HelpTip from 'components/shared/HelpTip.vue';
import Popper from 'components/shared/Popper.vue';
import Selector from 'components/shared/Selector.vue';
import Fuse from 'fuse.js';
import { CompactModeService } from 'services/compact-mode';
import { EDismissable } from 'services/dismissables';
import { $t } from 'services/i18n';
import { ProjectorService } from 'services/projector';
import { SceneCollectionsService } from 'services/scene-collections';
import { ScenesService } from 'services/scenes';
import { SourceFiltersService } from 'services/source-filters';
import { TransitionsService } from 'services/transitions';
import { Menu } from 'util/menus/Menu';
import { withMenuHandlerTag } from 'util/sentry-menu-handler';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SceneSelector',

  components: { Selector, Popper, HelpTip },

  data() {
    return {
      searchQuery: '',
      removeSceneTooltip: $t('scenes.removeSceneTooltip'),
      addSceneTooltip: $t('scenes.addSceneTooltip'),
      openSceneSwitcherTooltip: $t('scenes.openSceneSwitcherTooltip'),
    };
  },

  computed: {
    scenes() {
      return ScenesService.instance().scenes.map((scene) => {
        return {
          name: scene.name,
          value: scene.id,
        };
      });
    },

    sceneCollections() {
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

    activeId() {
      return SceneCollectionsService.instance().activeCollection?.id ?? null;
    },

    activeCollection() {
      return SceneCollectionsService.instance().activeCollection ?? null;
    },

    activeSceneId() {
      if (ScenesService.instance().activeScene) {
        return ScenesService.instance().activeScene.id;
      }

      return null;
    },

    helpTipDismissable() {
      return EDismissable.SceneCollectionsHelpTip;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },
  },

  methods: {
    showContextMenu() {
      const getExtra = () => ({
        activeSceneIsNull: ScenesService.instance().activeScene == null,
        activeCollectionIsNull: SceneCollectionsService.instance().activeCollection == null,
        sceneCount: ScenesService.instance().scenes.length,
      });
      const menu = new Menu();
      menu.append({
        id: 'Duplicate',
        label: $t('common.duplicate'),
        click: () =>
          withMenuHandlerTag(
            'SceneSelector.Duplicate',
            () => ScenesService.instance().showDuplicateScene(ScenesService.instance().activeScene.id),
            getExtra,
          ),
      });
      menu.append({
        id: 'Rename',
        label: $t('common.rename'),
        click: () =>
          withMenuHandlerTag(
            'SceneSelector.Rename',
            () =>
              ScenesService.instance().showNameScene({
                rename: ScenesService.instance().activeScene.id,
              }),
            getExtra,
          ),
      });
      menu.append({
        id: 'Remove',
        label: $t('common.remove'),
        click: () => this.removeScene(),
      });
      menu.append({
        id: 'Filters',
        label: $t('common.filters'),
        click: () =>
          withMenuHandlerTag(
            'SceneSelector.Filters',
            () =>
              SourceFiltersService.instance().showSourceFilters(ScenesService.instance().activeScene.id),
            getExtra,
          ),
      });
      menu.append({
        id: 'Create Scene Projector',
        label: $t('scenes.createSceneProjector'),
        click: () =>
          withMenuHandlerTag(
            'SceneSelector.CreateSceneProjector',
            () => ProjectorService.instance().createProjector(ScenesService.instance().activeScene.id),
            getExtra,
          ),
      });
      menu.popup();
    },

    makeActive(id: string) {
      ScenesService.instance().makeSceneActive(id);
    },

    handleSort(data: any) {
      ScenesService.instance().setSceneOrder(data.order);
    },

    addScene() {
      ScenesService.instance().showNameScene();
    },

    removeScene(id?: string) {
      this.makeActive(id || this.activeSceneId);
      const name = ScenesService.instance().activeScene.name;
      remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          message: $t('scenes.removeSceneConfirm', { sceneName: name }),
          buttons: [$t('common.ok'), $t('common.cancel')],
          noLink: true,
          cancelId: 1,
          defaultId: 1,
        })
        .then(({ response: cancel }) => {
          if (cancel) return;
          if (!ScenesService.instance().removeScene(this.activeSceneId)) {
            alert($t('scenes.mustHaveLeastOnceScene'));
          }
        });
    },

    showTransitions() {
      TransitionsService.instance().showSceneTransitions();
    },

    loadCollection(id: string) {
      SceneCollectionsService.instance().load(id);
    },

    manageCollections() {
      SceneCollectionsService.instance().showManageWindow();
    },
  },
});
