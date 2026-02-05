const {
  parseVersion,
  getVersionContext,
  validateVersionContext,
  generateNewVersion,
  generateNotesTsContent,
} = require('./patchNote');

const fixtures = {
  public: {
    stable: '1.0.20190826-2',
    unstable: '1.0.20190826-unstable.2',
  },
  internal: {
    stable: '1.0.20190826-2d',
    unstable: '1.0.20190826-unstable.2d',
  },
};
const TODAY = new Date('2019-08-26').valueOf();
const TOMORROW = new Date('2019-08-27').valueOf();

function* channelEnvironmentSets() {
  for (const releaseEnvironment of ['public', 'internal']) {
    for (const releaseChannel of ['stable', 'unstable']) {
      yield {
        releaseChannel,
        releaseEnvironment,
      };
    }
  }
}

for (const fixtureSet of channelEnvironmentSets()) {
  const versionTag = fixtures[fixtureSet.releaseEnvironment][fixtureSet.releaseChannel];

  describe(`${fixtureSet.releaseEnvironment}向け${fixtureSet.releaseChannel}リリースのタグ`, () => {
    for (const set of channelEnvironmentSets()) {
      if (
        fixtureSet.releaseChannel === set.releaseChannel &&
        fixtureSet.releaseEnvironment === set.releaseEnvironment
      ) {
        test('条件が一致していればthrowしない', () => {
          expect(() => validateVersionContext({ ...set, versionTag })).not.toThrow();
        });
      } else {
        test(`不一致ならthrowする（${set.releaseEnvironment}向け${set.releaseChannel}リリース扱い）`, () => {
          expect(() => validateVersionContext({ ...set, versionTag })).toThrow();
        });
      }
    }
  });
}

test('バージョンがパースできる(public stable)', () => {
  expect(parseVersion(fixtures.public.stable)).toMatchInlineSnapshot(`
    {
      "channel": undefined,
      "date": "20190826",
      "internalMark": undefined,
      "major": "1",
      "minor": "0",
      "ord": "2",
    }
  `);
});
test('バージョンがパースできる(public unstable)', () => {
  expect(parseVersion(fixtures.public.unstable)).toMatchInlineSnapshot(`
    {
      "channel": "unstable",
      "date": "20190826",
      "internalMark": undefined,
      "major": "1",
      "minor": "0",
      "ord": "2",
    }
  `);
});
test('バージョンがパースできる(internal stable)', () => {
  expect(parseVersion(fixtures.internal.stable)).toMatchInlineSnapshot(`
    {
      "channel": undefined,
      "date": "20190826",
      "internalMark": "d",
      "major": "1",
      "minor": "0",
      "ord": "2",
    }
  `);
});
test('バージョンがパースできる(internal unstable)', () => {
  expect(parseVersion(fixtures.internal.unstable)).toMatchInlineSnapshot(`
    {
      "channel": "unstable",
      "date": "20190826",
      "internalMark": "d",
      "major": "1",
      "minor": "0",
      "ord": "2",
    }
  `);
});

test('stableチャンネルの場合はバージョン中のチャンネル部分があったらエラー', () => {
  expect(() => getVersionContext('1.0.20190826-stable.2')).toThrow();
});

test('知らないチャンネルを名乗っていたらエラー', () => {
  expect(() => getVersionContext('1.0.20190826-hogehoge.2')).toThrow();
});

test('バージョンがパースできる(public stable)', () => {
  expect(getVersionContext(fixtures.public.stable)).toMatchInlineSnapshot(`
    {
      "channel": "stable",
      "environment": "public",
    }
  `);
});
test('バージョンがパースできる(public unstable)', () => {
  expect(getVersionContext(fixtures.public.unstable)).toMatchInlineSnapshot(`
    {
      "channel": "unstable",
      "environment": "public",
    }
  `);
});
test('バージョンがパースできる(internal stable)', () => {
  expect(getVersionContext(fixtures.internal.stable)).toMatchInlineSnapshot(`
    {
      "channel": "stable",
      "environment": "internal",
    }
  `);
});
test('バージョンがパースできる(internal unstable)', () => {
  expect(getVersionContext(fixtures.internal.unstable)).toMatchInlineSnapshot(`
    {
      "channel": "unstable",
      "environment": "internal",
    }
  `);
});

const versionContexts = [...channelEnvironmentSets()].map(o => ({
  channel: o.releaseChannel,
  environment: o.releaseEnvironment,
}));

