import { v4 as uuidv4 } from 'uuid';
import { ChatMessageType } from './ChatMessage/classifier';
import { getDisplayText } from './ChatMessage/displaytext';
import { sendLogGif } from './nicolive-logger';
import { HttpRelationState } from './state';
import { isWrappedChat, WrappedMessageWithComponent } from './WrappedChat';

type SendParam = {
  id: string;
  comment: string;
  isOwner: string;
  userId: string;
  name: string;
  isPremium: string;
  isAnonymous: string;
  type: ChatMessageType;
};

export type HttpRelationResult =
  | {
      error: string;
    }
  | {
      result: string;
    };

export class HttpRelation {
  static async sendChat(
    item: WrappedMessageWithComponent,
    httpRelation: HttpRelationState,
  ): Promise<HttpRelationResult> {
    if (!item.value || !item.type) return { error: 'no-value' };

    const bool2string = (b: any) => (b ? 'true' : 'false');

    const param: SendParam = {
      id: '',
      comment: '',
      isOwner: '',
      userId: '',
      name: '',
      isPremium: '',
      isAnonymous: '',
      type: item.type,
    };

    if (isWrappedChat(item)) {
      if (!item.value.content) return { error: 'no-content' };
      param.id = item.value.id ?? uuidv4();
      param.comment = item.value.content;
      param.isOwner = bool2string(item.type === 'operator');
      param.userId = item.value.user_id ?? '-';
      param.name = item.value.name ?? '';
      param.isPremium = bool2string(item.value.premium);
      param.isAnonymous = bool2string(item.value.anonymity);
    } else {
      const comment = getDisplayText(item);
      if (!comment) return { error: 'no-comment' };
      param.comment = comment;
    }

    return await this.send(param, httpRelation);
  }

  static async sendTest(httpRelation: HttpRelationState): Promise<HttpRelationResult> {
    const param: SendParam = {
      id: uuidv4(),
      comment: 'テストコメントです',
      isOwner: 'false',
      userId: '-',
      name: 'test',
      isPremium: 'true',
      isAnonymous: 'false',
      type: 'normal',
    };
    return await this.send(param, httpRelation);
  }

  private static async send(
    param: SendParam,
    httpRelation: HttpRelationState,
  ): Promise<HttpRelationResult> {
    if (!httpRelation || !httpRelation.method) return { error: 'no-settings' };

    const url = httpRelation.url.replace(/{(\w+)}/g, (m, p: keyof SendParam) =>
      encodeURIComponent(param[p] ?? ''),
    );
    const method = httpRelation.method;
    const arg: { [name: string]: any } = { method };
    if (method === 'POST' || method === 'PUT') {
      arg.headers = { 'Content-Type': 'application/json' };
      arg.body = httpRelation.body.replace(/{(\w+)}/g, (m, p: keyof SendParam) =>
        (param[p] ?? '').replace(/"/g, '\\"'),
      );
    }
    //console.log('sendChat', url, arg); // DEBUG

    try {
      const response = await fetch(url, arg);
      if (!response.ok) {
        return { error: `status=${response.status}` };
      }
      return { result: await response.text() };
    } catch (e) {
      return { error: e.toString() };
    }
  }

  static async sendLog(programID: string, uuid: string, httpRelation: HttpRelationState) {
    if (!programID || !httpRelation) return;
    await sendLogGif('http_relation', programID, {
      uuid,
      method: httpRelation.method,
      url: httpRelation.url,
    });
  }
}
