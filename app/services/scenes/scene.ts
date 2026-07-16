import * as fs from 'fs';

import uniqBy from 'lodash/uniqBy';
import { filter, startWith } from 'rxjs';
import { mutation, ServiceHelper } from 'services/core';
import { Inject } from 'services/core/injector';
import { TSceneNodeInfo } from 'services/scene-collections/nodes/scene-items';
import { Selection, SelectionService, TNodesList } from 'services/selection';
import { TDisplayType, VideoSettingsService } from 'services/settings-v2';
import { ISource, Source, SourcesService, TSourceType } from 'services/sources';
import Utils, { uuidv4 } from 'services/utils';
import { observeUntilStable } from 'util/observeUntilStable';
import { assertIsDefined } from 'util/properties-type-guards';
import { assertObsObjectDefined } from 'util/sentry-obs-breadcrumb';
import { SentryReport } from 'util/sentry-report';

import * as obs from '../../../obs-api';

import {
  EBlendingMethod,
  EBlendingMode,
  EScaleType,
  IScene,
  ISceneItem,
  ISceneItemFolder,
  ISceneItemInfo,
  ISceneItemNode,
  ISceneNodeAddOptions,
  SceneItem,
  SceneItemFolder,
} from './index';
import { ScenesService } from './scenes';
import { resolveTreeMove } from './tree-order';

export type TSceneNode = SceneItem | SceneItemFolder;

export interface ISceneHierarchy extends ISceneItemNode {
  children: ISceneHierarchy[];
}

@ServiceHelper()
export class Scene {
  id: string;
  name: string;
  nodes: (ISceneItem | ISceneItemFolder)[];
  resourceId: string;

  private _resourceId: string;

  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private selectionService: SelectionService;
  @Inject() private videoSettingsService: VideoSettingsService;

  private readonly state: IScene;

  constructor(sceneId: string) {
    if (!sceneId) console.trace('undefined sceneId');
    this.state = this.scenesService.state.scenes[sceneId];
    assertIsDefined(this.state);
    Utils.applyProxy(this, this.state);
  }

  // getter for backward compatibility with previous version of API
  get items(): ISceneItem[] {
    return this.nodes.filter((node) => node.sceneNodeType === 'item') as ISceneItem[];
  }

  getModel(): IScene {
    return this.state;
  }

  getObsScene(): obs.IScene {
    const scene = obs.SceneFactory.fromName(this.id);
    assertObsObjectDefined(scene, 'ScenesService', 'getObsScene', { sceneId: this.id });
    return scene;
  }

  getNode(sceneNodeId: string): TSceneNode {
    const nodeModel = this.state.nodes.find(
      (sceneItemModel) => sceneItemModel.id === sceneNodeId,
    ) as ISceneItem;

    if (!nodeModel) return null;

    if (nodeModel.sceneNodeType === 'item') {
      if (!this.sourcesService.state.sources[nodeModel.sourceId]) return null;
      return new SceneItem(this.id, nodeModel.id, nodeModel.sourceId);
    }
    return new SceneItemFolder(this.id, nodeModel.id);
  }

  getItem(sceneItemId: string): SceneItem {
    const node = this.getNode(sceneItemId);
    return node && node.sceneNodeType === 'item' ? (node as SceneItem) : null;
  }

  getFolder(sceneFolderId: string): SceneItemFolder {
    const node = this.getNode(sceneFolderId);
    return node && node.sceneNodeType === 'folder' ? (node as SceneItemFolder) : null;
  }

  /**
   * returns the first node with selected name
   */
  getNodeByName(name: string): TSceneNode {
    return this.getNodes().find((node) => node.name === name);
  }

  getItems(): SceneItem[] {
    return this.state.nodes
      .filter((node) => node.sceneNodeType === 'item')
      .map((item) => this.getItem(item.id))
      .filter(Boolean);
  }

  getFolders(): SceneItemFolder[] {
    return this.state.nodes
      .filter((node) => node.sceneNodeType === 'folder')
      .map((item) => this.getFolder(item.id));
  }

