import { ISceneItemNode } from 'services/scenes';

export * from './selection';

export interface ISelectionState {
  selectedIds: string[];
  lastSelectedId: string;
}

/**
 * list of ISceneNode.id or ISceneNode
 */
export type TNodesList = string | string[] | ISceneItemNode | ISceneItemNode[];
