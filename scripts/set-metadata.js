#!/usr/bin/env node
'use strict';

function hashStringSeed(str) {
  let h = 0;
  for (let i = 0; i < String(str || '').length; i++) {
    h = ((h << 5) - h) + String(str)[i].charCodeAt(0);
    h |= 0;
  }
  return Math.abs(h);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function round(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1000) / 1000;
}

const ARCHETYPES = {
  flagship: {
    productLine: 'Flagship Series',
    brandFamily: 'flagship',
    marketPosition: 'mass flagship',
    artStyles: ['broadcast realism', 'collector-poster illustration', 'heroic portrait montage'],
    layoutStyles: ['classic stats grid', 'broadcast lower-third layout', 'full-bleed flagship frame'],
    finishes: ['gloss coat', 'foil logo accents', 'spot UV title hits'],
    taglineWords: ['Own the season', 'Every card matters', 'Built for the full chase'],
  },
  chrome: {
    productLine: 'Chrome',
    brandFamily: 'chrome',
    marketPosition: 'modern chromium',
    artStyles: ['hyper-saturated studio photography', 'chrome futurism', 'neon collector realism'],
    layoutStyles: ['refractor frame', 'high-contrast chrome panel', 'rainbow-ready chassis'],
    finishes: ['chromium shine', 'refractor foil', 'mirror stock'],
    taglineWords: ['Refractors rule', 'Color in every box', 'The rainbow starts here'],
  },
  cosmic: {
    productLine: 'Cosmic Chrome',
    brandFamily: 'cosmic chrome',
    marketPosition: 'premium spectacle chrome',
    artStyles: ['psychedelic cosmic collage', 'astral chrome portraiture', 'celestial action poster'],
    layoutStyles: ['orbital halo frame', 'galactic depth layers', 'starfield refractor panel'],
    finishes: ['cosmic foil burst', 'nebula holo coat', 'starfield chrome'],
    taglineWords: ['Rip the galaxy', 'Color beyond reason', 'The chase leaves orbit'],
  },
  heritage: {
    productLine: 'Heritage Edition',
    brandFamily: 'retro heritage',
    marketPosition: 'nostalgia release',
    artStyles: ['aged print homage', 'retro illustration finish', 'newsprint-era color grading'],
    layoutStyles: ['vintage template recreation', 'throwback border system', 'retro bio panel'],
    finishes: ['matte heritage stock', 'aged-card varnish', 'paper throwback finish'],
    taglineWords: ['Yesterday sold today', 'Nostalgia is premium', 'Classic design, modern frenzy'],
  },
  museum: {
    productLine: 'Museum Collection',
    brandFamily: 'museum premium',
    marketPosition: 'high-end curated',
    artStyles: ['gallery-lit portraiture', 'luxury exhibit collage', 'prestige matte photography'],
    layoutStyles: ['museum placard layout', 'framed exhibit composition', 'premium relic window chassis'],
    finishes: ['museum matte laminate', 'embossed foil seal', 'premium texture board'],
    taglineWords: ['Curated for prestige', 'Gallery-grade chase', 'Display case energy'],
  },
  gilded: {
    productLine: 'Gilded Collection',
    brandFamily: 'gold premium',
    marketPosition: 'luxury gold-forward',
    artStyles: ['black-and-gold luxury portraiture', 'opulent premium collage', 'vault-room chrome glamour'],
    layoutStyles: ['gilded border frame', 'luxury plaque layout', 'gold-forward premium window'],
    finishes: ['gold foil flood', 'black gloss stock', 'metallic edge detailing'],
    taglineWords: ['Everything turns gold', 'Luxury in every hit', 'Built for the velvet rope'],
  },
  finest: {
    productLine: 'Finest',
    brandFamily: 'premium chromium',
    marketPosition: 'tiered premium chrome',
    artStyles: ['high-energy premium action', 'clean chrome postering', 'elite refractor realism'],
    layoutStyles: ['tier-split premium panel', 'finest wave frame', 'deluxe insert scaffold'],
    finishes: ['premium refractor sheen', 'wave foil', 'multi-layer gloss'],
    taglineWords: ['Premium starts here', 'Sharper chase, louder finish', 'Top shelf chromium'],
  },
};

function inferArchetype({ themeName, category, setCategory, cards, explicitArchetype }) {
  if (explicitArchetype && ARCHETYPES[explicitArchetype]) return explicitArchetype;
  const lower = String(themeName || '').toLowerCase();
  if (/cosmic|nebula|space|galaxy|stellar/.test(lower)) return 'cosmic';
  if (/heritage|retro|vintage|ancient|history/.test(lower)) return 'heritage';
  if (/museum|archive|artifact/.test(lower)) return 'museum';
  if (/gilded|gold|royal|luxury/.test(lower)) return 'gilded';
  if (/chrome|neon|cyber|future|street racing/.test(lower)) return 'chrome';
  if (setCategory === 'sports') return cards >= 220 ? 'chrome' : 'flagship';
  if (setCategory === 'movie' || setCategory === 'tv') return 'heritage';
  if (setCategory === 'collection') return 'museum';
  return 'flagship';
}

