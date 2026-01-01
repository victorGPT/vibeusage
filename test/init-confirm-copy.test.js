const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

function loadInitWithStubs({ onPrompt }) {
  const cliUiPath = path.join(__dirname, '..', 'src', 'lib', 'cli-ui.js');
  const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');

  delete require.cache[cliUiPath];
  delete require.cache[initPath];

  require.cache[cliUiPath] = {
    id: cliUiPath,
    filename: cliUiPath,
    loaded: true,
    exports: {
      BOLD: '',
      DIM: '',
      CYAN: '',
      RESET: '',
      color: (text) => text,
      isInteractive: () => true,
      promptMenu: async (payload) => {
        if (typeof onPrompt === 'function') onPrompt(payload);
        const opts = payload?.options || [];
        return opts[1] || 'No, exit';
      },
      createSpinner: () => ({
        start() {},
        stop() {}
      })
    }
  };

  return require(initPath);
}

test('init confirmation prompt uses new copy', async () => {
  const prevWrite = process.stdout.write;
  let output = '';
  let promptPayload = null;

  try {
    process.stdout.write = (chunk) => {
      output += String(chunk || '');
      return true;
    };

    const { cmdInit } = loadInitWithStubs({
      onPrompt: (payload) => {
        promptPayload = payload;
      }
    });

    await cmdInit([]);

    assert.ok(promptPayload, 'expected prompt payload');
    assert.equal(promptPayload.message, '? Proceed with installation?');
    assert.deepEqual(promptPayload.options, ['Yes, configure my environment', 'No, exit']);
    assert.ok(output.includes('Setup cancelled.'), 'expected cancellation message');
  } finally {
    process.stdout.write = prevWrite;
    const cliUiPath = path.join(__dirname, '..', 'src', 'lib', 'cli-ui.js');
    const initPath = path.join(__dirname, '..', 'src', 'commands', 'init.js');
    delete require.cache[cliUiPath];
    delete require.cache[initPath];
  }
});
