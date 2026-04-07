#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  resolveSetPath,
  buildPromptBundle,
  writePromptBundleToSet,
  selectCards,
} = require('./card-image-system.js');

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    set: null,
    card: null,
    cards: null,
    range: null,
    all: false,
    side: 'front',
    format: 'json',
    output: null,
    writeSet: false,
    includeSource: true,
    promptFormat: 'text',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--set' && args[i + 1]) opts.set = args[++i];
    else if (arg === '--card' && args[i + 1]) opts.card = args[++i];
    else if (arg === '--cards' && args[i + 1]) opts.cards = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--range' && args[i + 1]) {
      const raw = args[++i];
      const [start, end] = raw.split('-').map((s) => s.trim());
      if (start && end) opts.range = [start, end];
    } else if (arg === '--all') opts.all = true;
    else if (arg === '--side' && args[i + 1]) opts.side = args[++i];
    else if (arg === '--format' && args[i + 1]) opts.format = args[++i];
    else if (arg === '--output' && args[i + 1]) opts.output = args[++i];
    else if (arg === '--write-set') opts.writeSet = true;
    else if (arg === '--no-source') opts.includeSource = false;
    else if (arg === '--prompt-format' && args[i + 1]) opts.promptFormat = args[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }

  return opts;
}

function usage() {
  console.log(`Usage: card-image-prompts [options]

Build modular OpenClaw AI prompt payloads for trading cards.

Options:
  --set <code|file>      Set code or path. Defaults to active set.
  --card <num>           Single card number, e.g. 097
  --cards <a,b,c>        Multiple card numbers, comma-separated
  --range <a-b>          Inclusive card range, e.g. 001-025
  --all                  Process all cards in the set
  --side <front|back|both>  Which card side to build
  --format <json|text>   Output format
  --output <file>        Write output to file
  --write-set            Persist prompt payloads back into the set JSON
  --no-source            Omit original flat prompt fields from payload
  --prompt-format <text|json>  Render the prompt as sectioned text or structured JSON
`);
}

function normalizeNum(value) {
  return String(value || '').trim().padStart(3, '0');
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    usage();
    return;
  }

  const setPath = resolveSetPath(opts.set);
  const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  const cards = selectCards(set, {
    card: opts.card,
    cards: opts.cards,
    range: opts.range,
    all: opts.all,
  });

  if (!cards.length) {
    throw new Error('No cards matched the selection.');
  }

  const payloads = [];
  const bundleByCardNum = new Map();

  for (const card of cards) {
    const bundle = buildPromptBundle(card, set, opts.side, { includeSource: opts.includeSource, promptFormat: opts.promptFormat });
    const key = normalizeNum(card.num || card.cardNum || '');
    if (opts.side === 'both') {
      payloads.push(bundle);
      bundleByCardNum.set(key, bundle);
    } else {
      payloads.push(bundle);
      bundleByCardNum.set(key, { [opts.side]: bundle });
    }
  }

  let output;
  if (opts.format === 'text') {
    output = payloads.map((payload) => {
      if (payload.front || payload.back) {
        return [
          payload.front ? payload.front.prompt : '',
          payload.back ? payload.back.prompt : '',
        ].filter(Boolean).join('\n\n---\n\n');
      }
      return payload.prompt;
    }).join('\n\n==========\n\n');
  } else {
    output = JSON.stringify({
      set: {
        code: set.code || '',
        name: set.name || '',
        category: set.setCategory || set.category || 'character',
      },
      side: opts.side,
      count: cards.length,
      payloads,
    }, null, 2);
  }

  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), output);
  } else {
    process.stdout.write(output + '\n');
  }

  if (opts.writeSet) {
    const updatedSet = writePromptBundleToSet(set, bundleByCardNum);
    fs.writeFileSync(setPath, JSON.stringify(updatedSet, null, 2));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, main };