function buildOfficialName(themeName, archetypeKey) {
  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.flagship;
  const cleanTheme = String(themeName || 'Unnamed Theme').trim();
  if (cleanTheme.toLowerCase().includes(archetype.productLine.toLowerCase())) return cleanTheme;
  return `${cleanTheme} ${archetype.productLine}`;
}

function buildReleaseWindow(year, rng) {
  const windows = [
    'Spring Hobby Window',
    'Early Summer Flagship Window',
    'Midsummer Chrome Window',
    'Late Summer Collector Window',
    'Autumn Prestige Window',
    'Holiday Speculation Window',
  ];
  return `${year} ${pick(rng, windows)}`;
}

function classifyParallel(parallel) {
  const name = String(parallel?.name || 'Base');
  const lower = name.toLowerCase();
  const serial = parallel?.ser || parallel?.serial || null;
  const family =
    /superfractor|1\/1|black infinite/.test(lower) ? 'ultimate chase' :
    /printing plate|plate/.test(lower) ? 'production relic' :
    /gold|gilded/.test(lower) ? 'gold' :
    /black|obsidian/.test(lower) ? 'dark premium' :
    /red|orange|green|blue|purple|pink|cyan|magenta|teal|white/.test(lower) ? 'color rainbow' :
    /chrome|refractor|crackle|ice|lava|wave|shimmer|pulse|surge|blast/.test(lower) ? 'chrome finish' :
    name === 'Base' ? 'base' :
    'specialty finish';
  const scarcityBand =
    serial === 1 ? 'one-of-one' :
    serial && serial <= 10 ? 'ultra-rare numbered' :
    serial && serial <= 99 ? 'rare numbered' :
    serial && serial <= 499 ? 'mid-numbered' :
    serial ? 'broad numbered' :
    parallel?.tier >= 10 ? 'ssp-style unnumbered' :
    parallel?.tier >= 5 ? 'short print' :
    parallel?.tier >= 2 ? 'core rainbow' :
    'base';
  return {
    name,
    family,
    finishStyle:
      /chrome|refractor|crackle|ice|lava|wave|shimmer|pulse|surge/.test(lower) ? 'reflective chromium' :
      /plate/.test(lower) ? 'metal plate' :
      /gold/.test(lower) ? 'metallic gold foil' :
      /black/.test(lower) ? 'dark gloss' :
      name === 'Base' ? 'standard gloss' :
      'specialty foil',
    colorway: name === 'Base' ? 'standard' : name,
    serial,
    scarcityBand,
    tier: parallel?.tier ?? null,
    multiplier: round(parallel?.pm || parallel?.priceMultiplier || 1),
  };
}

function buildGenericParallelFamilies(archetypeKey) {
  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.flagship;
  return [
    { family: 'base', role: 'core checklist', finishStyle: archetype.finishes[0] },
    { family: 'color rainbow', role: 'core collector rainbow', finishStyle: archetype.finishes[0] },
    { family: 'numbered chase', role: 'mid-tier scarcity ladder', finishStyle: archetype.finishes[1] },
    { family: 'premium black or gold', role: 'late-rainbow prestige', finishStyle: archetype.finishes[2] },
    { family: 'one-of-one', role: 'terminal chase card', finishStyle: 'ultimate premium finish' },
  ];
}

function summarizeCardTypes(cardTypes) {
  return (cardTypes || []).map((type) => ({
    id: type.id || null,
    name: type.name,
    format: type.format || 'standard',
    subtype: type.subtype || null,
    rarity: round(type.rarity),
    priceMultiplier: round(type.priceMultiplier || type.mult || 1),
    description: type.desc || '',
  }));
}

function summarizeInserts(inserts) {
  return (inserts || []).map((insert) => ({
    name: insert.name,
    size: insert.size || null,
    odds: insert.odds || null,
    basePrice: insert.basePrice || null,
    description: insert.description || null,
    parallels: insert.parallels || [],
  }));
}

