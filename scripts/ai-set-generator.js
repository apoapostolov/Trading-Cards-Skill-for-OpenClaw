#!/usr/bin/env node
'use strict';
/**
 * AI Trading Card Set Generator — OpenRouter Integration
 * 
 * Generates a full 150-card set using an LLM via OpenRouter API.
 * Produces output in the same JSON format as card-engine.js's procedural generator.
 * 
 * Usage:
 *   node ai-set-generator.js                          # default model
 *   node ai-set-generator.js --model google/gemini-2.0-flash-001
 *   node ai-set-generator.js --model meta-llama/llama-4-maverick:free
 *   node ai-set-generator.js --theme "Cyberpunk Street Racing"
 *   node ai-set-generator.js --cards 200              # set size
 *   node ai-set-generator.js --set-code DRG           # custom set code
 * 
 * Config:
 *   OPENROUTER_API_KEY  — env variable, ./.env, or ~/.openclaw/.env
 *   Default model:      google/gemini-2.0-flash-001 (cheap, fast, good at creative)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = process.env.TRADING_CARDS_DATA_DIR ? path.resolve(process.env.TRADING_CARDS_DATA_DIR) : path.join(__dirname, '..', 'data');
const DEFAULT_ENV_FILES = [
  process.env.TRADING_CARDS_ENV_FILE ? path.resolve(process.env.TRADING_CARDS_ENV_FILE) : null,
  path.join(__dirname, '..', '.env'),
  process.env.HOME ? path.join(process.env.HOME, '.openclaw', '.env') : null,
].filter(Boolean);
const ENV_FILE = DEFAULT_ENV_FILES.find((candidate) => {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}) || DEFAULT_ENV_FILES[0] || path.join(__dirname, '..', '.env');
const FLOPPS_STATE_FILE = path.join(DATA_DIR, 'flopps', 'state.json');
const CAT = require('./categories.js');
const { buildRichSetMetadata } = require('./set-metadata.js');

// ── Config ──────────────────────────────────────────────────────
const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
const DEFAULT_FLOPPS_MODEL = 'moonshotai/kimi-k2.5';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_SYSTEM_PROMPT = 'You are a creative trading card designer. You output ONLY valid JSON, never markdown fences or extra text. Complete the FULL array — never truncate.';
const FLOPPS_EXECUTIVES = [
  {
    role: 'CEO',
    name: 'Adrian Vale',
    publicFace: 'Immaculate suit, polished smile, endless language about community and collector passion.',
    privateDrift: 'Treats every release as a demand-generation event and every complaint as a conversion problem.',
  },
  {
    role: 'CFO',
    name: 'Lillian Mercer',
    publicFace: 'Cool, exact, and reassuring. Speaks in margins, forecasts, and disciplined growth.',
    privateDrift: 'Views scarcity as a pricing tool and collector enthusiasm as a revenue model with no dignity loss.',
  },
  {
    role: 'President of Product',
    name: 'Grant Bell',
    publicFace: 'Roadmap voice, release cadence discipline, and relentless confidence in "the next drop."',
    privateDrift: 'Pushes new sets before the previous one has finished cooling off.',
  },
  {
    role: 'CMO',
    name: 'Elena Cross',
    publicFace: 'Friendly, camera-ready, and fluent in hype language without ever sounding cruel.',
    privateDrift: 'Can package manipulation as collector service and make it sound like transparency.',
  },
  {
    role: 'VP of Allocation',
    name: 'Marcus Reed',
    publicFace: 'Inventory precision, retailer relationships, and the calm voice of a gatekeeper.',
    privateDrift: 'Controls who gets product, how much, and why the shortage is somehow always "unavoidable."',
  },
  {
    role: 'Head of Community',
    name: 'Noelle Park',
    publicFace: 'Warm, responsive, and very good at sounding like the company is listening.',
    privateDrift: 'Turns collector frustration into teaser fuel and keeps the audience emotionally inside the funnel.',
  },
];

const FLOPPS_CORPORATE_BEATS = [
  'public stock ticker: FLPS',
  'investor call cadence',
  'layoffs described as organizational focus',
  'price hikes described as premium alignment',
  'lower pull chances described as improved collector outcomes',
  'allocation cuts described as protecting the hobby',
  'lobbying and trade-group spend described as collector advocacy',
];

// Theme categories with weighted selection (same as card-engine)
const THEME_CATEGORIES = [
  { category: "Sci-Fi / Space", themes: ["Deep Space Rangers", "Nebula Nomads", "Orbital Pirates", "Void Walkers", "Stellar Cartographers"] },
  { category: "Fantasy / Myth", themes: ["Realm of Eldoria", "Dragonfire Legends", "Elven Twilight", "Dwarven Forge Kings", "Arcane Bloodlines"] },
  { category: "Sports Alt", themes: ["Thunder League", "Velocity Circuit", "Apex Arena", "Titan Bowl", "Gravity Games"] },
  { category: "Historical", themes: ["Empires Collide", "Revolutionary Spirits", "Ancient Dynasties", "Renaissance Minds", "Age of Discovery"] },
  { category: "Nature / Animals", themes: ["Untamed Wilds", "Ocean Depths", "Canopy Kingdom", "Savanna Pride", "Arctic Tundra"] },
  { category: "Urban / Modern", themes: ["Street Legends", "Neon District", "Concrete Jungle", "Metro Underground", "Skyline Syndicate"] },
  { category: "Horror / Gothic", themes: ["Crimson Hollow", "Grimm Estates", "Shadowsfall", "Whispering Pines", "Blackwood Asylum"] },
  { category: "Pop Culture Parody", themes: ["Meme Legends", "Stream Warriors", "Viral Nation", "Internet Hall of Fame", "Digital Icons"] },
  { category: "Mecha / Tech", themes: ["Steel Vanguard", "Circuit Breakers", "Neural Ops", "Chrome Titans", "Robo Force"] },
  { category: "Culinary", themes: ["Iron Chef Arena", "Pastry Wars", "Street Food Kings", "Fermentation Masters", "Spice Road"] },
];

// ── CLI Args ────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    model: DEFAULT_MODEL,
    cards: 'auto',
    theme: null,
    setCode: null,
    force: false,
    customTypes: false,
    category: null,
    sport: null,
    seasons: 1,
    cardsPerSeason: 50,
    flopps: false,
    floppsMode: 'launch',
    floppsModel: null,
    wildcardContext: null,
    jsonOutput: false,
    wildcardOutputFile: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
    else if (args[i] === '--cards' && args[i + 1]) { const v = args[++i]; opts.cards = v === 'auto' ? 'auto' : parseInt(v, 10); }
    else if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--set-code' && args[i + 1]) opts.setCode = args[++i];
    else if (args[i] === '--force') opts.force = true;
    else if (args[i] === '--custom-types') opts.customTypes = true;
    else if (args[i] === '--category' && args[i + 1]) opts.category = args[++i];
    else if (args[i] === '--sport' && args[i + 1]) opts.sport = args[++i];
    else if (args[i] === '--seasons' && args[i + 1]) opts.seasons = parseInt(args[++i], 10);
    else if (args[i] === '--cards-per-season' && args[i + 1]) opts.cardsPerSeason = parseInt(args[++i], 10);
    else if (args[i] === '--flopps') opts.flopps = true;
    else if (args[i] === '--flopps-mode' && args[i + 1]) opts.floppsMode = args[++i];
    else if (args[i] === '--flopps-model' && args[i + 1]) opts.floppsModel = args[++i];
    else if (args[i] === '--wildcard-context' && args[i + 1]) opts.wildcardContext = args[++i];
    else if (args[i] === '--json-output') opts.jsonOutput = true;
    else if (args[i] === '--wildcard-output-file' && args[i + 1]) opts.wildcardOutputFile = args[++i];
  }
  return opts;
}

// ── Env / Key Loading ───────────────────────────────────────────
function loadApiKey() {
  // Check env first
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // Check repo-local .env or the OpenClaw shared env file
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const match = envContent.match(/OPENROUTER_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return null;
}

function loadFloppsState() {
  try {
    const state = JSON.parse(fs.readFileSync(FLOPPS_STATE_FILE, 'utf8'));
    if (!state.stock) state.stock = { price: 100, history: [] };
    return state;
  } catch {
    return null;
  }
}

// ── HTTP Client ─────────────────────────────────────────────────
function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const reqOpts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };
    const proto = urlObj.protocol === 'https:' ? https : http;
    const req = proto.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Request timeout (120s)')); });
    req.write(postData);
    req.end();
  });
}

// ── Theme Selection ─────────────────────────────────────────────
function pickTheme(opts) {
  if (opts.theme) return { category: "Custom", themeName: opts.theme };
  const cat = THEME_CATEGORIES[Math.floor(Math.random() * THEME_CATEGORIES.length)];
  const theme = cat.themes[Math.floor(Math.random() * cat.themes.length)];
  return { category: cat.category, themeName: theme };
}

function normalizeCategoryOptions(category, opts = {}) {
  if (!category || category === 'character') {
    return { category: 'character' };
  }
  if (typeof category === 'object') {
    return {
      category: category.category || 'character',
      sport: category.sport || null,
      seasons: category.seasons || 1,
      cardsPerSeason: category.cardsPerSeason || 50,
    };
  }
  return {
    category,
    sport: opts.sport || null,
    seasons: opts.seasons || 1,
    cardsPerSeason: opts.cardsPerSeason || 50,
  };
}

// ── Set Code Generation ─────────────────────────────────────────
function genSetCode() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 3; i++) s += c[Math.floor(Math.random() * 26)];
  return s;
}

// ── Build Prompt ────────────────────────────────────────────────
function buildPrompt(themeName, category, totalCards, catOpts) {
  const categoryConfig = normalizeCategoryOptions(catOpts);
  // If a specific category is set, use the category-specific prompt
  if (categoryConfig.category && categoryConfig.category !== 'character') {
    const catPrompt = CAT.buildCategoryPrompt(categoryConfig.category, {
      cards: totalCards,
      sport: categoryConfig.sport,
      seasons: categoryConfig.seasons,
      cardsPerSeason: categoryConfig.cardsPerSeason,
    });
    if (catPrompt) return catPrompt;
  }
  // Default: character generation
  return `You are a creative trading card game designer. Generate a complete set of ${totalCards} unique cards for the trading card set "${themeName}".

## Theme
- Set Name: ${themeName}
- Category: ${category}

## Requirements
Generate EXACTLY ${totalCards} cards as a JSON array. Each card object must have these fields:
- "num": Card number as 3-digit string, "001" through "${String(totalCards).padStart(3, '0')}"
- "name": A unique character name fitting the theme. Be creative — no two names should be similar.
- "subset": One of: "Base", "Rookie", "Legend", "AllStar", "Flashback"
- "starTier": One of: "Common", "Uncommon", "Star", "Superstar", "Legendary"
- "desc": A one-sentence flavor text describing this character in the context of "${themeName}". Make it evocative and thematic. Each must be unique.
- "stats": Object with 5 integer stats from appropriate ranges:
  - "power", "speed", "technique", "endurance", "charisma"
  - Common: 40-75, Uncommon: 50-80, Star: 60-90, Superstar: 70-95, Legendary: 80-98
- "basePrice": A dollar value within range based on starTier:
  - Common: 0.10-0.30, Uncommon: 0.30-0.75, Star: 0.75-1.50, Superstar: 1.50-3.00, Legendary: 3.00-5.00
  - Round to 2 decimal places
- "imagePrompt": A Midjourney-style image generation prompt for the card FRONT art (under 200 chars). Describe: the subject as a trading card portrait, art style (digital art, illustrated), color palette, mood. Make it vivid and thematic. No real people names or copyrighted characters.
- "imagePromptBack": A trading card BACK design prompt (under 250 chars). Include: color scheme matching the card's starTier (Common=silver, Uncommon=green, Star=blue, Superstar=purple, Legendary=gold), stats panel layout, holographic/chrome finish, card number. Integrate the flavor text as visible text on the design.
- "imagePromptBackFlavor": A themed 1-2 sentence back flavor blurb (roughly 120-220 chars) that appears on the card back. It should relate to the card's desc but read like actual card copy, not a tiny quip.

## Distribution Rules
- Subset distribution: ~50% Base, ~20% Rookie, ~12% AllStar, ~10% Flashback, ~8% Legend
- Star tier distribution: ~55% Common, ~18% Uncommon, ~14% Star, ~9% Superstar, ~4% Legendary
- Rookies should feel like newcomers to the setting
- Legends should feel iconic and legendary
- Star/Superstar/Legendary characters should have higher stats and more dramatic flavor text
- Every single name must be unique
- Every single description must be unique

## Output
Return ONLY a valid JSON array. No markdown, no code fences, no explanation. Just the raw JSON array of ${totalCards} card objects.`;
}

// ── Build Batch Prompt ──────────────────────────────────────────
function buildBatchPrompt(themeName, category, startNum, endNum, catOpts) {
  const count = endNum - startNum + 1;
  const categoryConfig = normalizeCategoryOptions(catOpts);
  if (categoryConfig.category && categoryConfig.category !== 'character') {
    const catPrompt = CAT.buildCategoryPrompt(categoryConfig.category, {
      cards: count,
      sport: categoryConfig.sport,
      seasons: categoryConfig.seasons,
      cardsPerSeason: categoryConfig.cardsPerSeason,
    });
    if (catPrompt) {
      return `${catPrompt}

## Batch Continuity
- This batch covers cards ${startNum}-${endNum} of the full set.
- Keep the same category rules, tone, and schema for every card.
- Number the cards for this batch range, then preserve continuity with the larger set.
`;
    }
  }
  return `You are a creative trading card game designer. Continue generating cards for the set "${themeName}".

## Theme: ${themeName} (${category})
## Cards ${startNum}-${endNum} (exactly ${count} cards)

Generate a JSON array of exactly ${count} cards. Each card:
- "num": 3-digit string from "${String(startNum).padStart(3,'0')}" to "${String(endNum).padStart(3,'0')}"
- "name": Unique creative character name
- "subset": "Base", "Rookie", "Legend", "AllStar", or "Flashback" (~50/20/8/12/10%)
- "starTier": "Common", "Uncommon", "Star", "Superstar", or "Legendary" (~55/18/14/9/4%)
- "desc": One unique thematic flavor text sentence
- "stats": {"power","speed","technique","endurance","charisma"} ints (Common:40-75, Unc:50-80, Star:60-90, SS:70-95, Leg:80-98)
- "basePrice": float (Common:0.10-0.30, Unc:0.30-0.75, Star:0.75-1.50, SS:1.50-3.00, Leg:3.00-5.00)
- "imagePrompt": Front art prompt (under 200 chars, Midjourney-style, digital art trading card portrait)
- "imagePromptBack": Card back design prompt (under 250 chars, include stats panel, color scheme, finish)
- "imagePromptBackFlavor": Themed 1-2 sentence flavor copy for the back (roughly 120-220 chars)

Return ONLY a JSON array. No markdown, no explanation.`;
}

// ── Call OpenRouter ─────────────────────────────────────────────
async function callLLM(model, prompt, apiKey, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 16000,
  };

  console.error(`  🔄 Calling ${model}...`);
  const t0 = Date.now();
  const resp = await httpsPost(OPENROUTER_URL, body, {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://openclaw.ai',
    'X-Title': 'OpenClaw Trading Cards',
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (resp.status !== 200) {
    const errMsg = resp.data?.error?.message || resp.data?.error?.code || JSON.stringify(resp.data);
    throw new Error(`OpenRouter API error ${resp.status}: ${errMsg}`);
  }

  const content = resp.data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in API response');

  const tokens = resp.data.usage || {};
  const finish = resp.data.choices?.[0]?.finish_reason || '?';
  console.error(`  ✅ Response received (${elapsed}s, ${tokens.prompt_tokens || '?'}in / ${tokens.completion_tokens || '?'}out, finish: ${finish})`);

  return content;
}

function buildFloppsLaunchPrompt({
  mode,
  themeName,
  category,
  setCode,
  cards,
  year,
  summary,
  floppsState,
  cadenceDays = 45,
}) {
  const modeInstructions = {
    launch: [
      'Write the main public launch article for the new Flopps set.',
      'Make it feel like a polished corporate blog post that is trying very hard to sound transparent and cool.',
      'Include release notes, development notes, collector impact, and a breadcrumb toward the next drop.',
    ],
    blog: [
      'Write a fake corporate blog article about the current Flopps set cycle.',
      'Lean slightly more into playful parody and collector obsession.',
      'Include at least one line that sounds reassuring while actually increasing demand.',
    ],
    'release-notes': [
      'Write release notes for the Flopps product and set launch.',
      'Focus on what changed in the product line, what got added, and why collectors should care.',
      'Keep the voice professional but a little too excited about scarcity.',
    ],
    'dev-notes': [
      'Write faux development notes from the Flopps product team.',
      'Make it sound like internal progress notes accidentally published to the public.',
      'Blend technical polish with marketing cynicism.',
    ],
    'world-sim': [
      'Write a world-simulation briefing for Flopps management and collectors.',
      'Describe how print runs, stores, scalpers, and collector frenzy interact.',
      'Make the whole ecosystem feel like a living market machine with a smug corporate narrator.',
    ],
  };

  const selected = modeInstructions[mode] || modeInstructions.launch;
  const topCards = (summary.samples || []).map((card) => `${card.num} ${card.name} [${card.starTier}/${card.subset}]`);
  const structuredState = buildStructuredFloppsContext({
    mode,
    themeName,
    category,
    setCode,
    cards,
    year,
    summary,
    floppsState,
    cadenceDays,
  });
  return `You are writing as Flopps, an alternative-world trading card company that communicates through a fake corporate blog.

Tone:
- polished corporate announcement
- mildly comedic and marketing-cynical
- self-serious about scarcity and collector excitement
- never openly say the company is exploiting anyone; imply it through euphemism and corporate language

Important operating rule:
- The structured simulation context below is the source of truth.
- Do not invent contradictory company state.
- Your job is to translate the simulation into outward-facing corporate language.

Write a markdown article for the Flopps ${mode.replace(/-/g, ' ')} cycle using the following context:

Management brief:
- Theme: ${themeName}
- Category: ${category}
- Set code: ${setCode}
- Year: ${year}
- Card count: ${cards}
- Launch cadence: one new set every ~45 days

Set summary:
- Average base price: $${summary.avgBasePrice.toFixed(2)}
- Star tier counts: ${Object.entries(summary.tierCounts).map(([k, v]) => `${k}=${v}`).join(', ')}
- Subset counts: ${Object.entries(summary.subsetCounts).map(([k, v]) => `${k}=${v}`).join(', ')}
- Chase notes: ${summary.chaseNotes.join('; ')}
- Sample cards: ${topCards.join(' | ')}
- Flopps executive cast:
${formatFloppsExecutiveCast()}
- Flopps corporate pressure points:
${FLOPPS_CORPORATE_BEATS.map((beat) => `- ${beat}`).join('\n')}
${floppsState?.latestNews ? `- Latest FLPS bulletin: ${floppsState.latestNews.title} (day ${floppsState.latestNews.day})` : '- Latest FLPS bulletin: none yet'}
${floppsState?.stock?.price ? `- Current FLPS price: $${Number(floppsState.stock.price).toFixed(2)}` : '- Current FLPS price: $100.00'}

Structured simulation context:
\`\`\`json
${JSON.stringify(structuredState, null, 2)}
\`\`\`

Required structure:
1. H1 headline
2. Short opening summary
3. "What Changed" section with 3-6 bullets
4. "Development Notes" section with 2-5 bullets
5. "What Collectors Should Expect" section with 3-5 bullets
6. "Market Note" section that references hype, scarcity, or secondary-market pressure
7. "Next Drop" section with a teaser that keeps the cycle moving
8. A closing sentence that sounds friendly but slightly manipulative
9. If relevant, reference the FLPS stock price, investor pressure, or a dark but whitewashed corporate action

${selected.map((line) => `- ${line}`).join('\n')}

Do not mention that this is a prompt. Do not add preamble. Output only the markdown article.`;
}

function buildStructuredFloppsContext({
  mode,
  themeName,
  category,
  setCode,
  cards,
  year,
  summary,
  floppsState,
  cadenceDays,
}) {
  const corp = floppsState?.corporation || {};
  const latestNews = floppsState?.latestNews || null;
  const trendTop = floppsState?.trendDesk?.watchlist?.[0] || null;
  const currentRelease = Array.isArray(floppsState?.calendar)
    ? floppsState.calendar.find((entry) => typeof floppsState.lastSeenDay === 'number' && entry.day <= floppsState.lastSeenDay)
    : null;
  const nextRelease = Array.isArray(floppsState?.calendar)
    ? floppsState.calendar.find((entry) => typeof floppsState.lastSeenDay === 'number' && entry.day > floppsState.lastSeenDay)
    : null;

  return {
    architecture: 'simulation-first, writing-second',
    outputMode: mode,
    launchCadenceDays: cadenceDays,
    set: {
      name: themeName,
      category,
      setCode,
      year,
      cardCount: cards,
      avgBasePrice: Number(summary.avgBasePrice.toFixed(2)),
      chaseNotes: summary.chaseNotes,
      sampleCards: (summary.samples || []).map((card) => ({
        num: card.num,
        name: card.name,
        starTier: card.starTier,
        subset: card.subset,
      })),
      tierCounts: summary.tierCounts,
      subsetCounts: summary.subsetCounts,
    },
    corporation: {
      ticker: 'FLPS',
      stockPrice: Number(floppsState?.stock?.price || 100),
      lastSeenDay: floppsState?.lastSeenDay ?? -1,
      guidance: corp.guidance || null,
      activePhase: corp.activePhase || null,
      executiveFocus: corp.executiveFocus || null,
      scarcityIndex: roundMetric(corp.scarcityIndex),
      hypeIndex: roundMetric(corp.hypeIndex),
      extractionIndex: roundMetric(corp.extractionIndex),
      collectorStress: roundMetric(corp.collectorStress),
      retailerStress: roundMetric(corp.retailerStress),
      laborStress: roundMetric(corp.laborStress),
      lobbyingHeat: roundMetric(corp.lobbyingHeat),
      allocationTightness: roundMetric(corp.allocationTightness),
      releasePace: roundMetric(corp.releasePace),
      partnerHeat: roundMetric(corp.partnerHeat),
    },
    releaseCalendar: {
      current: currentRelease ? {
        title: currentRelease.title,
        day: currentRelease.day,
        partner: currentRelease.partner || null,
        channel: currentRelease.channel || null,
        category: currentRelease.category || null,
        licenseName: currentRelease.licenseName || null,
      } : null,
      next: nextRelease ? {
        title: nextRelease.title,
        day: nextRelease.day,
        partner: nextRelease.partner || null,
        channel: nextRelease.channel || null,
        category: nextRelease.category || null,
        licenseName: nextRelease.licenseName || null,
      } : null,
    },
    trendDesk: trendTop ? {
      topPick: trendTop.name,
      partner: trendTop.partner || null,
      marketability: roundMetric(trendTop.marketability),
      category: trendTop.category || null,
    } : null,
    latestBulletin: latestNews ? {
      day: latestNews.day,
      title: latestNews.title,
      kind: latestNews.kind || null,
      summary: latestNews.summary,
      paraphrase: latestNews.paraphrase,
      executive: latestNews.executive || null,
      executiveRole: latestNews.executiveRole || null,
      phase: latestNews.phase || null,
      releaseTitle: latestNews.releaseTitle || null,
      marketImpact: latestNews.marketImpact || null,
      collectorImpact: latestNews.collectorImpact || null,
      source: latestNews.source || null,
    } : null,
    corporateBeats: FLOPPS_CORPORATE_BEATS,
    executiveCast: FLOPPS_EXECUTIVES.map((exec) => ({
      role: exec.role,
      name: exec.name,
      publicFace: exec.publicFace,
      privateDrift: exec.privateDrift,
    })),
  };
}

function roundMetric(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1000) / 1000;
}

function summarizeFloppsSet(set, cards) {
  const tierCounts = {};
  const subsetCounts = {};
  let basePriceTotal = 0;
  const sorted = [...cards].sort((a, b) => {
    const rank = { Legendary: 5, Superstar: 4, Star: 3, Uncommon: 2, Common: 1 };
    return (rank[b.starTier] || 0) - (rank[a.starTier] || 0) || parseFloat(b.basePrice || 0) - parseFloat(a.basePrice || 0);
  });

  for (const card of cards) {
    tierCounts[card.starTier] = (tierCounts[card.starTier] || 0) + 1;
    subsetCounts[card.subset] = (subsetCounts[card.subset] || 0) + 1;
    basePriceTotal += parseFloat(card.basePrice || 0) || 0;
  }

  const chaseCards = sorted
    .filter((card) => ['Legendary', 'Superstar'].includes(card.starTier))
    .slice(0, 5)
    .map((card) => `${card.num} ${card.name}`);

  return {
    tierCounts,
    subsetCounts,
    avgBasePrice: cards.length ? basePriceTotal / cards.length : 0,
    chaseNotes: [
      `${Object.keys(tierCounts).filter((tier) => tierCounts[tier] > 0).length} active star tiers`,
      `${Object.keys(subsetCounts).length} subset buckets`,
      chaseCards.length ? `Top chase cards: ${chaseCards.join(', ')}` : 'No premium chase cards surfaced in the sample',
    ],
    samples: sorted.slice(0, 5),
  };
}

function formatFloppsExecutiveCast() {
  return FLOPPS_EXECUTIVES.map((exec) => `- ${exec.role}: ${exec.name} | public: ${exec.publicFace} | private: ${exec.privateDrift}`).join('\n');
}

function renderFloppsMarkdown(article, set) {
  return article.trim();
}

function saveFloppsArtifacts(set, article, mode, simulationContext) {
  const outDir = path.join(DATA_DIR, 'flopps', 'launches', set.code);
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    mode,
    setCode: set.code,
    setName: set.name,
    year: set.year,
    createdAt: new Date().toISOString(),
    article,
    simulationContext: simulationContext || null,
  };
  fs.writeFileSync(path.join(outDir, 'launch.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, 'launch.md'), renderFloppsMarkdown(article, set));
  if (simulationContext) {
    fs.writeFileSync(path.join(outDir, 'simulation-context.json'), JSON.stringify(simulationContext, null, 2));
  }
  return outDir;
}

function safeParseJsonObject(raw) {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }
  throw new Error('Could not parse JSON object from model output');
}

function loadFixtureJsonArray(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`Fixture file must contain a JSON array: ${file}`);
  return parsed;
}

function buildFloppsWildcardPrompt(context) {
  const corp = context.corporation || {};
  const release = context.release || {};
  const trend = context.trendDeskTop || {};
  return `You are inventing a single Flopps wildcard corporate event for a satirical trading card company simulation.

The event must:
- feel like a real corporate announcement, press release, executive appearance, partner update, platform change, or manufactured collector initiative
- affect sales, sealed demand, release hype, store allocation, grading, or the secondary market
- range from sober-realistic to deadpan absurd, but still sound like something a cynical company communications team would publish
- be written as if the company is whitewashing its motives in polished language
- stay fictional and in-world; do not mention that this is parody, satire, or a prompt

Current simulation context:
- Simulation day: ${context.day ?? 0}
- Triggering command: ${context.commandName || 'unknown'}
- Phase: ${release.phaseLabel || release.phase || 'planning'}
- Current release: ${release.currentTitle || 'none'}
- Next release: ${release.nextTitle || 'none'}
- FLPS price: $${Number(context.stockPrice || 100).toFixed(2)}
- Executive focus: ${context.executive?.name || 'Management'} (${context.executive?.role || 'Executive Office'})
- Trend desk top pick: ${trend.name || 'none'}${trend.marketability != null ? ` (${Math.round(Number(trend.marketability) * 100)}% marketability)` : ''}
- Corporate stress: scarcity ${Math.round(Number(corp.scarcityIndex || 0) * 100)}%, hype ${Math.round(Number(corp.hypeIndex || 0) * 100)}%, extraction ${Math.round(Number(corp.extractionIndex || 0) * 100)}%, collectors ${Math.round(Number(corp.collectorStress || 0) * 100)}%, retailers ${Math.round(Number(corp.retailerStress || 0) * 100)}%, labor ${Math.round(Number(corp.laborStress || 0) * 100)}%

Return ONLY a valid JSON object with exactly these keys:
- "title": short corporate headline, 5-12 words
- "summary": 1 sentence, public-facing explanation of the event
- "paraphrase": 1 sentence, blunt translation of what it really means for collectors or the market
- "category": one of "consumer-blog", "partnership", "pricing", "operations", "marketplace", "policy", "community", "investor", "licensing", "wildcard"
- "executive": spokesperson name
- "executiveRole": spokesperson role
- "stockDelta": number between -0.08 and 0.08
- "marketImpact": short sentence about sealed product or secondary market effect
- "collectorImpact": short sentence about how buyers, breakers, stores, or scalpers react

Aim for creative specificity. A good answer sounds like a company accidentally revealing the machine behind the hobby while pretending to be helpful.`;
}

function buildFallbackWildcardEvent(context) {
  const phase = context.release?.phaseLabel || context.release?.phase || 'Operating Window';
  const topTrend = context.trendDeskTop?.name || 'a crossover license';
  const fallbacks = [
    {
      title: 'Flopps Tests Priority Queue Experience',
      summary: 'Flopps unveiled a Priority Queue Experience pilot that lets collectors pay for cleaner access to select release windows and live drops.',
      paraphrase: 'They are charging people for the privilege of standing in a better line.',
      category: 'marketplace',
      executive: 'Elena Cross',
      executiveRole: 'Chief Marketing Officer',
      stockDelta: 0.021,
      marketImpact: 'Sealed product demand rises as collectors treat paid access like a signal that supply will tighten.',
      collectorImpact: 'Breakers and flippers move faster, while regular buyers feel pressured to pay to keep up.',
    },
    {
      title: 'Flopps Opens Franchise Readiness Council',
      summary: `Flopps announced a Franchise Readiness Council to evaluate whether ${topTrend} deserves a premium release corridor in the next calendar window.`,
      paraphrase: 'They built a committee to turn trend-chasing into official product doctrine.',
      category: 'licensing',
      executive: 'Grant Bell',
      executiveRole: 'President of Product',
      stockDelta: 0.017,
      marketImpact: 'Speculators start buying ahead of an unconfirmed license because the roadmap language sounds intentional.',
      collectorImpact: 'Collectors begin hoarding cash and sealed product in anticipation of the next hype spike.',
    },
    {
      title: 'Flopps Announces Controlled Discovery Format',
      summary: `During ${phase}, Flopps introduced a Controlled Discovery Format that withholds exact chase odds on select bonus inserts to preserve collector surprise.`,
      paraphrase: 'They reduced transparency and called it part of the fun.',
      category: 'pricing',
      executive: 'Lillian Mercer',
      executiveRole: 'CFO',
      stockDelta: 0.013,
      marketImpact: 'Mystery around hit rates increases breaker curiosity and short-term aftermarket volatility.',
      collectorImpact: 'Collectors buy more sealed wax to self-audit the odds the company chose not to spell out.',
    },
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

async function generateFloppsWildcardEvent(opts, apiKey, floppsModel) {
  let context = {};
  if (opts.wildcardContext) {
    try {
      context = JSON.parse(opts.wildcardContext);
    } catch (error) {
      throw new Error(`Invalid --wildcard-context JSON: ${error.message}`);
    }
  }
  if (process.env.FLOPPS_WILDCARD_FIXTURE) {
    return safeParseJsonObject(fs.readFileSync(process.env.FLOPPS_WILDCARD_FIXTURE, 'utf8'));
  }
  const prompt = buildFloppsWildcardPrompt(context);
  try {
    const raw = await callLLM(
      floppsModel,
      prompt,
      apiKey,
      'You are Flopps corporate communications. Output only valid JSON with no markdown fences, no preamble, and no trailing commentary.'
    );
    const parsed = safeParseJsonObject(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.title || !parsed.summary || !parsed.paraphrase) {
      return buildFallbackWildcardEvent(context);
    }
    return {
      title: String(parsed.title || 'Flopps Corporate Update').slice(0, 100),
      summary: String(parsed.summary || '').slice(0, 320),
      paraphrase: String(parsed.paraphrase || '').slice(0, 320),
      category: String(parsed.category || 'wildcard').slice(0, 32),
      executive: String(parsed.executive || context.executive?.name || 'Management').slice(0, 80),
      executiveRole: String(parsed.executiveRole || context.executive?.role || 'Executive Office').slice(0, 80),
      stockDelta: Math.max(-0.08, Math.min(0.08, Number(parsed.stockDelta || 0))),
      marketImpact: String(parsed.marketImpact || '').slice(0, 220),
      collectorImpact: String(parsed.collectorImpact || '').slice(0, 220),
    };
  } catch (error) {
    console.error(`  ⚠️  Wildcard generation fell back to local template: ${error.message}`);
    return buildFallbackWildcardEvent(context);
  }
}

// ── Parse & Validate ────────────────────────────────────────────
function repairTruncatedJSON(raw) {
  // Try to close an incomplete JSON array
  let cleaned = raw.trim();
  
  // Count open braces and brackets
  let braces = 0, brackets = 0, inString = false, escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }
  
  // If we're inside a string, close it
  if (inString) cleaned += '"';
  // Close any open objects
  while (braces > 0) { cleaned += '}'; braces--; }
  // Close the array
  if (brackets <= 0) cleaned += ']';
  
  return cleaned;
}

function parseCards(raw, allowPartial = false) {
  // Strip markdown fences if the model added them anyway
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  let cards;
  try {
    cards = JSON.parse(cleaned);
  } catch (e) {
    if (!allowPartial) throw e;
    console.error(`  ⚠️  JSON parse failed, attempting repair...`);
    const repaired = repairTruncatedJSON(cleaned);
    try {
      cards = JSON.parse(repaired);
      console.error(`  ✅ Repair successful, got ${cards.length} cards`);
    } catch (e2) {
      // Try extracting individual card objects (handles nested stats)
      console.error(`  ⚠️  Full repair failed, extracting individual objects...`);
      // Match objects that look like cards - balance braces for nested stats
      const cards2 = [];
      let depth = 0, objStart = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) objStart = i; depth++; }
        else if (cleaned[i] === '}') {
          depth--;
          if (depth === 0 && objStart >= 0) {
            try {
              const obj = JSON.parse(cleaned.substring(objStart, i + 1));
              if (obj.name) cards2.push(obj);
            } catch {}
            objStart = -1;
          }
        }
      }
      if (cards2.length > 0) {
        cards = cards2;
        console.error(`  ✅ Extracted ${cards.length} individual card objects`);
      } else {
        throw new Error(`Could not parse or repair JSON: ${e.message}`);
      }
    }
  }
  
  if (!Array.isArray(cards)) throw new Error('Expected JSON array');
  if (cards.length === 0) throw new Error('Empty card array');

  // Validate and fix each card
  const validSubsets = new Set(['Base', 'Rookie', 'Legend', 'AllStar', 'Flashback']);
  const validTiers = new Set(['Common', 'Uncommon', 'Star', 'Superstar', 'Legendary']);

  return cards.map((c, i) => {
    const num = String(i + 1).padStart(3, '0');
    const tier = validTiers.has(c.starTier) ? c.starTier : 'Common';
    const subset = validSubsets.has(c.subset) ? c.subset : 'Base';
    const stats = c.stats || { power: 50, speed: 50, technique: 50, endurance: 50, charisma: 50 };
    for (const k of ['power', 'speed', 'technique', 'endurance', 'charisma']) {
      if (typeof stats[k] !== 'number') stats[k] = 50;
      stats[k] = Math.max(1, Math.min(99, Math.round(stats[k])));
    }
    let bp = parseFloat(c.basePrice) || 0.25;
    bp = Math.max(0.05, Math.min(10, bp));

    return {
      num,
      name: String(c.name || `Card ${num}`).slice(0, 50),
      subset,
      starTier: tier,
      desc: String(c.desc || '').slice(0, 200),
      stats,
      basePrice: Math.round(bp * 100) / 100,
      imagePrompt: String(c.imagePrompt || '').slice(0, 200),
      imagePromptBack: String(c.imagePromptBack || '').slice(0, 250),
      imagePromptBackFlavor: String(c.imagePromptBackFlavor || '').slice(0, 240),
    };
  });
}

// ── Save Set ────────────────────────────────────────────────────
function saveSet(cards, setCode, setName, category, year, customTypes, extra = {}) {
  const productArchetype = extra.productArchetype || null;
  const set = {
    code: setCode,
    name: setName,
    officialName: setName,
    themeName: setName,
    year,
    category,
    cards,
    seed: null, // AI-generated, no PRNG seed
    aiGenerated: true,
    created: new Date().toISOString(),
  };

  if (extra.setCategory) set.setCategory = extra.setCategory;
  if (extra.sport) set.sport = extra.sport;
  if (extra.collectionTheme) set.collectionTheme = extra.collectionTheme;
  if (extra.propertyGenre) set.propertyGenre = extra.propertyGenre;
  if (extra.propertySynopsis) set.propertySynopsis = extra.propertySynopsis;
  if (extra.seasons) set.seasons = extra.seasons;

  if (customTypes) {
    // Generate themed parallels, card types, and inserts
    set.parallels = generateThemedParallels(setName, category);
    set.cardTypes = generateThemedCardTypes(setName, category);
    set.inserts = generateThemedInserts(setName, category, cards.length);
  }

  set.metadata = buildRichSetMetadata({
    officialName: null,
    themeName: setName,
    category,
    setCategory: set.setCategory,
    year,
    code: setCode,
    cards,
    seed: null,
    source: 'ai-generated',
    parallels: set.parallels || [],
    cardTypes: set.cardTypes || [],
    inserts: set.inserts || [],
    sport: set.sport,
    collectionTheme: set.collectionTheme,
    propertyGenre: set.propertyGenre,
    propertySynopsis: set.propertySynopsis,
    seasons: set.seasons,
    cadenceDays: extra.cadenceDays || 45,
    createdAt: set.created,
    explicitArchetype: productArchetype,
  });
  set.officialName = set.metadata.officialName;
  set.name = set.metadata.officialName;

  const key = `${setCode}-${year}`;
  const setPath = path.join(DATA_DIR, 'sets', key);
  fs.mkdirSync(path.dirname(setPath), { recursive: true });
  fs.writeFileSync(setPath, JSON.stringify(set, null, 2));

  // Initialize collection
  const configPath = path.join(DATA_DIR, 'config.json');
  let cfg = { wallet: 1000, activeSet: null, archivedSets: [] };
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  
  // If there's already an active set with cards, don't overwrite silently
  if (cfg.activeSet && cfg.activeSet !== key) {
    const colPath = path.join(DATA_DIR, 'collections', cfg.activeSet);
    try {
      const existing = JSON.parse(fs.readFileSync(colPath, 'utf8'));
      if (existing.cards && existing.cards.length > 0) {
        console.error(`  ⚠️  Active set ${cfg.activeSet} has ${existing.cards.length} cards. Run 'new-season' first or use --force.`);
        if (!process.argv.includes('--force')) {
          console.error(`  Skipping set activation. Use --force to override.`);
          return key;
        }
      }
    } catch {}
  }

  cfg.activeSet = key;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  const col = {
    setKey: key,
    cards: [],
    pulls: {},
    stats: { total: 0, value: 0, spent: 0, boxes: 0, packs: 0, hits: 0, oneOfOnes: 0 },
    bestPull: null,
    parallelCounts: {},
    wallet: cfg.wallet,
  };
  const colPath = path.join(DATA_DIR, 'collections', key);
  fs.mkdirSync(path.dirname(colPath), { recursive: true });
  fs.writeFileSync(colPath, JSON.stringify(col, null, 2));

  return key;
}

function resolveGeneratedSetPath(key) {
  const dir = path.join(DATA_DIR, 'sets');
  const candidates = [
    path.join(dir, `${key}.json`),
    path.join(dir, key),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  if (fs.existsSync(dir)) {
    const match = fs.readdirSync(dir).find((file) => file === `${key}.json` || file === key || file.startsWith(`${key}.`));
    if (match) return path.join(dir, match);
  }
  return null;
}

// ── Print Summary ───────────────────────────────────────────────
function printSummary(setName, setCode, cards) {
  const tiers = {};
  const subs = {};
  for (const c of cards) {
    tiers[c.starTier] = (tiers[c.starTier] || 0) + 1;
    subs[c.subset] = (subs[c.subset] || 0) + 1;
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  🎴 AI-GENERATED SET`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Set: ${setName} (${setCode})`);
  console.log(`  Cards: ${cards.length}`);
  console.log(`  Wallet: $1,000.00`);
  console.log(`\n  Star Tiers:`);
  for (const t of ['Common', 'Uncommon', 'Star', 'Superstar', 'Legendary']) {
    console.log(`    ${t.padEnd(12)} ${tiers[t] || 0}`);
  }
  console.log(`\n  Subsets:`);
  for (const s of ['Base', 'Rookie', 'AllStar', 'Flashback', 'Legend']) {
    console.log(`    ${(s + (s === 'AllStar' ? 's' : '')).padEnd(14)} ${subs[s] || 0}`);
  }
  console.log(`\n  Sample Cards:`);
  const samples = cards.filter(c => c.starTier === 'Legendary' || c.starTier === 'Superstar').slice(0, 5);
  if (samples.length === 0) samples.push(...cards.slice(0, 5));
  for (const c of samples) {
    console.log(`    ${setCode}-${c.num} ${c.name} [${c.starTier}/${c.subset}]`);
    console.log(`      "${c.desc}"`);
  }
  console.log(`${'═'.repeat(55)}\n`);
}

// ── Themed Type Generation ──────────────────────────────────────
const THEME_COLORS = ['#4FC3F7','#FF5252','#69F0AE','#FFD740','#E040FB','#FF6E40','#40C4FF','#B388FF','#FF80AB','#CCFF90'];
const THEME_PARALLEL_NAMES = {
  'Sci-Fi / Space': ['Nebula','Cosmic','Quantum','Stellar','Void','Pulsar','Warp','Antimatter','Singularity','Hyperdrive','Dark Matter','Supernova'],
  'Fantasy / Myth': ['Enchanted','Arcane','Dragonfire','Elven','Dwarven','Runed','Shadow','Celestial','Abyssal','Ethereal','Phoenix','Chaos'],
  'Sports Alt': ['Rookie Wave','AllStar','MVP','Championship','Hall of Fame','Dynasty','Franchise','Icon','Legend','First Round','Draft Night','Undrafted'],
  'Historical': ['Renaissance','Revolution','Ancient','Medieval','Victorian','Imperial','Colonial','Industrial','Modern','Bronze Age','Iron Age','Golden Age'],
  'Nature / Animals': ['Savanna','Ocean','Arctic','Jungle','Desert','Mountain','Forest','Wetland','Coral','Tundra','Prairie','Volcanic'],
  'Urban / Modern': ['Neon','Chrome','Steel','Concrete','Graffiti','Underground','Skyline','Subway','Rooftop','Back Alley','Downtown','Uptown'],
  'Horror / Gothic': ['Blood','Shadow','Cursed','Haunted','Undead','Wraith','Phantom','Spectral','Doom','Grim','Revenant','Hollow'],
  'Pop Culture Parody': ['Meme','Viral','Stream','Trending','Based','Cringe','W','L','Goated','Ratioed','Clout','Drip'],
  'Mecha / Tech': ['Circuit','Cyber','Neural','Titan','Sentinel','Omega','Sigma','Quantum','Nano','Plasma','Fusion','Ion'],
  'Culinary': ['Spicy','Sweet','Savory','Umami','Bitter','Sour','Smoky','Zesty','Rich','Fresh','Toasted','Fermented'],
};

function generateThemedParallels(setName, category) {
  const names = THEME_PARALLEL_NAMES[category] || THEME_PARALLEL_NAMES['Sci-Fi / Space'];
  const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, 14);
  const tiers = [
    {name:'Base',tier:1,odds:1,num:false,ser:null,pm:1},
    ...shuffled.slice(0,6).map((n,i) => ({
      name:n, tier:i+2, odds:[3,6,12,18,24,36][i], num:false, ser:null,
      pm:[1.3,1.8,2.5,3.5,5,8][i], color:THEME_COLORS[i]
    })),
    ...shuffled.slice(6).map((n,i) => {
      const ser=[2026,499,299,199,99,75,50,25][i];
      return {name:n, tier:i+8, odds:[60,80,100,130,160,200,350,500][i], num:true, ser,
        pm:[12,18,25,35,45,60,100,180][i], color:THEME_COLORS[i+6]};
    }),
    {name:'Superfractor',tier:16,odds:5000,num:true,ser:1,pm:400,color:'#FFD700'},
    {name:'Masterwork',tier:17,odds:5000,num:true,ser:1,pm:600,color:'#1a1a2e'},
    {name:'Printing Plate',tier:18,odds:5000,num:true,ser:1,pm:350,color:'#C0C0C0'},
  ];
  return tiers;
}

function generateThemedCardTypes(setName, category) {
  // Start with default types and add theme-flavored variations
  const themedDescs = {
    'Sci-Fi / Space': ['Zero-G Material','Holographic Fragment','Nebula Shard'],
    'Fantasy / Myth': ['Dragon Scale','Enchanted Essence','Rune Fragment'],
    'Horror / Gothic': ['Cursed Relic','Shadow Essence','Bone Fragment'],
  };
  const extras = themedDescs[category] || [];
  const types = [
    {id:'variation',name:'Variation',rarity:0.35,priceMultiplier:1.5,format:'standard',desc:'🎨 Alt Art Variation'},
    {id:'novelty',name:'Novelty',rarity:0.20,priceMultiplier:1.2,format:'standard',desc:'🍕 Novelty/Food Issue'},
    {id:'relic',name:'Relic',rarity:0.18,priceMultiplier:4,format:'standard',desc:'🏅 Relic'},
    {id:'autograph',name:'Autograph',rarity:0.14,priceMultiplier:6,format:'standard',desc:'✍️ Autograph'},
    {id:'booklet',name:'Booklet',rarity:0.05,priceMultiplier:3,format:'booklet',desc:'📖 Booklet'},
    {id:'error',name:'Error Variant',rarity:0.025,priceMultiplier:2,format:'standard',desc:'❌ Error Variant'},
    {id:'dual-auto',name:'Dual Auto',rarity:0.012,priceMultiplier:12,format:'standard',desc:'✍️✍️ Dual Autograph'},
    {id:'auto-patch',name:'Auto Patch',rarity:0.003,priceMultiplier:18,format:'standard',desc:'✍️🏅 Auto Patch'},
  ];
  // Add themed extras if available
  for (const desc of extras) {
    types.push({
      id: desc.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,20),
      name: desc,
      rarity: 0.01 + Math.random() * 0.02,
      priceMultiplier: 3 + Math.random() * 5,
      format: ['standard','die-cut','acetate','mini'][Math.floor(Math.random()*4)],
      desc: `✨ ${desc}`,
    });
  }
  return types;
}

function generateThemedInserts(setName, category, setCardCount) {
  const insertThemes = {
    'Sci-Fi / Space': [{name:'Galactic Commanders',desc:'Leaders of the galactic armada'},{name:'Deep Space Anomalies',desc:'Strange phenomena from the void'}],
    'Fantasy / Myth': [{name:'Dragon Lords',desc:'Ancient wyrm riders of legend'},{name:'Artifact Hunters',desc:'Seekers of powerful relics'}],
    'Horror / Gothic': [{name:'Monster Files',desc:'Encyclopedia of the damned'},{name:'Cursed Locations',desc:'Places where evil festers'}],
    'Sports Alt': [{name:'Rookie Showcase',desc:'First-year player spotlights'},{name:'Championship Moments',desc:'Clutch plays that defined seasons'}],
  };
  const candidates = insertThemes[category] || [{name:'Hidden Gems',desc:'Secret characters and lore'}];
  const count = 1 + Math.floor(Math.random() * 2);
  return candidates.slice(0, count).map(t => ({
    name: t.name,
    size: 10 + Math.floor(Math.random() * 15),
    odds: 25 + Math.floor(Math.random() * 75),
    basePrice: [Math.round((3 + Math.random() * 7) * 100) / 100, Math.round((10 + Math.random() * 20) * 100) / 100],
    parallels: null, // inherits set parallels
    description: t.desc,
  }));
}

// ── Set Size Advisor (AI-decided) ──────────────────────────────
// Category-based size ranges based on real-world card set research:
//   1977 Topps Star Wars: 66 cards/series (330 across 5 series)
//   90s Inkworks movie/TV sets: 72-120 cards
//   Modern Topps Chrome sports: 200-300 cards
//   Panini Prizm: 200-300 cards
//   Premium small sets (Five Star): 100 cards
//   Collection/art sets: 50-150 cards
//   Novelty sets: 50-100 cards
const SIZE_RANGES = {
  character:  { min: 100, max: 300, suggest: 150 },
  sports:     { min: 100, max: 500, suggest: 300 },
  celebrity:  { min: 50,  max: 200, suggest: 100 },
  movie:      { min: 72,  max: 330, suggest: 180 },
  tv:         { min: 40,  max: 120, suggest: 50 },  // per season
  collection: { min: 50,  max: 200, suggest: 120 },
  novelty:    { min: 40,  max: 150, suggest: 80  },
};

async function aiDecideSetSize(themeName, category, model, apiKey) {
  const range = SIZE_RANGES[category] || SIZE_RANGES.character;
  const prompt = `You are a trading card set designer. Given the following set concept, decide the ideal number of base cards.

Set: "${themeName}"
Category: ${category || 'character (fictional)'}
Historical reference sizes:
- 1977 Topps Star Wars: 66 cards/series
- 1990s movie/TV sets (Inkworks, Rittenhouse): 72-120 cards
- Modern sports (Topps Chrome, Panini Prizm): 200-300 cards
- Premium small sets: 80-100 cards
- Collection/art sets: 50-150 cards
- Novelty/meme sets: 40-100 cards

Rules:
- A sports set with 30+ teams needs 200-500 cards to cover rosters
- A movie telling a full plot needs 100-200+ scene cards
- A TV season needs 40-80 cards
- A small niche collection (e.g. 20 gemstone types) can be 50 cards
- Round to a multiple of 10
- Must be between ${range.min} and ${range.max}

Reply with ONLY a single integer. No explanation, no markdown.`;

  try {
    const content = await callLLM(model, prompt, apiKey);
    const num = parseInt(content.trim(), 10);
    if (num >= range.min && num <= range.max) return num;
    console.error(`  ⚠️  AI suggested ${num}, clamping to ${range.min}-${range.max}`);
    return Math.max(range.min, Math.min(range.max, num));
  } catch (e) {
    console.error(`  ⚠️  Could not get AI set size, using default ${range.suggest}: ${e.message}`);
    return range.suggest;
  }
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const isWildcardFixtureMode = opts.flopps && (opts.floppsMode || 'launch') === 'wildcard-event' && !!process.env.FLOPPS_WILDCARD_FIXTURE;
  const hasSetFixture = !!process.env.AI_SET_GENERATOR_FIXTURE_FILE;
  const hasFloppsArticleFixture = !!process.env.FLOPPS_ARTICLE_FIXTURE;

  // Load API key
  const apiKey = (isWildcardFixtureMode || hasSetFixture || hasFloppsArticleFixture) ? (process.env.OPENROUTER_API_KEY || 'fixture-mode') : loadApiKey();
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found.');
    console.error('   Set it in ./.env or ~/.openclaw/.env:');
    console.error('   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx');
    console.error('');
    console.error('   Get a key at: https://openrouter.ai/keys');
    process.exit(1);
  }

  const { category: catLabel, themeName } = pickTheme(opts);
  const setCategory = opts.category || null;
  const categoryConfig = normalizeCategoryOptions(setCategory, opts);
  const setCode = opts.setCode || genSetCode();
  const year = new Date().getFullYear();
  const floppsMode = opts.floppsMode || 'launch';
  const floppsModel = opts.floppsModel || DEFAULT_FLOPPS_MODEL;
  const floppsState = loadFloppsState();

  if (opts.flopps && floppsMode === 'wildcard-event') {
    const event = await generateFloppsWildcardEvent(opts, apiKey, floppsModel);
    if (opts.wildcardOutputFile) {
      fs.mkdirSync(path.dirname(opts.wildcardOutputFile), { recursive: true });
      fs.writeFileSync(opts.wildcardOutputFile, JSON.stringify(event, null, 2));
    }
    if (opts.jsonOutput) console.log(JSON.stringify(event, null, 2));
    else console.log(JSON.stringify(event));
    return;
  }

  console.error(`\n  🎴 Generating AI card set...`);
  console.error(`  Theme: ${themeName} (${catLabel})`);
  if (setCategory) console.error(`  Category: ${setCategory}`);
  if (opts.sport) console.error(`  Sport: ${opts.sport}`);
  console.error(`  Model: ${opts.model}`);
  console.error(`  Cards: ${opts.cards}${opts.cards === 'auto' ? ' (auto)' : ''}`);
  if (opts.flopps) {
    console.error(`  Flopps mode: ${floppsMode}`);
    console.error(`  Flopps copy model: ${floppsModel}`);
  }

  // If --cards auto (or not specified), ask AI to decide set size
  if (opts.cards === 'auto') {
    console.error(`  🤔 Asking AI to determine ideal set size...`);
    opts.cards = await aiDecideSetSize(themeName, setCategory || 'character', opts.model, apiKey);
    console.error(`  📏 AI decided: ${opts.cards} cards`);
  }

  // Build prompt and call LLM — use batching for 150+ cards
  const BATCH_SIZE = 50; // 80 cards per API call is safe for most models
  let allCards = [];

  if (hasSetFixture) {
    console.error(`  🧪 Using fixture cards from ${process.env.AI_SET_GENERATOR_FIXTURE_FILE}`);
    allCards = parseCards(JSON.stringify(loadFixtureJsonArray(process.env.AI_SET_GENERATOR_FIXTURE_FILE)), true);
    opts.cards = allCards.length;
  } else if (opts.cards <= BATCH_SIZE) {
    // Single call
    const prompt = buildPrompt(themeName, catLabel, opts.cards, categoryConfig);
    const raw = await callLLM(opts.model, prompt, apiKey);
    // For category-specific responses (movie/tv), parse differently
    if (setCategory && setCategory !== 'character') {
      const result = CAT.parseCategoryCards(raw, setCategory);
      allCards = result.cards;
    } else {
      allCards = parseCards(raw, true);
    }
  } else {
    // Batched: first batch with full theme prompt, subsequent batches with continuation
    let batch = 1;
    const totalBatches = Math.ceil(opts.cards / BATCH_SIZE);
    
    for (let start = 1; start <= opts.cards; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, opts.cards);
      console.error(`  📦 Batch ${batch}/${totalBatches} (cards ${start}-${end})...`);

      const prompt = start === 1
        ? buildPrompt(themeName, catLabel, end, categoryConfig)  // First batch generates 1..end
        : buildBatchPrompt(themeName, catLabel, start, end, categoryConfig);
      
      const raw = await callLLM(opts.model, prompt, apiKey);
      
      let cards;
      try {
        if (setCategory && setCategory !== 'character') {
          cards = CAT.parseCategoryCards(raw, setCategory).cards;
        } else {
          cards = parseCards(raw, true);
        }
        if (cards.length > 0 && start > 1) {
          // Renumber to correct sequence
          cards = cards.map((c, i) => ({ ...c, num: String(start + i).padStart(3, '0') }));
        }
        allCards.push(...cards);
        console.error(`  ✅ Got ${cards.length} cards`);
      } catch (e) {
        console.error(`  ❌ Batch ${batch} failed: ${e.message}`);
        // Pad with procedural fallback for this batch
        console.error(`  ⚠️  Padding batch ${batch} with procedural cards...`);
        for (let i = start; i <= end; i++) {
          allCards.push({
            num: String(i).padStart(3, '0'),
            name: `Card ${i}`,
            subset: 'Base',
            starTier: 'Common',
            desc: `${themeName} card #${i}.`,
            stats: { power: 50, speed: 50, technique: 50, endurance: 50, charisma: 50 },
            basePrice: 0.15,
          });
        }
      }
      batch++;
    }
  }

  // Re-number to ensure correct sequence
  allCards = allCards.map((c, i) => ({ ...c, num: String(i + 1).padStart(3, '0') }));
  
  // Trim or pad to exact count
  if (allCards.length > opts.cards) allCards = allCards.slice(0, opts.cards);

  // Save
  const key = saveSet(allCards, setCode, themeName, catLabel, year, opts.customTypes, {
    setCategory,
    sport: opts.sport || null,
    collectionTheme: setCategory === 'collection' ? themeName : null,
    cadenceDays: 45,
  });
  // If category-specific, update the set JSON with category info
  if (setCategory && setCategory !== 'character') {
    try {
      const setPath = resolveGeneratedSetPath(key);
      if (!setPath) throw new Error(`Could not locate generated set file for ${key}`);
      const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
      set.setCategory = setCategory;
      if (opts.sport) set.sport = opts.sport;
      set.metadata = buildRichSetMetadata({
        officialName: set.officialName || set.name,
        themeName: set.themeName || themeName,
        category: set.category,
        setCategory: set.setCategory,
        year: set.year,
        code: set.code,
        cards: set.cards,
        seed: set.seed,
        source: 'ai-generated',
        parallels: set.parallels || [],
        cardTypes: set.cardTypes || [],
        inserts: set.inserts || [],
        sport: set.sport,
        collectionTheme: set.collectionTheme,
        propertyGenre: set.propertyGenre,
        propertySynopsis: set.propertySynopsis,
        seasons: set.seasons,
        cadenceDays: 45,
        createdAt: set.created,
      });
      fs.writeFileSync(setPath, JSON.stringify(set, null, 2));
    } catch {}
  }

  let savedSet = null;
  try {
    const setPath = resolveGeneratedSetPath(key);
    if (setPath) savedSet = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  } catch {}

  printSummary(themeName, setCode, allCards);

  if (opts.customTypes) {
    const setPath = resolveGeneratedSetPath(key);
    if (setPath) {
      const set = savedSet || JSON.parse(fs.readFileSync(setPath, 'utf8'));
      console.error(`\n  🎴 CUSTOM TYPE SYSTEM:`);
      console.error(`  Parallels: ${set.parallels.length} themed tiers`);
      console.error(`  Card Types: ${set.cardTypes.length} types`);
      if (set.inserts.length) console.error(`  Inserts: ${set.inserts.length} insert sets`);
      console.error(`  Use "card-types" command to view details.\n`);
    }
  }

  if (opts.flopps && savedSet) {
    const summary = summarizeFloppsSet(savedSet, allCards);
    const simulationContext = buildStructuredFloppsContext({
      mode: floppsMode,
      themeName: savedSet.name,
      category: savedSet.setCategory || setCategory || catLabel || 'character',
      setCode: savedSet.code || setCode,
      cards: allCards.length,
      year: savedSet.year || year,
      summary,
      floppsState,
      cadenceDays: 45,
    });
    const prompt = buildFloppsLaunchPrompt({
      mode: floppsMode,
      themeName: savedSet.name,
      category: savedSet.setCategory || setCategory || catLabel || 'character',
      setCode: savedSet.code || setCode,
      cards: allCards.length,
      year: savedSet.year || year,
      summary,
      floppsState,
      cadenceDays: 45,
    });
    const article = hasFloppsArticleFixture
      ? fs.readFileSync(process.env.FLOPPS_ARTICLE_FIXTURE, 'utf8')
      : await callLLM(floppsModel, prompt, apiKey, 'You are Flopps, an alternative-world trading card company writing a fake corporate blog. Output only markdown, with no preamble or code fences.');
    const outDir = saveFloppsArtifacts(savedSet, article, floppsMode, simulationContext);
    console.error(`\n  📰 Flopps launch copy saved to: ${path.relative(process.cwd(), outDir)}`);
    console.log(renderFloppsMarkdown(article, savedSet));
  }

  console.error(`  💾 Saved to: data/sets/${key}`);
  console.error(`  Open packs with: node card-engine.js open-box hobby\n`);
}

main().catch((e) => {
  console.error(`\n  ❌ Error: ${e.message}\n`);
  process.exit(1);
});
