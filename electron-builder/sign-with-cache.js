// @ts-check

// electron-builder の `win.signtoolOptions.sign` に渡す署名関数。
//
// 同梱している exe（obs-studio-node、crash-handler、vosk-cli、n-voice、elevate.exe など）は
// 依存を更新しない限りリリースごとに中身が変わらないのに、毎回 signtool で署名し直していて
// 1ファイルあたり数秒（大半はタイムスタンプサーバとの通信）かかっていた。
// 署名前の中身と signtool の引数が同じなら署名結果も同じものを使ってよい（タイムスタンプ付きの
// 署名は後から使い回しても有効）ので、署名済みファイルをキャッシュしてコピーで済ませる。
//
// - キーは「署名前ファイルの sha256」と「入力パスを除いた signtool の引数」。引数には証明書の
//   thumbprint、ハッシュアルゴリズム、タイムスタンプサーバ、説明文（/d、製品名）などが含まれるので、
//   証明書の更新や stable / unstable の違いでは別のキーになる。
// - バージョンが埋め込まれるメイン exe、インストーラ、アンインストーラは毎回中身が変わるのでキャッシュしない。
// - キャッシュの場所は既定で %LOCALAPPDATA%\n-air-app\sign-cache。`NAIR_SIGN_CACHE_DIR` で変更できる。
//   キャッシュを捨てて署名し直したいときは、このディレクトリを消せばよい。

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_FORMAT_VERSION = 1;

/** @param {string} filePath */
function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * @param {string} filePath
 * @param {{ productFilename: string, version: string }} appInfo
 */
function shouldCache(filePath, { productFilename, version }) {
  const basename = path.basename(filePath);
  if (basename.toLowerCase() === `${productFilename}.exe`.toLowerCase()) return false;
  if (basename.includes(version)) return false;
  return true;
}

/**
 * signtool の引数から入力ファイル（最後の引数）を除き、キャッシュのキーを作る。
 * @param {string} fileSha256
 * @param {string[]} signToolArgs
 */
function computeCacheKey(fileSha256, signToolArgs) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        v: CACHE_FORMAT_VERSION,
        fileSha256,
        args: signToolArgs.slice(0, -1),
      }),
    )
    .digest('hex');
}

/**
 * 一時ファイルに書いてから rename して、途中で止まっても壊れたファイルが残らないようにする。
 * @param {string} dest
 * @param {(tmp: string) => void} write
 */
function writeAtomically(dest, write) {
  const tmp = `${dest}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    write(tmp);
    fs.renameSync(tmp, dest);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * @typedef {{
 *   path: string,
 *   computeSignToolArgs: (isWin: boolean) => string[],
 * }} SignTask
 *
 * @typedef {{
 *   info: (fields: Record<string, unknown> | null, message: string) => void,
 *   warn: (fields: Record<string, unknown> | null, message: string) => void,
 * }} Logger
 */

/**
 * @param {{
 *   cacheDir: string,
 *   signFile: (task: SignTask) => Promise<void>,
 *   isCacheable: (filePath: string) => boolean,
 *   log: Logger,
 * }} deps
 * @returns {(task: SignTask) => Promise<void>}
 */
function createCachedSigner({ cacheDir, signFile, isCacheable, log }) {
  return async (task) => {
    const filePath = task.path;
    const file = path.basename(filePath);
    if (!isCacheable(filePath)) {
      await signFile(task);
      return;
    }

    const key = computeCacheKey(sha256File(filePath), task.computeSignToolArgs(true));
    const cachedFile = path.join(cacheDir, `${key}${path.extname(filePath)}`);
    const metaFile = path.join(cacheDir, `${key}.json`);

    if (fs.existsSync(cachedFile) && fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (meta.signedSha256 === sha256File(cachedFile)) {
          writeAtomically(filePath, (tmp) => fs.copyFileSync(cachedFile, tmp));
          log.info({ file, key: key.slice(0, 12) }, 'sign cache hit');
          return;
        }
        log.warn({ file, key: key.slice(0, 12) }, 'sign cache is corrupted, signing again');
      } catch (e) {
        log.warn({ file, error: e.message }, 'failed to read sign cache, signing again');
      }
    }

    await signFile(task);

    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      const signedSha256 = sha256File(filePath);
      writeAtomically(cachedFile, (tmp) => fs.copyFileSync(filePath, tmp));
      writeAtomically(metaFile, (tmp) =>
        fs.writeFileSync(
          tmp,
          JSON.stringify(
            { file, signedSha256, createdAt: new Date().toISOString() },
            null,
            2,
          ),
        ),
      );
      log.info({ file, key: key.slice(0, 12) }, 'sign cache stored');
    } catch (e) {
      // キャッシュへの保存に失敗しても、署名自体は済んでいるのでビルドは続ける
      log.warn({ file, error: e.message }, 'failed to store sign cache');
    }
  };
}

function defaultCacheDir() {
  if (process.env.NAIR_SIGN_CACHE_DIR) return process.env.NAIR_SIGN_CACHE_DIR;
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache');
  return path.join(base, 'n-air-app', 'sign-cache');
}

/**
 * electron-builder から呼ばれる署名関数。
 * @param {import('app-builder-lib').CustomWindowsSignTaskConfiguration} configuration
 * @param {import('app-builder-lib').WinPackager} [packager]
 */
async function sign(configuration, packager) {
  if (!packager) {
    throw new Error('sign-with-cache: packager is not given');
  }
  if (configuration.cscInfo == null) {
    // signtoolOptions.sign を指定すると、証明書が見つからないエラーを electron-builder が握りつぶして
    // cscInfo が null のまま呼んでくるので、未署名のままビルドが進まないようここで止める
    throw new Error(
      `sign-with-cache: code signing certificate not found (CERTIFICATE_SUBJECT_NAME=${process.env.CERTIFICATE_SUBJECT_NAME})`,
    );
  }
  const { log } = require('electron-builder');
  const manager = /** @type {import('app-builder-lib').WindowsSignToolManager} */ (
    /** @type {unknown} */ (await packager.signingManager.value)
  );
  const signer = createCachedSigner({
    cacheDir: defaultCacheDir(),
    signFile: () => manager.doSign(configuration, packager),
    isCacheable: (filePath) =>
      shouldCache(filePath, {
        productFilename: packager.appInfo.productFilename,
        version: packager.appInfo.version,
      }),
    log,
  });
  await signer(configuration);
}

module.exports = { sign, createCachedSigner, shouldCache, computeCacheKey };
