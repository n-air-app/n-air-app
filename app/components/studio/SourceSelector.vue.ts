import * as Sentry from '@sentry/vue';
import { $t } from 'services/i18n';
import { ISceneItemNode, SceneItemFolder, ScenesService, TSceneNode } from 'services/scenes';
import { SelectionService } from 'services/selection/selection';
import { SourcesService } from 'services/sources';
import { EditMenu } from 'util/menus/EditMenu';
import { defineComponent } from 'vue';

import Popper from '../shared/Popper.vue';
import TreeView from '../shared/tree-view/TreeView.vue';
import { ITreeCursorPosition, ITreeNode, ITreeNodeModel } from '../shared/tree-view/types';

// サイドバーアイコンをまとめるかどうかの幅の閾値
const NARROW_SIDEBAR_THRESHOLD = 240;

const sourceIconMap = {
  ffmpeg_source: 'icon-media',
  text_gdiplus: 'icon-text',
  text_ft2_source: 'icon-text',
  image_source: 'icon-image',
  slideshow: 'icon-slideshow',
  dshow_input: 'icon-video-capture',
  wasapi_input_capture: 'icon-mic',
  wasapi_output_capture: 'icon-speaker',
  monitor_capture: 'icon-display',
  game_capture: 'icon-game-capture',
  browser_source: 'icon-browser',
  scene: 'icon-studio-mode',
  color_source: 'icon-color',
  openvr_capture: 'icon-vr-google',
  liv_capture: 'icon-vr-google',
  ndi_source: 'icon-NDI',
  custom_cast_ndi_source: 'icon-character-source',
  spout_capture: 'icon-display',
  near: 'icon-character-source',
  'decklink-input': 'icon-blackmagic',
  vlc_source: 'icon-play',
  wasapi_process_output_capture: 'icon-app-speaker',
  'nair-rtvc-source': 'icon-speech-engine',
};