test('ふたつのVersionContextが同じか否か判定できる', () => {
  versionContexts.forEach((a, i) => {
    versionContexts.forEach((b, j) => {
      if (i === j) {
        expect(a).toEqual(b);
      } else {
        expect(a).not.toEqual(b);
      }
    });
  });
});

test('次のバージョンを生成する(当日、publicでstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.public.stable, now: TODAY }),
  ).toMatchInlineSnapshot(`"1.0.20190826-3"`);
});
test('次のバージョンを生成する(当日、publicでunstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.public.unstable, now: TODAY }),
  ).toMatchInlineSnapshot(`"1.0.20190826-unstable.3"`);
});
test('次のバージョンを生成する(当日、internalでstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.internal.stable, now: TODAY }),
  ).toMatchInlineSnapshot(`"1.0.20190826-3d"`);
});
test('次のバージョンを生成する(当日、internalでunstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.internal.unstable, now: TODAY }),
  ).toMatchInlineSnapshot(`"1.0.20190826-unstable.3d"`);
});

test('次のバージョンを生成する(別日、publicでstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.public.stable, now: TOMORROW }),
  ).toMatchInlineSnapshot(`"1.0.20190827-1"`);
});
test('次のバージョンを生成する(別日、publicでunstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.public.unstable, now: TOMORROW }),
  ).toMatchInlineSnapshot(`"1.0.20190827-unstable.1"`);
});
test('次のバージョンを生成する(別日、internalでstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.internal.stable, now: TOMORROW }),
  ).toMatchInlineSnapshot(`"1.0.20190827-1d"`);
});
test('次のバージョンを生成する(別日、internalでunstable)', () => {
  expect(
    generateNewVersion({ previousVersion: fixtures.internal.unstable, now: TOMORROW }),
  ).toMatchInlineSnapshot(`"1.0.20190827-unstable.1d"`);
});

test('patch-noteに引用符があったらエスケープされる', () => {
  expect(generateNotesTsContent('version', 'title', 'a"b"c')).toBe(`import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: 'version',
  title: 'title',
  notes: [
    "a\\"b\\"c",
  ],
};
`);
});

// Mock the log module for collectNonPRMerges tests
jest.mock('./log', () => {
  const actualLog = jest.requireActual('./log');
  return {
    ...actualLog,
    executeCmd: jest.fn(),
  };
});

const { collectNonPRMerges } = require('./patchNote');
const { executeCmd } = require('./log');
const sh = require('shelljs');

