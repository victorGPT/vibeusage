const path = require('node:path');

const { writeFileAtomic, chmod600IfPossible } = require('../lib/fs');
const { collectTrackerDiagnostics } = require('../lib/diagnostics');

async function cmdDiagnostics(argv = []) {
  const opts = parseArgs(argv);
  const diagnostics = await collectTrackerDiagnostics();
  const json = JSON.stringify(diagnostics, null, opts.compact ? 0 : 2) + '\n';

  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out);
    await writeFileAtomic(outPath, json);
    await chmod600IfPossible(outPath);
    process.stderr.write(`Wrote diagnostics to: ${outPath}\n`);
  }

  process.stdout.write(json);
}

function parseArgs(argv) {
  const out = {
    out: null,
    compact: false
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.out = argv[++i] || null;
    else if (a === '--compact') out.compact = true;
    else if (a === '--pretty') out.compact = false;
    else throw new Error(`Unknown option: ${a}`);
  }

  return out;
}

module.exports = { cmdDiagnostics };

