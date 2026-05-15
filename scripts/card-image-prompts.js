#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  createTradingLogger,
  summarize,
} = require('./trading-logger.js');
const {
  resolveSetPath,
  buildPromptBundle,
  writePromptBundleToSet,
  selectCards,
} = require('./card-image-system.js');

function loadGlobalConfig() {
  const cfgPath = path.join(__dirname, '..', 'data', 'config.json');
  try { return JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { return {}; }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const cfg = loadGlobalConfig();
  const opts = {
    set: null,
    card: null,
    cards: null,
    range: null,
    all: false,
    side: 'front',
    format: 'json',
    handHeld: cfg.handHeld !== undefined ? cfg.handHeld : true,
    imageOndemand: cfg.imageOndemand !== undefined ? cfg.imageOndemand : true,
    imageModel: cfg.imageModel || 'openai/gpt-image-2',
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
    else if (arg === '--hand-held') opts.handHeld = true;
    else if (arg === '--no-hand-held') opts.handHeld = false;
    else if (arg === '--image-ondemand') opts.imageOndemand = true;
    else if (arg === '--no-image-ondemand') opts.imageOndemand = false;
    else if (arg === '--image-model' && args[i + 1]) opts.imageModel = args[++i];
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
  --format <json|text>   Output format (text for on-demand prompt viewing)
  --output <file>        Write output to file
  --write-set            Persist prompt payloads back into the set JSON
  --no-source            Omit original flat prompt fields from payload
  --prompt-format <text|json>  Render the prompt as sectioned text or structured JSON
  --hand-held              Real-world photography framing (card held in hand). On by default.
  --no-hand-held           Disable hand-held framing (full-frame digital render).
  --image-ondemand         Output prompt for manual use instead of generating. On by default (saves money).
  --no-image-ondemand      Actually generate the image via OpenRouter API.
  --image-model <model>    Image generation model. Default: openai/gpt-image-2
`);
}

function normalizeNum(value) {
  return String(value || '').trim().padStart(3, '0');
}

function formatPromptOutput(payload, card, set, side, opts) {
  const prompt = payload.prompt || '';
  const negative = payload.negativePrompt || '';
  const lines = [
    '',
    '═'.repeat(58),
    `  SET: ${set.code || '?'} — ${set.name || '?'}`,
    `  CARD: #${card.num || card.cardNum || '?'} — ${card.name || 'Untitled'}`,
    `  SIDE: ${side}`,
    '═'.repeat(58),
    '',
    '  📋 PROMPT (copy this into your image generator):',
    '',
    `  ${prompt}`,
  ];

  if (negative) {
    lines.push('', '  ⛔ NEGATIVE PROMPT:', '', `  ${negative}`);
  }

  lines.push(
    '',
    '  ─'.repeat(56),
    `  💡 Tip: Use this prompt with ${opts.imageModel}, Imagen, Midjourney,`,
    '     Dall-E, Stable Diffusion, or any image generator of your choice.',
    '     Running with --no-image-ondemand generates it via OpenRouter automatically.',
    '',
  );

  return lines.join('\n');
}

function generateImageViaOpenRouter(prompt, model, card, set, side, opts) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      reject(new Error('OPENROUTER_API_KEY not set in environment. Cannot generate image.'));
      return;
    }

    // Trading card aspect ratio ~2.5:3.5 → closest is 2:3
    const aspectRatio = side === 'front' ? '2:3' : '3:4';

    const payload = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
      image_config: { aspect_ratio: aspectRatio },
    });

    const reqOpts = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (!result.choices || !result.choices[0]) {
            reject(new Error(`OpenRouter API error: ${result.error?.message || JSON.stringify(result)}`));
            return;
          }
          const message = result.choices[0].message;
          if (!message.images || !message.images.length) {
            reject(new Error('No images returned from OpenRouter'));
            return;
          }
          resolve(message.images[0].imageUrl.url);
        } catch (e) {
          reject(new Error(`Failed to parse OpenRouter response: ${e.message}\n${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`OpenRouter request failed: ${e.message}`)));
    req.write(payload);
    req.end();
  });
}

async function saveImageFromDataUrl(dataUrl, setCode, cardNum, side) {
  const imagesDir = path.join(__dirname, '..', 'data', 'images', setCode);
  fs.mkdirSync(imagesDir, { recursive: true });

  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URL from image response');

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const filename = `${String(cardNum).padStart(3, '0')}-${side}.${ext}`;
  const filepath = path.join(imagesDir, filename);
  fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));
  return filepath;
}

function main() {
  const opts = parseArgs(process.argv);
  const logger = createTradingLogger({
    script: 'card-image-prompts',
    argv: process.argv.slice(2),
    verbose: process.argv.includes('--verbose') || process.env.TRADING_CARDS_VERBOSE === '1',
  });
  if (opts.help) {
    usage();
    return;
  }

  const setPath = resolveSetPath(opts.set);
  logger.log('process.start', { command: 'card-image-prompts', setPath, options: summarize(opts) });
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
    const bundle = buildPromptBundle(card, set, opts.side, {
      includeSource: opts.includeSource,
      promptFormat: opts.promptFormat,
      handHeld: opts.handHeld,
    });
    const key = normalizeNum(card.num || card.cardNum || '');
    if (opts.side === 'both') {
      payloads.push(bundle);
      bundleByCardNum.set(key, bundle);
    } else {
      payloads.push(bundle);
      bundleByCardNum.set(key, { [opts.side]: bundle });
    }
  }

  // ── Image on-demand mode: just print the prompt for manual use ──
  if (opts.imageOndemand) {
    if (opts.format === 'json') {
      // JSON output with embedded prompts
      process.stdout.write(JSON.stringify({
        set: { code: set.code || '', name: set.name || '', category: set.setCategory || set.category || 'character' },
        side: opts.side,
        count: cards.length,
        payloads,
        note: 'Use .prompt from each payload as input to your image generator.',
        suggestedModel: opts.imageModel,
      }, null, 2) + '\n');
    } else {
      // Human-readable prompt output
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const bundle = payloads[i];
        if (opts.side === 'both') {
          process.stdout.write(formatPromptOutput(bundle.front, card, set, 'front', opts));
          process.stdout.write(formatPromptOutput(bundle.back, card, set, 'back', opts));
        } else if (bundle.front || bundle.back) {
          const s = bundle.front ? 'front' : 'back';
          process.stdout.write(formatPromptOutput(bundle[s] || bundle, card, set, s, opts));
        } else {
          process.stdout.write(formatPromptOutput(bundle, card, set, opts.side, opts));
        }
      }
    }
  }

  // ── Generate mode: call OpenRouter API ──
  else {
    if (opts.format !== 'json') {
      console.log('Generating images via OpenRouter...\n');
    }
    (async () => {
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const bundle = payloads[i];

        const sides = opts.side === 'both' ? ['front', 'back'] : [opts.side];
        for (const side of sides) {
          const payload = bundle[side] || bundle;
          const prompt = payload.prompt;

          if (opts.format !== 'json') {
            process.stdout.write(`  🎨 Generating ${set.code}-${String(card.num || card.cardNum || '').padStart(3,'0')} (${side})... `);
          }

          try {
            const dataUrl = await generateImageViaOpenRouter(prompt, opts.imageModel, card, set, side, opts);
            const filepath = await saveImageFromDataUrl(dataUrl, set.code || 'unknown', card.num || card.cardNum || '000', side);

            if (opts.format !== 'json') {
              process.stdout.write(`✅ ${filepath}\n`);
            }

            // Track in payload
            if (payload.imageUrl) {
              if (!payload.imageUrl) payload.imageUrl = {};
              payload.imageUrl[side] = filepath;
            }
          } catch (err) {
            if (opts.format !== 'json') {
              process.stdout.write(`❌ ${err.message}\n`);
            }
            logger.error('image.generate.fail', { card: card.num, side, error: err.message });
          }
        }
      }

      // Write final JSON if requested
      if (opts.output) {
        const output = opts.format === 'json'
          ? JSON.stringify({
              set: { code: set.code || '', name: set.name || '', category: set.setCategory || set.category || 'character' },
              side: opts.side,
              count: cards.length,
              payloads,
            }, null, 2)
          : payloads.map((p) => {
              if (p.front || p.back) {
                return [p.front?.prompt, p.back?.prompt].filter(Boolean).join('\n\n---\n\n');
              }
              return p.prompt;
            }).join('\n\n==========\n\n');
        fs.writeFileSync(path.resolve(opts.output), output);
        logger.debug('output.write', { output: path.resolve(opts.output), format: opts.format, count: cards.length });
      }

      logger.log('process.end', { command: 'card-image-prompts', status: 'ok', count: cards.length });
    })().catch((err) => {
      logger.error('process.fail', { message: err.message, stack: err.stack });
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    });
  }

  if (opts.writeSet) {
    const updatedSet = writePromptBundleToSet(set, bundleByCardNum);
    fs.writeFileSync(setPath, JSON.stringify(updatedSet, null, 2));
    logger.debug('set.write', { setPath, cards: updatedSet.cards.length, payload: summarize(updatedSet.cards.slice(0, 3)) });
  }

  if (opts.imageOndemand) {
    logger.log('process.end', { command: 'card-image-prompts', status: 'ok', count: cards.length });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    try {
      const logger = createTradingLogger({ script: 'card-image-prompts', argv: process.argv.slice(2) });
      logger.error('process.fail', { message: error.message, stack: error.stack });
    } catch {}
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, main };