describe('collectNonPRMerges', () => {
  let execSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    execSpy = jest.spyOn(sh, 'exec');
  });

  afterEach(() => {
    if (execSpy) {
      execSpy.mockRestore();
    }
  });

  test('非PRマージを検出する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/test"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1 parent2', // 2 parents
      });

    execSpy.mockReturnValueOnce({
      code: 0,
      stdout: '修正: バグを修正 (def456)\n追加: 新機能 (ghi789)', // git log output (newest first)
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toContain('Merge branch "feature/test" (abc1234)');
    // Commits are shown in chronological order (oldest first, reversed from git log)
    expect(result).toContain('  - 追加: 新機能 (ghi789)');
    expect(result).toContain('  - 修正: バグを修正 (def456)');
    // Verify the order
    const lines = result.split('\n');
    const addIndex = lines.findIndex(l => l.includes('追加: 新機能'));
    const fixIndex = lines.findIndex(l => l.includes('修正: バグを修正'));
    expect(addIndex).toBeLessThan(fixIndex); // 追加 comes before 修正
  });

  test('PRマージは除外する', async () => {
    executeCmd.mockReturnValueOnce({
      stdout: 'abc1234 Merge pull request #123 from user/branch',
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });

  test('含まれるコミットが0件の場合は空文字列を返す', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/empty"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1 parent2', // 2 parents
      });

    execSpy.mockReturnValueOnce({
      code: 0,
      stdout: '', // 含まれるコミットなし
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });

  test('fast-forwardマージは除外する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/fast-forward"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1', // Only 1 parent (fast-forward)
      });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });

  test('同じブランチの連続マージは空行なしで並ぶ', async () => {
    executeCmd
      .mockReturnValueOnce({
        // Same branch merged twice consecutively (git log: newest first)
        stdout:
          'bbb2222 Merge branch \'feature/test\' into main\naaa1111 Merge branch \'feature/test\' into main',
      })
      .mockReturnValueOnce({ stdout: 'bbb2222 p1 p2' })
      .mockReturnValueOnce({ stdout: 'aaa1111 p1 p2' });

    sh.exec
      .mockReturnValueOnce({ code: 0, stdout: 'Commit 2 (c2)' })
      .mockReturnValueOnce({ code: 0, stdout: 'Commit 1 (c1)' });

    const result = await collectNonPRMerges('1.0.20190826-2');

    // Same branch merged consecutively - no blank line between them
    // After reverse: aaa1111 (oldest) -> bbb2222 (newest)
    const lines = result.split('\n');
    expect(lines[0]).toContain('feature/test');
    expect(lines[1]).toContain('Commit 1');
    expect(lines[2]).toContain('feature/test'); // No blank line
    expect(lines[3]).toContain('Commit 2');
    expect(lines[2]).not.toBe(''); // Verify it's not a blank line
  });

  test('異なるブランチのマージは空行で区切られる', async () => {
    executeCmd
      .mockReturnValueOnce({
        // Different branches: git log order (newest first): A, B, A
        stdout:
          'aaa1111 Merge branch \'feature/A\' into main\nbbb2222 Merge branch \'feature/B\' into main\nccc3333 Merge branch \'feature/A\' into main',
      })
      .mockReturnValueOnce({ stdout: 'aaa1111 p1 p2' })
      .mockReturnValueOnce({ stdout: 'bbb2222 p1 p2' })
      .mockReturnValueOnce({ stdout: 'ccc3333 p1 p2' });

    sh.exec
      .mockReturnValueOnce({ code: 0, stdout: 'Commit A2 (a2)' })
      .mockReturnValueOnce({ code: 0, stdout: 'Commit B1 (b1)' })
      .mockReturnValueOnce({ code: 0, stdout: 'Commit A1 (a1)' });

    const result = await collectNonPRMerges('1.0.20190826-2');

    // Git log order: aaa1111 (newest), bbb2222, ccc3333 (oldest)
    // After reverse: ccc3333 -> bbb2222 -> aaa1111 (oldest to newest)
    // Which is: A (ccc) -> B (bbb) -> A (aaa)
    // Expected: A, blank line, B, blank line, A
    const lines = result.split('\n');
    expect(lines[0]).toContain('feature/A');
    expect(lines[1]).toContain('Commit A1');
    expect(lines[2]).toBe(''); // Blank line before different branch
    expect(lines[3]).toContain('feature/B');
    expect(lines[4]).toContain('Commit B1');
    expect(lines[5]).toBe(''); // Blank line before returning to feature/A
    expect(lines[6]).toContain('feature/A');
    expect(lines[7]).toContain('Commit A2');
  });

  test('フォーマットが正しい', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/test"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1 parent2',
      });

    execSpy.mockReturnValueOnce({
      code: 0,
      stdout: 'Fix bug (def456)\nAdd feature (ghi789)', // git log output (newest first)
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    const lines = result.split('\n');
    expect(lines[0]).toBe('Merge branch "feature/test" (abc1234)');
    // Chronological order (oldest first, reversed from git log)
    expect(lines[1]).toBe('  - Add feature (ghi789)');
    expect(lines[2]).toBe('  - Fix bug (def456)');
  });

  test('複数の非PRマージを正しく処理する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/A"\ndef5678 Merge branch "hotfix/B"',
      })
      .mockReturnValueOnce({ stdout: 'abc1234 p1 p2' })
      .mockReturnValueOnce({ stdout: 'def5678 p1 p2' });

    sh.exec
      .mockReturnValueOnce({
        code: 0,
        stdout: 'Commit A1 (a1)\nCommit A2 (a2)', // git log output (newest first)
      })
      .mockReturnValueOnce({
        code: 0,
        stdout: 'Commit B1 (b1)',
      });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toContain('Merge branch "feature/A" (abc1234)');
    // Chronological order (oldest first)
    expect(result).toContain('  - Commit A2 (a2)');
    expect(result).toContain('  - Commit A1 (a1)');
    expect(result).toContain('Merge branch "hotfix/B" (def5678)');
    expect(result).toContain('  - Commit B1 (b1)');
    // Verify order for feature/A
    const lines = result.split('\n');
    const a2Index = lines.findIndex(l => l.includes('Commit A2'));
    const a1Index = lines.findIndex(l => l.includes('Commit A1'));
    expect(a2Index).toBeLessThan(a1Index); // A2 (older) comes before A1 (newer)
  });

  test('マージコミットが全くない場合は空文字列を返す', async () => {
    executeCmd.mockReturnValueOnce({
      stdout: '', // マージコミットなし
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });

  test('git logコマンドがエラーの場合はそのマージをスキップする', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/test"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 p1 p2',
      });

    execSpy.mockReturnValueOnce({
      code: 128,
      stdout: '',
      stderr: 'fatal: Invalid revision range',
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });
});