  getNodes(): TSceneNode[] {
    return this.state.nodes.map((node) => {
      return node.sceneNodeType === 'folder' ? this.getFolder(node.id) : this.getItem(node.id);
    });
  }

  getRootNodes(): TSceneNode[] {
    return this.getNodes().filter((node) => !node.parentId);
  }

  getNodesIds(): string[] {
    return this.state.nodes.map((item) => item.id);
  }

  getSelection(itemsList?: TNodesList): Selection {
    return new Selection(this.id, itemsList);
  }

  setName(newName: string) {
    const sceneSource = this.sourcesService.getSource(this.id);
    sceneSource.setName(newName);
    this.SET_NAME(newName);
  }

  createAndAddSource(
    sourceName: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options: ISceneNodeAddOptions = {},
  ): SceneItem {
    const source = this.sourcesService.createSource(sourceName, type, settings);
    return this.addSource(source.sourceId, options);
  }

  addSource(sourceId: string, options: ISceneNodeAddOptions = {}): SceneItem | null {
    const source = this.sourcesService.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);

    if (!this.canAddSource(sourceId)) return null;

    const sceneItemId = options.id || uuidv4();

    const obsSceneItem: obs.ISceneItem = this.getObsScene().add(source.getObsInput());

    const display = 'horizontal';
    // assign context to scene item
    const context = this.videoSettingsService.contexts.horizontal;

    this.ADD_SOURCE_TO_SCENE(
      sceneItemId,
      source.sourceId,
      obsSceneItem.id,
      display,
      obsSceneItem.position,
    );
    const sceneItem = this.getItem(sceneItemId);

    sceneItem.loadAttributes();
    sceneItem.setSettings({ ...sceneItem.getSettings(), display, output: context });

    // Newly added sources are immediately active
    this.selectionService.select(sceneItemId);

    if (options.initialTransform) {
      sceneItem.setTransform(options.initialTransform);
    }

