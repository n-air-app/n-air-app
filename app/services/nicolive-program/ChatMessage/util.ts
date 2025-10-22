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
  return 'chat' in msg;
}

export function isOperatorMessage(msg: MessageResponse): msg is { operator: OperatorMessage } {
  return 'operator' in msg;
}

export function isNotificationMessage(
  msg: MessageResponse,
): msg is { notification: NotificationMessage } {
  return 'notification' in msg;
}

export function isGiftMessage(msg: MessageResponse): msg is { gift: GiftMessage } {
  return 'gift' in msg;
}

export function isNicoadMessage(msg: MessageResponse): msg is { nicoad: NicoadMessage } {
  return 'nicoad' in msg;
}

export function isNicoadMessageV0(msg: NicoadMessage): msg is NicoadMessageV0 {
  return 'v0' in msg;
}

export function isNicoadMessageV1(msg: NicoadMessage): msg is NicoadMessageV1 {
  return 'v1' in msg;
}

export function isGameUpdateMessage(
  msg: MessageResponse,
): msg is { gameUpdate: GameUpdateMessage } {
  return 'gameUpdate' in msg;
}

export function isStateMessage(msg: MessageResponse): msg is { state: StateMessage } {
  return 'state' in msg;
}

export function isSignalMessage(msg: MessageResponse): msg is { signal: SignalMessage } {
  return 'signal' in msg;
}