function buildRichSetMetadata({
  officialName,
  themeName,
  category,
  setCategory,
  year,
  code,
  cards,
  seed,
  source,
  parallels,
  cardTypes,
  inserts,
  sport,
  collectionTheme,
  propertyGenre,
  propertySynopsis,
  seasons,
  cadenceDays,
  createdAt,
  explicitArchetype,
}) {
  const rng = mulberry32(hashStringSeed(`${officialName || themeName}:${code}:${year}:${seed || 0}:${source || 'set'}`));
  const archetypeKey = inferArchetype({ themeName, category, setCategory, cards: cards?.length || 0, explicitArchetype });
  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.flagship;
  const resolvedOfficialName = officialName || buildOfficialName(themeName, archetypeKey);
  const resolvedThemeName = themeName || resolvedOfficialName.replace(new RegExp(`\\s${archetype.productLine}$`), '');
  const starCounts = (cards || []).reduce((acc, card) => {
    acc[card.starTier] = (acc[card.starTier] || 0) + 1;
    return acc;
  }, {});
  const topTierCount = (starCounts.Legendary || 0) + (starCounts.Superstar || 0);
  const classifiedParallels = (parallels || []).length ? parallels.map(classifyParallel) : [];
  const parallelFamilies = classifiedParallels.length
    ? Array.from(new Set(classifiedParallels.map((parallel) => parallel.family))).map((family) => ({
      family,
      count: classifiedParallels.filter((parallel) => parallel.family === family).length,
    }))
    : buildGenericParallelFamilies(archetypeKey);

  return {
    schemaVersion: 3,
    source: source || 'procedural',
    code,
    officialName: resolvedOfficialName,
    themeName: resolvedThemeName,
    category,
    setCategory: setCategory || null,
    sport: sport || null,
    collectionTheme: collectionTheme || null,
    propertyGenre: propertyGenre || null,
    propertySynopsis: propertySynopsis || null,
    seasons: seasons || null,
    cadenceDays: cadenceDays || 45,
    releaseWindow: buildReleaseWindow(year, rng),
    brandFamily: archetype.brandFamily,
    productLine: archetype.productLine,
    productArchetype: archetypeKey,
    marketPosition: archetype.marketPosition,
    tagline: pick(rng, archetype.taglineWords),
    creativeDirection: {
      artisticStyle: pick(rng, archetype.artStyles),
      layoutStyle: pick(rng, archetype.layoutStyles),
      finishProfile: pick(rng, archetype.finishes),
      typographyDirection: pick(rng, ['broadcast bold', 'retro slab serif', 'premium sans headline', 'spec-sheet condensed']),
      paletteDirection: pick(rng, ['team-color dominant', 'gold-and-black premium', 'chrome rainbow spectrum', 'aged paper heritage']),
      photographyApproach: pick(rng, ['hero portrait focus', 'action-first framing', 'studio key art hybrid', 'collector catalog montage']),
    },
    productIdentity: {
      officialName: resolvedOfficialName,
      theme: resolvedThemeName,
      collectorHook: pick(rng, [
        'deep rainbow chase with prestige inserts',
        'nostalgia-forward release with modern scarcity pressure',
        'high-volume flagship checklist built to feed the secondary market',
        'premium product identity with loud showcase hits',
      ]),
      checklistPhilosophy: pick(rng, [
        'broad base set with layered chase escalators',
        'showcase-driven checklist with premium insert concentration',
        'character world-building through a flagship collector frame',
        'template-led release built for annual continuity and serial collecting',
      ]),
      boxBreakIdentity: pick(rng, [
        'built for pack-rip theater',
        'structured around hobby-box hit reveals',
        'tuned for breaker showcases and social clips',
        'engineered for color-rainbow progression',
      ]),
    },
    packaging: {
      hobbyConfiguration: { packsPerBox: 12, cardsPerPack: 5 },
      blasterConfiguration: { packsPerBox: 6, cardsPerPack: 5 },
      jumboConfiguration: { packsPerBox: 1, cardsPerPack: 10 },
      retailConfiguration: { packsPerBox: 1, cardsPerPack: 5 },
      shelfPitch: pick(rng, [
        'chrome finish and chase-driven color ladder',
        'heritage storytelling with modern parallels',
        'luxury-box energy with curated hit architecture',
        'flagship checklist breadth with premium chase pressure',
      ]),
    },
    chaseArchitecture: {
      premiumCardCount: topTierCount,
      hitPrograms: summarizeCardTypes(cardTypes).filter((type) => /auto|relic|booklet|patch|signature/i.test(type.name)),
      insertPrograms: summarizeInserts(inserts),
      parallelFamilies,
      parallelLineup: classifiedParallels,
      chaseNarrative: pick(rng, [
        'start with broad base access, then climb into numbered color, premium autos, and terminal one-of-ones',
        'the release is designed so the rainbow itself becomes a metagame',
        'the product relies on escalating finish prestige to make duplicates feel chaseable',
        'collector psychology is built around visible ladder progression from base to impossible',
      ]),
    },
    contentStructure: {
      cardCount: cards?.length || 0,
      subsetCount: Array.from(new Set((cards || []).map((card) => card.subset))).length,
      tierDistribution: starCounts,
      rookieOrProspectBias: round(((cards || []).filter((card) => /rookie|prospect/i.test(String(card.subset || ''))).length) / Math.max(1, cards?.length || 1)),
    },
    provenance: {
      seed: seed ?? null,
      createdAt: createdAt || new Date().toISOString(),
      generator: source || 'procedural',
      researchBasis: [
        'flagship/checklist scale',
        'chrome rainbow logic',
        'heritage template reuse',
        'museum or gilded premium packaging',
        'insert-and-hit ladder design',
      ],
    },
  };
}

module.exports = {
  buildOfficialName,
  buildRichSetMetadata,
};
