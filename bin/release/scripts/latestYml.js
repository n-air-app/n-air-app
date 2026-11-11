// @ts-check

const fs = require('node:fs');
const yaml = require('js-yaml');

/**
 * electron-builder が生成した latest.yml に releaseNotes を追記して書き戻す
 * @param {string} latestYmlFilePath
 * @param {string} notes
 * @returns {{releaseNotes: string, path: string}}
 */
function addReleaseNotesToLatestYml(latestYmlFilePath, notes) {
  const parsedLatestYml = /** @type {{releaseNotes: string, path: string}} */ (
    yaml.load(fs.readFileSync(latestYmlFilePath, 'utf-8'))
  );

  parsedLatestYml.releaseNotes = notes;
  fs.writeFileSync(latestYmlFilePath, yaml.dump(parsedLatestYml));

  return parsedLatestYml;
}

module.exports = {
  addReleaseNotesToLatestYml,
};