export default defineComponent({
  name: 'SourceSelector',

  components: { TreeView, Popper },

  data() {
    return {
      sourcesTooltip: $t('scenes.sourcesTooltip'),
      addSourceTooltip: $t('scenes.addSourceTooltip'),
      removeSourcesTooltip: $t('scenes.removeSourcesTooltip'),
      openSourcePropertiesTooltip: $t('scenes.openSourcePropertiesTooltip'),
      addGroupTooltip: $t('scenes.addGroupTooltip'),
      lockTooltip: $t('scenes.lockTooltip'),
      unlockTooltip: $t('scenes.unlockTooltip'),
      lockFolderTooltip: $t('scenes.lockFolderTooltip'),
      unlockFolderTooltip: $t('scenes.unlockFolderTooltip'),
      visibilityTooltip: $t('scenes.visibilityTooltip'),
      expandedFoldersIds: [] as string[],
      narrowSidebar: false,
    };
  },

  mounted() {
    const el = this.$el as HTMLElement;
    (this as any)._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.narrowSidebar = entry.contentRect.width < NARROW_SIDEBAR_THRESHOLD;
      }
    });
    (this as any)._resizeObserver.observe(el);
    this.narrowSidebar = el.offsetWidth < NARROW_SIDEBAR_THRESHOLD;
  },

  beforeUnmount() {
    (this as any)._resizeObserver?.disconnect();
  },

  computed: {
    nodes(): ITreeNodeModel<ISceneItemNode>[] {
      // Transform scene nodes into the presentation model used by TreeView.
      const getTreeNodes = (sceneNodes: TSceneNode[]): ITreeNodeModel<ISceneItemNode>[] => {
        return sceneNodes.map((sceneNode) => {
          return {
            title: sceneNode.name,
            isSelected: sceneNode.isSelected(),
            isLeaf: sceneNode.isItem(),
            isExpanded: this.expandedFoldersIds.indexOf(sceneNode.id) !== -1,
            data: sceneNode.getModel(),
            children: sceneNode.isFolder() ? getTreeNodes(sceneNode.getNodes()) : null,
          };
        });
      };

      return getTreeNodes(this.scene?.getRootNodes() || []);
    },

    activeItemIds() {
      return SelectionService.instance().getIds();
    },

    activeItems() {
      return SelectionService.instance().getItems();
    },

    scene() {
      return ScenesService.instance().activeScene;
    },
  },

  methods: {
    determineIcon(isLeaf: boolean, sourceId: string) {
      if (!isLeaf) {
        return 'icon-folder';
      }
      const source = SourcesService.instance().getSource(sourceId);
      if (!source) return 'icon-file';
      const sourceDetails = source.getComparisonDetails();
      switch (sourceDetails.propertiesManager) {
        case 'nvoice-character':
          return (sourceIconMap as Dictionary<string>)[(sourceDetails.nVoiceCharacterType || 'near') as string];
        case 'custom-cast-ndi':
          return sourceIconMap['custom_cast_ndi_source'];
        default:
          return (sourceIconMap as Dictionary<string>)[sourceDetails.type as string] || 'icon-file';
      }
    },

    addSource() {
      if (ScenesService.instance().activeScene) {
        SourcesService.instance().showShowcase();
      }
    },

    addFolder() {
      if (ScenesService.instance().activeScene) {
        let itemsToGroup: string[] = [];
        let parentId: string | undefined;
        if (SelectionService.instance().canGroupIntoFolder()) {
          itemsToGroup = SelectionService.instance().getIds();
          const parent = SelectionService.instance().getClosestParent();
          if (parent) parentId = parent.id;
        }
        ScenesService.instance().showNameFolder({ itemsToGroup, parentId });
      }
    },

    showContextMenuForNode(node: ITreeNode<ISceneItemNode>, event: MouseEvent) {
      if (!node.data) return;
      // 右クリックしたノードが未選択なら単体選択し直す。
      // 既に選択に含まれていれば（複数選択含む）選択を維持する。
      if (!SelectionService.instance().isSelected(node.data.id)) {
        this.makeActive([node], event);
      }
      this.showContextMenu(node.data.id, event);
    },

    sourcePropertiesForNode(node: ITreeNode<ISceneItemNode>, ev: MouseEvent) {
      if (!node.data) return;
      this.makeActive([node], ev);
      this.sourceProperties();
    },

    showContextMenu(sceneNodeId?: string, event?: MouseEvent) {
      if (!this.scene) {
        Sentry.addBreadcrumb({
          category: 'SourceSelector',
          message: 'showContextMenu called with null active scene',
          level: 'warning',
        });
        event && event.stopPropagation();
        return;
      }
      const sceneNode = sceneNodeId ? this.scene.getNode(sceneNodeId) : null;
      const menuOptions = sceneNode
        ? {
          selectedSceneId: this.scene.id,
          sceneNodeId,
          showSceneItemMenu: true,
        }
        : { selectedSceneId: this.scene.id };

      const menu = new EditMenu(menuOptions);
      menu.popup();
      event && event.stopPropagation();
    },

    removeItems() {
      SelectionService.instance().remove();
    },

    sourceProperties() {
      if (!this.canShowProperties()) return;
      SourcesService.instance().showSourceProperties(this.activeItems[0].sourceId);
    },

    canShowProperties(): boolean {
      if (this.activeItemIds.length === 0) return false;
      const sceneNode = SelectionService.instance().getLastSelected();
      return sceneNode && sceneNode.sceneNodeType === 'item'
        ? sceneNode.getSource().hasProps()
        : false;
    },

    handleSort(
      treeNodesToMove: ITreeNode<ISceneItemNode>[],
      position: ITreeCursorPosition<ISceneItemNode>,
    ) {
      if (!Array.isArray(treeNodesToMove)) {
        Sentry.captureMessage('handleSort: treeNodesToMove is not an array', { level: 'warning', extra: { treeNodesToMove } });
        return;
      }
      // シーンコレクション切替中などはactiveSceneが一時的にnullになりうる。
      if (!this.scene) return;

      const nodeIds = treeNodesToMove
        .map((node) => node.data?.id)
        .filter((id): id is string => !!id);
      const parentId = position.parentNode?.data?.id || '';
      const beforeNodeId = position.beforeNode?.data?.id;
      const nodesToMove = this.scene.getSelection(nodeIds);
      nodesToMove.moveWithinTree(parentId, beforeNodeId);
      SelectionService.instance().select(nodesToMove.getIds());
    },

    makeActive(treeNodes: ITreeNode<ISceneItemNode>[], ev: MouseEvent) {
      const ids = treeNodes
        .map((treeNode) => treeNode.data?.id)
        .filter((id): id is string => !!id);
      SelectionService.instance().select(ids);
    },

    toggleFolder(treeNode: ITreeNode<ISceneItemNode>) {
      const nodeId = treeNode.data?.id;
      if (!nodeId) return;
      if (treeNode.isExpanded) {
        this.expandedFoldersIds.splice(this.expandedFoldersIds.indexOf(nodeId), 1);
      } else {
        this.expandedFoldersIds.push(nodeId);
      }
    },

    canShowActions(sceneNodeId: string) {
      const node = this.scene.getNode(sceneNodeId);
      return node?.isItem() || (!node?.isItem() && (node as SceneItemFolder).getNestedItems().length > 0);
    },

    toggleVisibility(sceneNodeId: string) {
      const selection = this.scene.getSelection(sceneNodeId);
      const visible = !selection.isVisible();
      selection.setSettings({ visible });
    },

    visibilityClassesForSource(sceneNodeId: string) {
      const selection = this.scene.getSelection(sceneNodeId);
      const visible = selection.isVisible();
      return visible ? 'icon-unhide' : 'keep-on icon-hide';
    },

    lockClassesForSource(sceneNodeId: string) {
      const selection = this.scene.getSelection(sceneNodeId);
      const locked = selection.isLocked();

      return {
        'icon-lock': locked,
        'icon-unlock': !locked,
      };
    },

    lockTooltipForSource(sceneNodeId: string, isLeaf: boolean) {
      const locked = this.scene.getSelection(sceneNodeId).isLocked();
      if (isLeaf) return locked ? this.unlockTooltip : this.lockTooltip;
      return locked ? this.unlockFolderTooltip : this.lockFolderTooltip;
    },

    toggleLock(sceneNodeId: string) {
      const selection = this.scene.getSelection(sceneNodeId);
      const locked = !selection.isLocked();
      selection.setSettings({ locked });
    },
  },
});
