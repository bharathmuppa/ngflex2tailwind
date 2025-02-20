const fs = require('fs').promises;
const fse = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

async function runTests() {
  // Folders for testing
  const inputDir = path.resolve(__dirname, 'test', 'input');
  const expectedDir = path.resolve(__dirname, 'test', 'output');
  const tempDir = path.resolve(__dirname, 'test', 'temp');

  // Clean up tempDir if it exists and copy input files there
  await fse.remove(tempDir);
  await fse.copy(inputDir, tempDir);
  console.log(`Copied test files from ${inputDir} to ${tempDir}`);

  // Run  migration script over the temporary folder.
  // (Assuming  migration script (e.g. flex2tw.js) accepts a -p parameter.)
  try {
    execSync(`node ./src/flex2tw.js -p ${tempDir}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Migration script failed.');
    process.exit(1);
  }

  // Compare each file in the temp folder with the corresponding expected file.
  const files = await fs.readdir(tempDir);
  let allPassed = true;

  for (const file of files) {
    const tempFilePath = path.join(tempDir, file);
    const expectedFilePath = path.join(expectedDir, file);

    const [tempContent, expectedContent] = await Promise.all([
      fs.readFile(tempFilePath, 'utf8'),
      fs.readFile(expectedFilePath, 'utf8')
    ]);

    try {
      // Compare trimmed contents to avoid minor whitespace differences.
      assert.strictEqual(tempContent.trim(), expectedContent.trim());
      console.log(`${file}: PASSED`);
    } catch (err) {
      console.error(`${file}: FAILED`);
      console.error('--- Output ---');
      console.error(tempContent);
      console.error('--- Expected ---');
      console.error(expectedContent);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('Some tests failed.');
    process.exit(1);
  } else {
    console.log('All tests passed.');
  }
}

runTests();
