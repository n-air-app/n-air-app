// @ts-check

const fs = require('fs');
const sh = require('shelljs');
const { DateTime } = require('luxon');
const { info, error, executeCmd } = require('./log');
const { getTagCommitId } = require('./util');

// previous tag should be following rule:
//  v{major}.{minor}.{yyyymmdd}-[{channel}.]{ord}[internalMark]
const VERSION_REGEXP =
  /(?<major>\d+)\.(?<minor>\d+)\.(?<date>\d{8})-((?<channel>\w+)\.)?(?<ord>\d+)(?<internalMark>d)?/;

function parseVersion(tag) {
  const result = VERSION_REGEXP.exec(tag);
  if (result && result.groups) return result.groups;
  throw new Error(`cannot parse a given tag: ${tag}`);
}

/** @typedef {{ channel: 'stable' | 'unstable', environment: 'public' | 'internal' }} VersionContext */

/**
 * @param {string} tag
 * @returns {VersionContext}
 */
function getVersionContext(tag) {
  const result = parseVersion(tag);
  if (result.channel === 'stable') {
    throw new Error('stable channel must have no prefix');
  }

  const channel = result.channel || 'stable';
  const environment = result.internalMark ? 'internal' : 'public';

  if (channel !== 'stable' && channel !== 'unstable') {
    throw new Error(`invalid channel: ${channel}`);
  }

  return {
    channel,
    environment,
  };
}

/**
 * @param {VersionContext} a
 * @param {VersionContext} b
 */
function isSameVersionContext(a, b) {
  return a.channel === b.channel && a.environment === b.environment;
}

function validateVersionContext({ versionTag, releaseEnvironment, releaseChannel }) {
  const { channel, environment } = getVersionContext(versionTag);

  if (releaseChannel !== channel || releaseEnvironment !== environment) {
    throw new Error('invalid version context');
  }
}

function generateNewVersion({ previousVersion, now = Date.now() }) {
  const { major, minor, date, channel, ord, internalMark } = parseVersion(previousVersion);

  const today = DateTime.fromMillis(now).toFormat('yyyyMMdd');
  const newOrd = date === today ? parseInt(ord, 10) + 1 : 1;
  const channelPrefix = channel ? `${channel}.` : '';
  return `${major}.${minor}.${today}-${channelPrefix}${newOrd}${internalMark || ''}`;
}

function splitToLines(lines) {
  if (typeof lines === 'string') {
    return lines.split(/\r?\n/g);
  }
  return lines;
}

function readPatchNoteFile(patchNoteFileName) {
  try {
    const lines = splitToLines(fs.readFileSync(patchNoteFileName, { encoding: 'utf8' }));
    const version = lines.shift();
    return {
      version,
      lines,
    };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return null;
  }
}

function writePatchNoteFile(patchNoteFileName, version, contents) {
  const lines = splitToLines(contents);
  const body = [version, ...lines].join('\n');
  fs.writeFileSync(patchNoteFileName, body);
}

/**
 * Get merge commit log since previous version
 * @param {string} previousVersion - Previous version tag
 * @returns {string} Git log output
 */
function gitLog(previousVersion) {
  return executeCmd(`git log --oneline --merges v${previousVersion}..`, { silent: true }).stdout;
}

/**
 * Get priority level for sorting based on Japanese prefix
 * @param {string} line - Line to check for prefix
 * @returns {number} Priority level (lower = higher priority)
 */
function level(line) {
  if (line.startsWith('追加:')) {
    return 0;
  }
  if (line.startsWith('変更:')) {
    return 1;
  }
  if (line.startsWith('修正:')) {
    return 2;
  }
  if (line.startsWith('開発:')) {
    return 999; // 開発は最後に
  }
  return 3;
}

/**
 *
 * @param {Object} param0
 * @param {import('@octokit/rest').Octokit} param0.octokit
 * @param {string} param0.owner
 * @param {string} param0.repo
 * @param {*} previousVersion
 * @param {*} param2
 * @returns
 */
