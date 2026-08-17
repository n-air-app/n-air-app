/**
 * abstract class for representing scene's folders and items
 */
import { IVideo } from 'obs-studio-node';
import { SelectionService } from 'services/selection';
import { TDisplayType } from 'services/settings-v2';
import { assertIsDefined } from 'util/properties-type-guards';

import { Inject } from '../core/injector';

import {
  ISceneItemNode,
  Scene,
  SceneItem,
  SceneItemFolder,
  ScenesService,
  TSceneNode,
} from './index';
import { TSceneNodeType } from './scenes';

export function isFolder(node: SceneItemNode): node is SceneItemFolder {
  return node.sceneNodeType === 'folder';
}

export function isItem(node: SceneItemNode): node is SceneItem {
  return node.sceneNodeType === 'item';
}

export abstract class SceneItemNode implements ISceneItemNode {
  id: string;
  parentId: string;
  abstract sceneNodeType: TSceneNodeType;
  resourceId: string;
  sceneId: string;
  output?: IVideo;
  display?: TDisplayType = 'horizontal';

  private _resourceId: string;

  @Inject() protected scenesService: ScenesService;
  @Inject() protected selectionService: SelectionService;

  getScene(): Scene {
    const scene = this.scenesService.getScene(this.sceneId);
    assertIsDefined(scene);
    return scene;
  }

  get childrenIds(): string[] {
    return this.getScene()
      .getModel()
      .nodes.filter((node) => node.parentId === this.id && node.id !== this.id)
      .map((node) => node.id);
  }

  setParent(parentId: string) {
    const scene = this.getScene();
    const beforeNodeId = scene
      .getModel()
      .nodes.find((node) => (node.parentId || '') === parentId && node.id !== this.id)?.id;
    scene.moveNodes([this.id], parentId, beforeNodeId);
  }

  getParent(): SceneItemFolder | null {
    return this.getScene().getFolder(this.parentId);
  }

  hasParent(): boolean {
    return !!this.state.parentId;
  }

  getNodeIndex(): number {
    return this.getScene().getNodesIds().indexOf(this.id);
  }

  getPrevNode(): TSceneNode {
    const nodeInd = this.getNodeIndex();
    return this.getScene().getNodes()[nodeInd - 1];
  }

  getNextNode(): TSceneNode {
    const nodeInd = this.getNodeIndex();
    return this.getScene().getNodes()[nodeInd + 1];
  }

  getPrevItem(): SceneItem | null {
    let nodeInd = this.getNodeIndex();
    const nodes = this.getScene().getNodes();
    while (nodeInd--) {
      if (nodes[nodeInd].isItem()) return nodes[nodeInd] as SceneItem;
    }
    return null;
  }

  getNextItem(): SceneItem | null {
    let nodeInd = this.getNodeIndex();
    const nodes = this.getScene().getNodes();
    while (nodeInd++) {
      if (!nodes[nodeInd]) return null;
      if (nodes[nodeInd].isItem()) return nodes[nodeInd] as SceneItem;
    }
    return null;
  }

  /**
   * @returns all parent Ids
   */
  getPath(): string[] {
    const parent = this.getParent();
    return parent ? parent.getPath().concat([this.id]) : [this.id];
  }

  isSelected() {
    return this.selectionService.isSelected(this.id);
  }

  select() {
    this.selectionService.select(this.id);
  }

  addToSelection() {
    this.selectionService.add(this.id);
  }

  deselect() {
    this.selectionService.deselect(this.id);
  }

  isFolder(): this is SceneItemFolder {
    return isFolder(this);
  }

  isItem(): this is SceneItem {
    return isItem(this);
  }

  getResourceId() {
    return this._resourceId;
  }

  protected abstract get state(): ISceneItemNode;
  abstract remove(): void;
}
