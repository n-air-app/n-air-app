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
  ]
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

describe('collectNonPRMerges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('非PRマージを検出する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/test"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1 parent2', // 2 parents
      })
      .mockReturnValueOnce({
        stdout: '修正: バグを修正 (def456)\n追加: 新機能 (ghi789)',
      });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toContain('Merge branch "feature/test" (abc1234)');
    expect(result).toContain('  - 修正: バグを修正 (def456)');
    expect(result).toContain('  - 追加: 新機能 (ghi789)');
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
      })
      .mockReturnValueOnce({
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

  test('プレフィックスによるソートが機能する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'aaa1111 開発: マージ3\nbbb2222 修正: マージ2\nccc3333 追加: マージ1',
      })
      .mockReturnValueOnce({ stdout: 'aaa1111 p1 p2' })
      .mockReturnValueOnce({ stdout: 'コミット1 (d1)' })
      .mockReturnValueOnce({ stdout: 'bbb2222 p1 p2' })
      .mockReturnValueOnce({ stdout: 'コミット2 (d2)' })
      .mockReturnValueOnce({ stdout: 'ccc3333 p1 p2' })
      .mockReturnValueOnce({ stdout: 'コミット3 (d3)' });

    const result = await collectNonPRMerges('1.0.20190826-2');

    const merges = result.split('\n\n');
    expect(merges[0]).toContain('追加:'); // 最初
    expect(merges[1]).toContain('修正:'); // 2番目
    expect(merges[2]).toContain('開発:'); // 最後
  });

  test('フォーマットが正しい', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/test"',
      })
      .mockReturnValueOnce({
        stdout: 'abc1234 parent1 parent2',
      })
      .mockReturnValueOnce({
        stdout: 'Fix bug (def456)\nAdd feature (ghi789)',
      });

    const result = await collectNonPRMerges('1.0.20190826-2');

    const lines = result.split('\n');
    expect(lines[0]).toBe('Merge branch "feature/test" (abc1234)');
    expect(lines[1]).toBe('  - Fix bug (def456)');
    expect(lines[2]).toBe('  - Add feature (ghi789)');
  });

  test('複数の非PRマージを正しく処理する', async () => {
    executeCmd
      .mockReturnValueOnce({
        stdout: 'abc1234 Merge branch "feature/A"\ndef5678 Merge branch "hotfix/B"',
      })
      .mockReturnValueOnce({ stdout: 'abc1234 p1 p2' })
      .mockReturnValueOnce({
        stdout: 'Commit A1 (a1)\nCommit A2 (a2)',
      })
      .mockReturnValueOnce({ stdout: 'def5678 p1 p2' })
      .mockReturnValueOnce({
        stdout: 'Commit B1 (b1)',
      });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toContain('Merge branch "feature/A" (abc1234)');
    expect(result).toContain('  - Commit A1 (a1)');
    expect(result).toContain('  - Commit A2 (a2)');
    expect(result).toContain('Merge branch "hotfix/B" (def5678)');
    expect(result).toContain('  - Commit B1 (b1)');
  });

  test('マージコミットが全くない場合は空文字列を返す', async () => {
    executeCmd.mockReturnValueOnce({
      stdout: '', // マージコミットなし
    });

    const result = await collectNonPRMerges('1.0.20190826-2');

    expect(result).toBe('');
  });
});
