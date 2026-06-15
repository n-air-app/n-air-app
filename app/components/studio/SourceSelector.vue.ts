import * as Sentry from '@sentry/vue';
import { $t } from 'services/i18n';
import { ISceneItemNode, ScenesService, TSceneNode } from 'services/scenes';
import { SelectionService } from 'services/selection/selection';
import { SourcesService } from 'services/sources';
import { EditMenu } from 'util/menus/EditMenu';
import { defineComponent } from 'vue';

import SlVueTree, { ICursorPosition, ISlTreeNode, ISlTreeNodeModel } from '../shared/sl-vue-tree';

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

  components: { SlVueTree },

  data() {
    return {
      sourcesTooltip: $t('scenes.sourcesTooltip'),
      addSourceTooltip: $t('scenes.addSourceTooltip'),
      removeSourcesTooltip: $t('scenes.removeSourcesTooltip'),
      openSourcePropertiesTooltip: $t('scenes.openSourcePropertiesTooltip'),
      addGroupTooltip: $t('scenes.addGroupTooltip'),
      lockTooltip: $t('scenes.lockTooltip'),
      visibilityTooltip: $t('scenes.visibilityTooltip'),
      expandedFoldersIds: [] as string[],
    };
  },

  computed: {
    nodes(): ISlTreeNodeModel<ISceneItemNode>[] {
      // recursive function for transform SceneNode[] to ISlTreeNodeModel[]
      const getSlVueTreeNodes = (sceneNodes: TSceneNode[]): ISlTreeNodeModel<ISceneItemNode>[] => {
        return sceneNodes.map((sceneNode) => {
          return {
            title: sceneNode.name,
            isSelected: sceneNode.isSelected(),
            isLeaf: sceneNode.isItem(),
            isExpanded: this.expandedFoldersIds.indexOf(sceneNode.id) !== -1,
            data: sceneNode.getModel(),
            children: sceneNode.isFolder() ? getSlVueTreeNodes(sceneNode.getNodes()) : null,
          };
        });
      };

      return getSlVueTreeNodes(this.scene?.getRootNodes() || []);
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
      const sourceDetails = SourcesService.instance().getSource(sourceId).getComparisonDetails();
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
        let parentId: string;
        if (SelectionService.instance().canGroupIntoFolder()) {
          itemsToGroup = SelectionService.instance().getIds();
          const parent = SelectionService.instance().getClosestParent();
          if (parent) parentId = parent.id;
        }
        ScenesService.instance().showNameFolder({ itemsToGroup, parentId });
      }
    },

    showContextMenuForNode(node: ISlTreeNode<ISceneItemNode>, event: MouseEvent) {
      this.showContextMenu(node.data.id, event);
    },

    sourcePropertiesForNode(node: ISlTreeNode<ISceneItemNode>, ev: MouseEvent) {
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
      const sceneNode = this.scene.getNode(sceneNodeId);
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
      treeNodesToMove: ISlTreeNode<ISceneItemNode>[],
      position: ICursorPosition<TSceneNode>,
    ) {
      const nodesToMove = this.scene.getSelection(treeNodesToMove.map((node) => node.data.id));

      const destNode = this.scene.getNode(position.node.data.id);

      if (position.placement === 'before') {
        nodesToMove.placeBefore(destNode.id);
      } else if (position.placement === 'after') {
        nodesToMove.placeAfter(destNode.id);
      } else if (position.placement === 'inside') {
        nodesToMove.setParent(destNode.id);
      }
      SelectionService.instance().select(nodesToMove.getIds());
    },

    makeActive(treeNodes: ISlTreeNode<ISceneItemNode>[], ev: MouseEvent) {
      const ids = treeNodes.map((treeNode) => treeNode.data.id);
      SelectionService.instance().select(ids);
    },

    toggleFolder(treeNode: ISlTreeNode<ISceneItemNode>) {
      const nodeId = treeNode.data.id;
      if (treeNode.isExpanded) {
        this.expandedFoldersIds.splice(this.expandedFoldersIds.indexOf(nodeId), 1);
      } else {
        this.expandedFoldersIds.push(nodeId);
      }
    },

    canShowActions(sceneNodeId: string) {
      const node = this.scene.getNode(sceneNodeId);
      return node.isItem() || node.getNestedItems().length;
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

    toggleLock(sceneNodeId: string) {
      const selection = this.scene.getSelection(sceneNodeId);
      const locked = !selection.isLocked();
      selection.setSettings({ locked });
    },
  },
});
