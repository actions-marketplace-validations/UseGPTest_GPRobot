const acorn = require('acorn');
const parseDiff = require('parse-diff');
const { getFileContent } = require('./Octokit');
const { DIFF_NULL_PATH } = require('./Constants');

function getModifiedLinesFromDiff(diff) {
  // modifiedLines: filePath -> [{startLine, finalLine}]
  const modifiedLines = {};
  const parsedDiff = parseDiff(diff);
  parsedDiff.forEach((file) => {
    const filePath = file.to || file.from;
    file.chunks.forEach((chunk) => {
      if (!modifiedLines[filePath]) {
        modifiedLines[filePath] = [];
      }
      modifiedLines[filePath].push({
        startLine: chunk.newStart,
        endLine: chunk.newStart + chunk.newLines,
      });
    });
  });
  return modifiedLines;
}

async function getModifiedFunctions(diff) {
  const modifiedFunctions = []; // map: filePath -> [functionName]
  const modifiedLines = getModifiedLinesFromDiff(diff);

  for (const filePath in modifiedLines) {
    console.log('DiffParser.getModifiedFunctions: filePath=' + filePath);
    if (filePath == DIFF_NULL_PATH) {
      continue;
    }
    const modifiedLinesInFile = modifiedLines[filePath];
    const file = await getFileContent(filePath);
    console.log('DiffParser.getModifiedFunctions: file=' + file);
    const fileParsed = acorn.parse(file, { ecmaVersion: 2020 });
    console.log('DiffParser.getModifiedFunctions: fileParsed=' + fileParsed);
    for (let i = 0; i < fileParsed.body.length; i++) {
      const node = fileParsed.body[i];
      if (node.type == 'FunctionDeclaration') {
        for (const { startLine, finalLine } of modifiedLinesInFile) {
          if (
            (node.start >= startLine && node.start <= finalLine) ||
            (node.end >= startLine && node.end <= finalLine)
          ) {
            if (!modifiedFunctions[filePath]) {
              modifiedFunctions[filePath] = [];
            }
            modifiedFunctions[filePath].push(node.id.name);
          }
        }
      }
    }
  }
  return modifiedFunctions;
}

module.exports = { getModifiedFunctions };