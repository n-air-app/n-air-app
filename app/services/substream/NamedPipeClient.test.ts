
// pnpm run test:unit:app -- NamedPipeClient

import { NamedPipeClient } from './NamedPipeClient';

describe('NamedPipeClient', () => {
    describe('findCompleteJson', () => {
        let client: NamedPipeClient;

        beforeEach(() => {
            client = new NamedPipeClient('test-pipe');
        });

        test('完全な単純なJSONを検出', () => {
            const json = '{"id":"123","res":"ok"}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('ネストしたJSONを検出', () => {
            const json = '{"a":{"b":{"c":"d"}}}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('文字列内の中括弧を無視', () => {
            const json = '{"msg":"use {brackets} here"}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('エスケープされた引用符を正しく処理', () => {
            const json = '{"msg":"say \\"hello\\""}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('エスケープされたバックスラッシュを処理', () => {
            const json = '{"path":"C:\\\\folder\\\\file"}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('複数のJSONが連結されている場合、最初のJSONのみ検出', () => {
            const json1 = '{"id":"1"}';
            const json2 = '{"id":"2"}';
            const combined = json1 + json2;
            expect(client.findCompleteJson(combined)).toBe(json1.length);
        });

        test('不完全なJSONは-1を返す', () => {
            const incomplete = '{"id":"123",';
            expect(client.findCompleteJson(incomplete)).toBe(-1);
        });

        test('開始中括弧がない場合は-1を返す', () => {
            const invalid = 'invalid json}';
            expect(client.findCompleteJson(invalid)).toBe(-1);
        });

        test('空文字列は-1を返す', () => {
            expect(client.findCompleteJson('')).toBe(-1);
        });

        test('文字列が閉じられていないJSONは-1を返す', () => {
            const incomplete = '{"msg":"unclosed';
            expect(client.findCompleteJson(incomplete)).toBe(-1);
        });

        test('ネストが深いJSONを正しく処理', () => {
            const json = '{"a":{"b":{"c":{"d":{"e":"value"}}}}}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('数値や真偽値を含むJSON', () => {
            const json = '{"num":123,"bool":true,"null":null}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('配列を含むJSON（オブジェクト内）', () => {
            const json = '{"arr":[1,2,3],"obj":{}}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('複雑な実際のレスポンス例', () => {
            const json = '{"id":"abc123","res":{"active":true,"error":"","frames":1000}}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });

        test('JSONの後に追加データがある場合', () => {
            const json = '{"id":"1"}';
            const extra = '{"id":"2"}extra';
            const combined = json + extra;
            expect(client.findCompleteJson(combined)).toBe(json.length);
        });

        test('改行を含むJSON（文字列内）', () => {
            const json = '{"msg":"line1\\nline2"}';
            expect(client.findCompleteJson(json)).toBe(json.length);
        });
    });
});
