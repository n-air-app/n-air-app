import * as remote from '@electron/remote';
import HelpTip from 'components/shared/HelpTip.vue';
import Popper from 'components/shared/Popper.vue';
import Selector from 'components/shared/Selector.vue';
import Fuse from 'fuse.js';
import { AppService } from 'services/app';
import { CompactModeService } from 'services/compact-mode';
import { Inject } from 'services/core/injector';
import { EDismissable } from 'services/dismissables';
import { $t } from 'services/i18n';
import { ProjectorService } from 'services/projector';
import { SceneCollectionsService } from 'services/scene-collections';
import { ScenesService } from 'services/scenes';
import { SourceFiltersService } from 'services/source-filters';
import { TransitionsService } from 'services/transitions';
import { Menu } from 'util/menus/Menu';
import { withMenuHandlerTag } from 'util/sentry-menu-handler';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: { Selector, Popper, HelpTip },
})
export default class SceneSelector extends Vue {
  @Inject() scenesService: ScenesService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() appService: AppService;
  @Inject() transitionsService: TransitionsService;
  @Inject() sourceFiltersService: SourceFiltersService;
  @Inject() projectorService: ProjectorService;
  @Inject() compactModeService: CompactModeService;

  searchQuery = '';

  removeSceneTooltip = $t('scenes.removeSceneTooltip');
  addSceneTooltip = $t('scenes.addSceneTooltip');
  openSceneSwitcherTooltip = $t('scenes.openSceneSwitcherTooltip');

  showContextMenu() {
    const getExtra = () => ({
      activeSceneIsNull: this.scenesService.activeScene == null,
      activeCollectionIsNull: this.sceneCollectionsService.activeCollection == null,
      sceneCount: this.scenesService.scenes.length,
    });
    const menu = new Menu();
    menu.append({
      id: 'Duplicate',
      label: $t('common.duplicate'),
      click: () =>
        withMenuHandlerTag(
          'SceneSelector.Duplicate',
          () => this.scenesService.showDuplicateScene(this.scenesService.activeScene.id),
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
            this.scenesService.showNameScene({
              rename: this.scenesService.activeScene.id,
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
            this.sourceFiltersService.showSourceFilters(this.scenesService.activeScene.id),
          getExtra,
        ),
    });
    menu.append({
      id: 'Create Scene Projector',
      label: $t('scenes.createSceneProjector'),
      click: () =>
        withMenuHandlerTag(
          'SceneSelector.CreateSceneProjector',
          () => this.projectorService.createProjector(this.scenesService.activeScene.id),
          getExtra,
        ),
    });
    menu.popup();
  }

  makeActive(id: string) {
    this.scenesService.makeSceneActive(id);
  }

  handleSort(data: any) {
    this.scenesService.setSceneOrder(data.order);
  }

  addScene() {
    this.scenesService.showNameScene();
  }

  removeScene(id?: string) {
    this.makeActive(id || this.activeSceneId);
    const name = this.scenesService.activeScene.name;
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
        if (!this.scenesService.removeScene(this.activeSceneId)) {
          alert($t('scenes.mustHaveLeastOnceScene'));
        }
      });
  }

  showTransitions() {
    this.transitionsService.showSceneTransitions();
  }

  get scenes() {
    return this.scenesService.scenes.map((scene) => {
      return {
        name: scene.name,
        value: scene.id,
      };
    });
  }

  get sceneCollections() {
    const list = this.sceneCollectionsService.collections;

    if (this.searchQuery) {
      const fuse = new Fuse(list, {
        shouldSort: true,
        keys: ['name'],
      });

      return fuse.search(this.searchQuery).map((result) => result.item);
    }

    return list;
  }

  get activeId() {
    return this.sceneCollectionsService.activeCollection?.id ?? null;
  }

  get activeCollection() {
    return this.sceneCollectionsService.activeCollection ?? null;
  }

  get activeSceneId() {
    if (this.scenesService.activeScene) {
      return this.scenesService.activeScene.id;
    }

    return null;
  }

  loadCollection(id: string) {
    this.sceneCollectionsService.load(id);
  }

  manageCollections() {
    this.sceneCollectionsService.showManageWindow();
  }

  get helpTipDismissable() {
    return EDismissable.SceneCollectionsHelpTip;
  }

  get isCompactMode(): boolean {
    return this.compactModeService.isCompactMode;
  }
}
