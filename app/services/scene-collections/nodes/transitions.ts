import { TObsValue } from 'components/obs/inputs/ObsInput';
import { Inject } from 'services/core/injector';
import { ETransitionType, TransitionsService } from 'services/transitions';

import { Node } from './node';

// motion_transition 追加前から存在していた型。旧フィールド(type)に書いても旧バージョンが安全に読める。
// 新しい型を追加する際はここに追加しないこと — 旧版互換 fallback の意味が失われる。
const LEGACY_COMPATIBLE_TYPES = new Set<string>([
  'cut_transition',
  'fade_transition',
  'swipe_transition',
  'slide_transition',
  'fade_to_color_transition',
  'wipe_transition',
  'obs_stinger_transition',
]);

interface ITransition {
  id: string;
  name: string;
  // 旧バージョン互換フィールド: 常にレガシー互換型(cut 等)を入れる。新型は typeV2 を使う。
  type: ETransitionType;
  // 新型(motion 等)を保存するフィールド。旧バージョンは無視するため破壊的変更なし。
  typeV2?: ETransitionType;
  duration: number;
  settings: Dictionary<TObsValue>;
  propertiesManagerSettings?: Dictionary<any>;
}

interface IConnection {
  fromSceneId: string;
  toSceneId: string;
  transitionId: string;
}

interface ISchema {
  transitions: ITransition[];
  connections: IConnection[];
  defaultTransitionId: string;
}

/**
 * This is the V2 transitions node that supports multiple
 * transitions and connections.
 */
export class TransitionsNode extends Node<ISchema, {}> {
  schemaVersion = 2;

  @Inject() transitionsService: TransitionsService;

  async save() {
    this.data = {
      transitions: this.transitionsService.state.transitions.map((transition) => {
        const actualType = transition.type;
        const isLegacy = LEGACY_COMPATIBLE_TYPES.has(actualType);
        return {
          id: transition.id,
          name: transition.name,
          type: isLegacy ? actualType : ETransitionType.Cut,
          ...(isLegacy ? {} : { typeV2: actualType }),
          duration: transition.duration,
          settings: this.transitionsService.getSettings(transition.id),
          propertiesManagerSettings: this.transitionsService.getPropertiesManagerSettings(
            transition.id,
          ),
        };
      }),
      connections: this.transitionsService.state.connections.map((connection) => {
        return {
          fromSceneId: connection.fromSceneId,
          toSceneId: connection.toSceneId,
          transitionId: connection.transitionId,
        };
      }),
      defaultTransitionId: this.transitionsService.state.defaultTransitionId ?? '',
    };
  }

  async load() {
    // Double check we are starting from a blank state
    this.transitionsService.deleteAllTransitions();
    this.data.transitions.forEach((transition) => {
      const type = transition.typeV2 ?? transition.type;
      this.transitionsService.createTransition(type, transition.name, {
        id: transition.id,
        duration: transition.duration,
        settings: transition.settings,
        propertiesManagerSettings: transition.propertiesManagerSettings,
      });
    });

    // Double check we are starting from a blank state
    this.transitionsService.deleteAllConnections();
    this.data.connections.forEach((connection) => {
      this.transitionsService.addConnection(
        connection.fromSceneId,
        connection.toSceneId,
        connection.transitionId,
      );
    });

    if (this.data.defaultTransitionId) {
      this.transitionsService.setDefaultTransition(this.data.defaultTransitionId);
    }
  }

  migrate(version: number) {
    // Migrate from version 1 schemas, where we only had a single global
    // transition and no support for connections.
    if (version === 1) {
      const data: Dictionary<any> = this.data;
      const transition: ITransition = {
        id: '',
        name: 'Global Transition',
        type: data['type'],
        duration: data['duration'],
        settings: data['settings'],
        propertiesManagerSettings: data['propertiesManagerSettings'],
      };
      this.data.transitions = [transition];
      this.data.connections = [];
    }
  }
}