    this.scenesService.itemAdded.next(sceneItem.getModel());
    if (source.type === 'monitor_capture' || source.type === 'game_capture') {
      this.fixupSceneItemWhenReady(sourceId, () => {
        const sceneItem = this.getItem(sceneItemId);
        sceneItem?.fitToScreen();
      });
    }
    return sceneItem;
  }

  // SceneItem の width, heightは遅れてセットされるので、設定されたあとに実行する処理を登録する
  // Streamlabs 側はOBSのプロセスを分けて解決しているようだが、こちらは値の設定されるタイミングがずれているためのtweakが必要
  fixupSceneItemWhenReady(sourceId: string, callback: () => void) {
    if (!sourceId || !callback) return;
    const source = this.sourcesService.getSourceById(sourceId);
    // 既にwidth, heightが設定されている場合は即実行
    if (source?.width && source?.height) {
      callback();
      return;
    }
    const subscription = this.sourcesService.sourceUpdated
      .pipe(filter((patch) => patch.sourceId === sourceId))
      .subscribe((patch) => {
        if (patch.width && patch.height) {
          callback();
          subscription.unsubscribe();
        }
      });
  }

  /**
   * fixupSceneItemWhenReady にタイムアウトと安定待ちを追加したもの。
   * デバイス起動直後は width/height が連続して変化することがあり、変化した直後の
   * 値に対して transform を書き込んでもOBS側にすぐ反映されないことがあるため、
   * 最後の変化から debounceMs 経過して値が安定するまで待ってから callback を呼ぶ。
   * デバイスが起動せずサイズが確定しないまま購読が残り続けることも防ぐ。
   */
  fixupSceneItemWhenReadyWithTimeout(
    sourceId: string,
    callback: () => void,
    onTimeout: () => void,
    timeoutMs = 15000,
    debounceMs = 200,
  ) {
    if (!sourceId || !callback) return;

    const currentSource = this.sourcesService.getSourceById(sourceId);
    const source$ = this.sourcesService.sourceUpdated.pipe(
      filter((patch) => patch.sourceId === sourceId),
      startWith(currentSource ? currentSource.getModel() : undefined),
    );

    observeUntilStable<ISource | undefined>(
      source$,
      (source) => !!(source?.width && source?.height),
      { timeoutMs, debounceMs },
    ).then(callback, onTimeout);
  }

  addFile(path: string, folderId?: string): TSceneNode {
    let fstat: fs.Stats;
    try {
      fstat = fs.lstatSync(path);
    } catch (e: unknown) {
      SentryReport.message('ScenesService', 'addFile', `Failed to lstat dropped path: ${(e as Error).message}`, {
        level: 'warning',
      });
      throw e;
    }
    const fname = path.split('\\').slice(-1)[0];

    if (fstat.isDirectory()) {
      const folder = this.createFolder(fname);
      if (folderId) folder.setParent(folderId);
      const files = fs.readdirSync(path).reverse();
      files.forEach((filePath) => this.addFile(`${path}\\${filePath}`, folder.id));
      return folder;
    }

    const source = this.sourcesService.addFile(path);
    if (!source) return null;
    const item = this.addSource(source.sourceId);
    if (folderId) item.setParent(folderId);
    return item;
  }

  createFolder(name: string, options: ISceneNodeAddOptions = {}) {
    const id = options.id || uuidv4();

    this.ADD_FOLDER_TO_SCENE({
      id,
      name,
      sceneNodeType: 'folder',
      sceneId: this.id,
      resourceId: 'SceneItemFolder' + JSON.stringify([this.id, id]),
      parentId: '',
    });
    return this.getFolder(id);
  }

  removeFolder(folderId: string) {
    const sceneFolder = this.getFolder(folderId);
    if (!sceneFolder) return;
    if (sceneFolder.isSelected()) sceneFolder.deselect();
    sceneFolder.getSelection().remove();
    this.REMOVE_NODE_FROM_SCENE(folderId);
  }

  remove(force?: boolean): IScene {
    return this.scenesService.removeScene(this.id, force);
  }

  removeItem(sceneItemId: string) {
    const sceneItem = this.getItem(sceneItemId);
    if (!sceneItem) return;
    const sceneItemModel = sceneItem.getModel();
    if (sceneItem.isSelected()) sceneItem.deselect();
    sceneItem.getObsSceneItem().remove();
    this.REMOVE_NODE_FROM_SCENE(sceneItemId);
    this.scenesService.itemRemoved.next(sceneItemModel);
  }

  clear() {
    this.getSelection().selectAll().remove();
  }

  setLockOnAllItems(locked: boolean) {
    this.getItems().forEach((item) => item.setSettings({ locked }));
  }

  /** ノードとその子孫を一塊のまま、指定した親の兄弟列へ移動する。 */
  moveNodes(nodeIds: string[], parentId = '', beforeNodeId?: string) {
    const existingIds = new Set(this.state.nodes.map((node) => node.id));
    const missingNodeIds = nodeIds.filter((id) => !existingIds.has(id));
    const missingParentId = parentId && !existingIds.has(parentId) ? parentId : undefined;
    const missingBeforeNodeId = beforeNodeId && !existingIds.has(beforeNodeId) ? beforeNodeId : undefined;

    if (missingNodeIds.length || missingParentId || missingBeforeNodeId) {
      SentryReport.message('Scene', 'moveNodes', 'Tree move references missing nodes', {
        level: 'warning',
        extra: { sceneId: this.id, missingNodeIds, missingParentId, missingBeforeNodeId },
      });
    }

    const result = resolveTreeMove(this.state.nodes, nodeIds, parentId, beforeNodeId);
    if (!result) return;
    this.MOVE_NODES(result.order, result.rootNodeIds, result.parentId);
    this.reconcileNodeOrderWithObs();
  }

  /**
   * Makes sure all scene items are in the correct order in OBS.
   */
  private reconcileNodeOrderWithObs() {
    const obsScene = this.getObsScene();
    this.getItems().forEach((item, index) => {
      // moveItem実行後はOBS側の並びが変わるため、都度取り直す必要がある。
      const currentIndex = obsScene
        .getItems()
        .reverse()
        .findIndex((obsItem) => obsItem.id === item.obsSceneItemId);
      // stateとOBS側のアイテム集合が一時的にズレている(ドラッグ操作中の削除・
      // シーン切替との競合など)と対応するOBS側アイテムが見つからないことがある。
      // その場合はこのアイテムの並び替えのみスキップして処理を継続する。
      if (currentIndex === -1) {
        SentryReport.message('Scene', 'reconcileNodeOrderWithObs', 'OBS scene item not found for obsSceneItemId, skipping moveItem', {
          level: 'warning',
          extra: { sceneId: this.id, sceneItemId: item.id, obsSceneItemId: item.obsSceneItemId, index },
        });
        return;
      }
      obsScene.moveItem(currentIndex, index);
    });
  }

  addSources(nodes: TSceneNodeInfo[]) {
    const arrayItems: (ISceneItemInfo & obs.ISceneItemInfo)[] = [];

    nodes = nodes.filter((sceneNode) => {
      if (sceneNode.sceneNodeType === 'folder') return true;
      const item = sceneNode as ISceneItemInfo;
      const source = this.sourcesService.getSource(item.sourceId);
      if (!source) return false;
      arrayItems.push({
        name: source.sourceId,
        id: item.id,
        sourceId: source.sourceId,
        crop: item.crop,
        scaleX: item.scaleX == null ? 1 : item.scaleX,
        scaleY: item.scaleY == null ? 1 : item.scaleY,
        visible: item.visible,
        x: item.x == null ? 0 : item.x,
        y: item.y == null ? 0 : item.y,
        locked: item.locked,
        rotation: item.rotation || 0,
        streamVisible: true,
        recordingVisible: true,
        scaleFilter: item.scaleFilter,
        blendingMode: item.blendingMode,
        blendingMethod: item.blendingMethod,
        display: item.display,
      });
      return true;
    });

    const obsSceneItems = obs.addItems(this.getObsScene(), arrayItems);

    // create folder and items
    let itemIndex = 0;
    nodes.forEach((nodeModel) => {
      const display = 'horizontal';
      const obsSceneItem = obsSceneItems[itemIndex];

      if (nodeModel.sceneNodeType === 'folder') {
        this.createFolder(nodeModel.name, { id: nodeModel.id });
      } else {
        const itemModel = nodeModel as ISceneItemInfo;
        this.ADD_SOURCE_TO_SCENE(
          itemModel.id,
          itemModel.sourceId,
          obsSceneItems[itemIndex].id,
          display,
          obsSceneItem.position,
        );
        this.getItem(itemModel.id).loadItemAttributes(itemModel);
        itemIndex++;
      }
    });

    // add items to folders
    nodes.reverse().forEach((nodeModel) => {
      if (nodeModel.sceneNodeType !== 'folder') return;
      this.getSelection(nodeModel.childrenIds).moveTo(this.id, nodeModel.id);
    });
  }

  canAddSource(sourceId: string): boolean {
    const source = this.sourcesService.getSource(sourceId);
    if (!source) return false;

    // 同一scene上では1つだけ
    if (source.type === 'nair-rtvc-source') {
      for (const s of this.items) {
        if (this.sourcesService.getSourceById(s.sourceId).type === 'nair-rtvc-source') return false;
      }
    }

    // if source is scene then traverse the scenes tree to detect possible infinity scenes loop
    if (source.type !== 'scene') return true;
    if (this.id === source.sourceId) return false;

    const sceneToAdd = this.scenesService.getScene(source.sourceId);
    return !sceneToAdd.hasNestedScene(this.id);
  }

  hasNestedScene(sceneId: string) {
    const childScenes = this.getItems()
      .filter((sceneItem) => sceneItem.type === 'scene')
      .map((sceneItem) => this.scenesService.getScene(sceneItem.sourceId));

    for (const childScene of childScenes) {
      if (childScene.id === sceneId) return true;
      if (childScene.hasNestedScene(sceneId)) return true;
    }

    return false;
  }

  /**
   * returns scene items of scene + scene items of nested scenes
   */
  getNestedItems(options = { excludeScenes: false }): SceneItem[] {
    let result = this.getItems();
    result
      .filter((sceneItem) => sceneItem.type === 'scene')
      .map((sceneItem) => {
        return this.scenesService.getScene(sceneItem.sourceId).getNestedItems();
      })
      .forEach((sceneItems) => {
        result = result.concat(sceneItems);
      });
    if (options.excludeScenes) result = result.filter((sceneItem) => sceneItem.type !== 'scene');
    return uniqBy(result, 'sceneItemId');
  }

  makeActive() {
    this.scenesService.makeSceneActive(this.id);
  }

  /**
   * returns sources of scene + sources of nested scenes
   * result also includes nested scenes
   */
  getNestedSources(options = { excludeScenes: false }): Source[] {
    const sources = this.getNestedItems(options).map((sceneItem) => sceneItem.getSource());
    return uniqBy(sources, 'sourceId');
  }

  /**
   * return nested scenes in the safe-to-add order
   */
  getNestedScenes(): Scene[] {
    const scenes = this.getNestedSources()
      .filter((source) => source.type === 'scene')
      .map((sceneSource) => this.scenesService.getScene(sceneSource.sourceId));
    const resultScenes: Scene[] = [];

    scenes.forEach((scene) => {
      resultScenes.push(...scene.getNestedScenes());
      if (!resultScenes.find((foundScene) => foundScene.id === scene.id)) {
        resultScenes.push(scene);
      }
    });

    return resultScenes;
  }

  /**
   * returns the source linked to scene
   */
  getSource(): Source {
    // scene must always have a linked source
    const source = this.sourcesService.getSource(this.id);
    assertIsDefined(source);
    return source;
  }

  getResourceId() {
    return this._resourceId;
  }

  @mutation()
  private SET_NAME(newName: string) {
    this.state.name = newName;
  }

  @mutation()
  private ADD_SOURCE_TO_SCENE(
    sceneItemId: string,
    sourceId: string,
    obsSceneItemId: number,
    display: TDisplayType,
    position: IVec2,
  ) {
    this.state.nodes.unshift({
      // This is information that belongs to a scene/source pair

      // The id of the source
      sceneItemId,
      sourceId,
      obsSceneItemId,
      id: sceneItemId,
      parentId: '',
      sceneNodeType: 'item',
      sceneId: this.state.id,
      resourceId: 'SceneItem' + JSON.stringify([this.state.id, sceneItemId, sourceId]),

      transform: {
        // Position in video space
        position: { x: 0, y: 0 },

        // Scale between 0 and 1
        scale: { x: 1.0, y: 1.0 },

        crop: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },

        rotation: 0,
      },

      visible: true,
      locked: false,
      scaleFilter: EScaleType.Disable,
      blendingMode: EBlendingMode.Normal,
      blendingMethod: EBlendingMethod.Default,
      display,
      position,
    });
  }

  @mutation()
  private ADD_FOLDER_TO_SCENE(folderModel: ISceneItemFolder) {
    this.state.nodes.unshift(folderModel);
  }

  @mutation()
  private REMOVE_NODE_FROM_SCENE(nodeId: string) {
    this.state.nodes = this.state.nodes.filter((item) => {
      return item.id !== nodeId;
    });
  }

  @mutation()
  private MOVE_NODES(order: string[], rootNodeIds: string[], parentId: string) {
    const rootIds = new Set(rootNodeIds);
    const nodesById = new Map(this.state.nodes.map((node) => [node.id, node]));

    this.state.nodes.forEach((node) => {
      if (rootIds.has(node.id)) node.parentId = parentId;
    });
    this.state.nodes = order.map((id) => {
      const node = nodesById.get(id);
      assertIsDefined(node);
      return node;
    });
  }
}