async function collectPullRequestMerges({ octokit, owner, repo }, previousVersion, { addAuthor }) {
  const merges = gitLog(previousVersion);

  const promises = [];
  for (const line of merges.split(/\r?\n/)) {
    const pr = line.match(/.*Merge pull request #([0-9]*).*/);
    if (!pr || pr.length < 2) {
      continue;
    }
    const pullNumber = parseInt(pr[1], 10);
    promises.push(
      octokit.pulls.get({ owner, repo, pull_number: pullNumber }).catch(e => {
        info(e);
        return { data: {} };
      }),
    );
  }

  return Promise.all(promises).then(results => {
    const summary = [];
    for (const result of results) {
      const { data } = result;
      if ('title' in data) {
        const elements = [data.title, `(#${data.number})`];
        if (addAuthor) {
          elements.push(`by ${data.user.login}`);
        }
        summary.push(elements.join(' ') + '\n');
      }
    }

    summary.sort((a, b) => {
      const d = level(a) - level(b);
      if (d) {
        return d;
      }
      if (a < b) {
        return -1;
      }
      if (a === b) {
        return 0;
      }
      return 1;
    });

    return summary.join('');
  });
}

/**
 * Collect non-PR merge commits and their included commits
 * @param {string} previousVersion - Previous version tag (e.g., "1.0.20190826-2")
 * @returns {Promise<string>} Formatted merge commits with their included commits
 */
async function collectNonPRMerges(previousVersion) {
  // Get all merge commits since previous version
  const merges = gitLog(previousVersion);

  /** @type {Array<{subject: string, hash: string, includedCommits: string[]}>} */
  const nonPRMerges = [];

  for (const line of merges.split(/\r?\n/)) {
    if (!line.trim()) continue;

    // Skip PR merges
    if (line.match(/Merge pull request #[0-9]+/)) {
      continue;
    }

    // Parse merge commit: hash and subject
    const match = line.match(/^([0-9a-f]+)\s+(.+)$/);
    if (!match) continue;

    const [, hash, subject] = match;

    // Check if this is a real merge (has 2+ parents) to avoid fast-forward merges
    const parentsCmd = executeCmd(`git rev-list --parents -n 1 ${hash}`, { silent: true });
    const parentCount = parentsCmd.stdout.trim().split(/\s+/).length - 1;

    if (parentCount < 2) {
      // Fast-forward merge or not a real merge, skip
      continue;
    }

    // Get commits included in this merge (from feature branch)
    // Using ^2 to get the second parent (feature branch)
    // Note: Use sh.exec directly to allow error cases (e.g., invalid range)
    const gitCmd = `git log --no-merges --format="%s (%h)" v${previousVersion}..${hash}^2`;
    const includedCommitsResult = sh.exec(gitCmd, { silent: true });

    // If git command failed (e.g., ^2 is older than previousVersion), skip this merge
    if (includedCommitsResult.code !== 0) {
      continue;
    }

    const includedCommits = includedCommitsResult.stdout
      .split(/\r?\n/)
      .filter(/** @param {string} line */ line => line.trim())
      .map(/** @param {string} line */ line => `  - ${line}`);

    if (includedCommits.length > 0) {
      nonPRMerges.push({
        subject,
        hash, // Already 7 chars from --oneline
        includedCommits,
      });
    }
  }

  // Sort by prefix level using shared level() function
  nonPRMerges.sort((a, b) => {
    const d = level(a.subject) - level(b.subject);
    if (d) return d;

    if (a.subject < b.subject) return -1;
    if (a.subject === b.subject) return 0;
    return 1;
  });

  // Format output
  if (nonPRMerges.length === 0) {
    return '';
  }

  const formatted = nonPRMerges.map(merge => {
    const header = `${merge.subject} (${merge.hash})`;
    return `${header}\n${merge.includedCommits.join('\n')}`;
  });

  return formatted.join('\n\n');
}

function generateNotesTsContent(version, title, notes) {
  const patchNote = `import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '${version}',
  title: '${title}',
  notes: [
${notes
  .trim()
  .split('\n')
  .map(s => `    ${JSON.stringify(s)},`)
  .join('\n')}
  ]
};
`;
  info(`patch-note: '${patchNote}'`);
  return patchNote;
}

function updateNotesTs({ title, version, notes, filePath }) {
  const generatedPatchNote = generateNotesTsContent(title, version, notes);

  fs.writeFileSync(filePath, generatedPatchNote);
}

/**
 * @param {object} param0
 * @param {string} param0.patchNoteFileName
 * @returns {{version: string, notes: string}}
 */
function readPatchNote({ patchNoteFileName }) {
  const patchNote = readPatchNoteFile(patchNoteFileName);

  if (!patchNote) {
    error(`${patchNoteFileName} is absent. Generate it before release.`);
    throw new Error(`${patchNoteFileName} is absent.`);
  }

  return {
    version: patchNote.version,
    notes: patchNote.lines.join('\n'),
  };
}

module.exports = {
  parseVersion,
  getVersionContext,
  generateNewVersion,
  isSameVersionContext,
  validateVersionContext,
  readPatchNoteFile,
  writePatchNoteFile,
  collectPullRequestMerges,
  collectNonPRMerges,
  updateNotesTs,
  readPatchNote,
  generateNotesTsContent,
};
