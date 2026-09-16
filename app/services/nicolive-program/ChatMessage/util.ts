import {
  ChatMessage,
  GameUpdateMessage,
  GiftMessage,
  MessageResponse,
  NicoadMessage,
  NicoadMessageV0,
  NicoadMessageV1,
  NotificationMessage,
  OperatorMessage,
  SignalMessage,
  StateMessage,
  StatisticsMessage,
} from '../ChatMessage';

export function isPremium(chat: ChatMessage): boolean {
  return !!chat.premium;
}

export function isAnonymous(chat: ChatMessage): boolean {
  return chat.anonymity === 1;
}

export function getScore(chat: ChatMessage): number {
  return chat.score ?? 0;
}

export function isChatMessage(msg: MessageResponse): msg is { chat: ChatMessage } {
  return Object.hasOwn(msg, 'chat');
}

export function isOperatorMessage(msg: MessageResponse): msg is { operator: OperatorMessage } {
  return Object.hasOwn(msg, 'operator');
}

export function isNotificationMessage(
  msg: MessageResponse,
): msg is { notification: NotificationMessage } {
  return Object.hasOwn(msg, 'notification');
}

export function isGiftMessage(msg: MessageResponse): msg is { gift: GiftMessage } {
  return Object.hasOwn(msg, 'gift');
}

export function isNicoadMessage(msg: MessageResponse): msg is { nicoad: NicoadMessage } {
  return Object.hasOwn(msg, 'nicoad');
}

export function isNicoadMessageV0(msg: NicoadMessage): msg is NicoadMessageV0 {
  return Object.hasOwn(msg, 'v0');
}

export function isNicoadMessageV1(msg: NicoadMessage): msg is NicoadMessageV1 {
  return Object.hasOwn(msg, 'v1');
}

export function isGameUpdateMessage(
  msg: MessageResponse,
): msg is { gameUpdate: GameUpdateMessage } {
  return Object.hasOwn(msg, 'gameUpdate');
}

export function isStateMessage(msg: MessageResponse): msg is { state: StateMessage } {
  return Object.hasOwn(msg, 'state');
}

export function isStatisticsMessage(
  msg: MessageResponse,
): msg is { statistics: StatisticsMessage } {
  return Object.hasOwn(msg, 'statistics');
}

export function isSignalMessage(msg: MessageResponse): msg is { signal: SignalMessage } {
  return Object.hasOwn(msg, 'signal');
}
