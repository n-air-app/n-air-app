// dist/ にあるインストーラを対話なしで実行し、インストール完了後にアプリを起動する。
// package:local に限らず、package:public-stable / package:internal-stable など
// dist/ に n-air-app-setup.*.exe を生成するどのビルドにも使える。
//
// perMachine:true のため app-builder-lib が生成する installer.nsi は
// RequestExecutionLevel admin を出力する。child_process.spawn は CreateProcess を使うため
// 昇格が必要な exe を非昇格プロセスから起動できず ERROR_ELEVATION_REQUIRED(740) になる。
// ShellExecute 経由で UAC 昇格させるため PowerShell の Start-Process を使う。

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TAG = '[install:dist]';
const distDir = path.join(path.resolve(__dirname, '..'), 'dist');
const installerPattern = /^n-air-app-setup\..+\.exe$/i;
const buildHint = '先に `pnpm run package:local:install`（または `pnpm run compile:production && pnpm run package:local` 等）を実行してください。';

// package.json の version と dist の成果物のバージョンが一致しないことがあるため、
// ファイル名を組み立てずに dist/ を走査して最新のインストーラを探す。
function findInstaller() {
  let entries;
  try {
    entries = fs.readdirSync(distDir);
  } catch {
    throw new Error(`dist/ がありません。${buildHint}`);
  }

  const candidates = entries
    .filter((name) => installerPattern.test(name))
    .map((name) => ({ name, mtimeMs: fs.statSync(path.join(distDir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`dist/ に n-air-app-setup.*.exe が見つかりません。${buildHint}`);
  }
  if (candidates.length > 1) {
    console.warn(`${TAG} インストーラが ${candidates.length} 個あります。最新の ${candidates[0].name} を使います。`);
  }
  return path.join(distDir, candidates[0].name);
}

// dist/win-unpacked の exe 名から、これから何をインストールするかを表示する。
// public-stable/internal-stable/local は appId が同じ（unstable/internal-unstable も
// 別の appId で同じ扱い）ため、同じグループの既存インストールを上書き/アンインストールする。
function logInstallTarget() {
  const unpackedDir = path.join(distDir, 'win-unpacked');
  if (!fs.existsSync(unpackedDir)) return;
  const exeName = fs.readdirSync(unpackedDir).find((name) => name.toLowerCase().endsWith('.exe'));
  if (!exeName) return;
  console.log(`${TAG} インストール対象: ${exeName}`);
  console.warn(`${TAG} 注意: appId が同じ他チャンネル（public-stable/internal-stable/local は同一 appId）の既存インストールがあれば上書き/アンインストールされます。`);
}

function powershellPath() {
  const fullPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  return fs.existsSync(fullPath) ? fullPath : 'powershell.exe';
}

function main() {
  const noRun = process.argv.slice(2).includes('--no-run');
  const installerPath = findInstaller();
  logInstallTarget();

  // /S           : サイレントインストール
  // --updated    : VC++ ランタイム導入済みなら vc_redist のダウンロードをスキップし、
  //                起動中アプリを確認ダイアログなしで終了させる
  // --force-run  : サイレント時もインストール後にアプリを起動する
  //                （ExecShellAsUser 経由なのでアプリは非管理者権限で起動される）
  const installerArgs = ['/S', '--updated'];
  if (!noRun) installerArgs.push('--force-run');

  console.log(`${TAG} ${path.basename(installerPath)} ${installerArgs.join(' ')}`);
  console.log(`${TAG} UAC の確認ダイアログが1回表示されます（管理者権限のシェルで実行した場合は表示されません）。`);

  // インストーラのパスは環境変数で渡す（空白などを含んでも壊れないようにするため）
  const psScript = `
$ErrorActionPreference = 'Stop'
try {
  # Start-Process は ShellExecute 経由なのでマニフェストに従って自動昇格する
  # （既に管理者権限のシェルで実行した場合はダイアログは出ない）
  $proc = Start-Process -FilePath $env:NAIR_INSTALLER_PATH -ArgumentList ${installerArgs.map((arg) => `'${arg}'`).join(',')} -PassThru
} catch {
  Write-Host $_.Exception.Message
  exit 1223
}
$proc.WaitForExit()
try { exit $proc.ExitCode } catch { exit 0 }
`;

  const result = spawnSync(powershellPath(), ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    stdio: 'inherit',
    env: { ...process.env, NAIR_INSTALLER_PATH: installerPath },
  });
  if (result.error) throw result.error;

  const code = result.status ?? 1;
  if (code === 1223) {
    console.error(`${TAG} UAC がキャンセルされたか、インストーラを起動できませんでした。`);
  } else if (code !== 0) {
    console.error(`${TAG} インストーラが異常終了しました (exit ${code})。`);
  } else if (noRun) {
    console.log(`${TAG} インストール完了（--no-run のためアプリは起動しません）。`);
  } else {
    console.log(`${TAG} インストール完了。アプリを起動しました（画面表示まで数秒かかります）。`);
  }
  process.exit(code);
}

try {
  main();
} catch (e) {
  console.error(`${TAG} ${e.message}`);
  process.exit(1);
}
