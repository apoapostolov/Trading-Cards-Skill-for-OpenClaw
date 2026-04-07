#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clean(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compact(parts) {
  return parts.map(clean).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function limitWords(value, maxWords) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function titleCase(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function bulletList(lines) {
  return lines.filter(Boolean).map((line) => `- ${clean(line)}`).join('\n');
}

function section(label, body) {
  return `${label.toUpperCase()}\n${clean(body)}`;
}

function summaryLine(label, value) {
  return `${label}: ${clean(value)}`;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveSetPath(setRef) {
  if (!setRef) {
    const cfg = fs.existsSync(CONFIG_PATH) ? loadJson(CONFIG_PATH) : {};
    if (cfg.activeSet) {
      const active = path.join(SETS_DIR, `${cfg.activeSet}.json`);
      if (fs.existsSync(active)) return active;
    }
    throw new Error('No set reference provided and no active set found.');
  }

  const looksLikePath = path.isAbsolute(setRef) || setRef.includes('/') || setRef.includes('\\');
  const explicit = looksLikePath
    ? path.resolve(setRef)
    : path.join(SETS_DIR, setRef.endsWith('.json') ? setRef : `${setRef}.json`);
  if (fs.existsSync(explicit)) return explicit;

  const prefix = clean(setRef);
  const match = fs.existsSync(SETS_DIR)
    ? fs.readdirSync(SETS_DIR).find((file) => file.startsWith(prefix) && file.endsWith('.json'))
    : null;
  if (match) return path.join(SETS_DIR, match);

  throw new Error(`Could not resolve set "${setRef}".`);
}

function isBakedPromptSet(set) {
  return clean(set?.promptMode || '').toLowerCase() === 'baked' || clean(set?.code || '').toUpperCase() === 'BOC';
}

const SET_TRADE_DRESS_PROFILES = {
  default: {
    name: 'Shared Set Trade Dress',
    identity: 'Full set name wordmark or emblem',
    logoStyle: 'set wordmark or emblem, not an internal abbreviation',
    logoPlacement: 'top banner, upper corner seal, or centered crest depending on the set',
    logo: 'shared set mark',
    border: 'consistent border rail with recurring set identity cues',
    nameplate: 'shared title lockup',
    backFrame: 'shared stats grid with recurring rail geometry',
    watermark: 'subtle set watermark',
    motif: 'shared brand motif',
    accentPalette: 'set-accent colors drawn from the set palette',
    baseRule: 'Base cards carry the shared set identity prominently.',
    variantRule: 'Variants may tint or texture the shared frame while preserving its structure.',
    premiumRule: 'High-end variants may break the base dress and replace it with a variant-first frame.',
    notes: 'Use the same visual language across the set so the cards feel like one family.',
  },
  character: {
    name: 'Character Trade Dress',
    identity: 'Character-set wordmark or crest',
    logoStyle: 'full set name wordmark or emblem',
    logoPlacement: 'top banner or upper crest',
    logo: 'character-set badge or crest',
    border: 'clean portrait border with strong nameplate geometry',
    nameplate: 'bold lower-third identity strip',
    backFrame: 'organized stats panel with a clean flavor rail',
    watermark: 'subtle character mark',
    motif: 'portrait-first collectible framing',
    accentPalette: 'set accents tuned to the set palette',
    baseRule: 'Base cards should read as one consistent portrait system.',
    variantRule: 'Variants should keep the base portrait system visible unless they are explicitly premium.',
    premiumRule: 'Chase variants can overtake the portrait system with a stronger foil language.',
    notes: 'Best for character-led sets with a stable portrait template.',
  },
  sports: {
    name: 'Sports Trade Dress',
    identity: 'League-style wordmark or badge',
    logoStyle: 'full set name lockup, shield, or crest',
    logoPlacement: 'top banner or upper-left seal',
    logo: 'league-style badge',
    border: 'scoreboard border with clean stat lanes',
    nameplate: 'player nameplate and team accent bar',
    backFrame: 'stats-first back with strong hierarchy and season cueing',
    watermark: 'subtle league watermark',
    motif: 'scoreline and stat-panel identity',
    accentPalette: 'team-inspired accent colors',
    baseRule: 'Base cards carry the league-style identity cleanly.',
    variantRule: 'Variants can tint the accents, but the stat-and-name structure should stay recognizable.',
    premiumRule: 'Premium variants can trade the scoreboard structure for a chase-card frame.',
    notes: 'Built for sports products where the layout reads like a broadcast package.',
  },
  celebrity: {
    name: 'Celebrity Trade Dress',
    identity: 'Premiere-style wordmark or crest',
    logoStyle: 'full set name marquee or emblem',
    logoPlacement: 'top banner or upper-left seal',
    logo: 'studio-style badge or marquee crest',
    border: 'spotlight border with glossy framing',
    nameplate: 'premiere marquee nameplate',
    backFrame: 'credit-style back with elegant bio hierarchy',
    watermark: 'subtle star watermark',
    motif: 'red-carpet polish and entertainment branding',
    accentPalette: 'warm premiere tones and metallic highlights',
    baseRule: 'Base cards should feel like a coherent entertainment line.',
    variantRule: 'Variants can shift glamour tones while preserving the studio polish.',
    premiumRule: 'Premium variants may replace the base frame with a more cinematic reveal.',
    notes: 'Use for celebrity sets that want a polished publicity look.',
  },
  movie: {
    name: 'Movie Trade Dress',
    identity: 'Film-title wordmark or logo lockup',
    logoStyle: 'full set title lockup or film emblem',
    logoPlacement: 'top title bar or poster-style crest',
    logo: 'film-title card mark',
    border: 'cinematic frame rail',
    nameplate: 'title-card strip with scene cueing',
    backFrame: 'scene-card back with chapter logic',
    watermark: 'subtle film watermark',
    motif: 'poster and scene-card language',
    accentPalette: 'cinematic highlights from the film palette',
    baseRule: 'Base cards should feel like a cohesive film property.',
    variantRule: 'Variants can borrow poster-language accents while keeping the film card grammar.',
    premiumRule: 'Premium variants may adopt more poster-like or insert-like framing.',
    notes: 'Good for story-driven movie cards with sequence continuity.',
  },
  tv: {
    name: 'TV Trade Dress',
    identity: 'Series wordmark or episode emblem',
    logoStyle: 'full series name lockup or channel-style emblem',
    logoPlacement: 'upper title rail or episode badge',
    logo: 'episode-style badge',
    border: 'broadcast frame with season cues',
    nameplate: 'episode and season title strip',
    backFrame: 'broadcast stats panel and episode rail',
    watermark: 'subtle broadcast watermark',
    motif: 'episodic frame language',
    accentPalette: 'series accent colors',
    baseRule: 'Base cards should read like a single television package.',
    variantRule: 'Variants can tune the episode styling while keeping the series identity consistent.',
    premiumRule: 'Premium variants may break the broadcast frame and present a special event look.',
    notes: 'Use for TV sets that need episode continuity and recurring visual grammar.',
  },
  collection: {
    name: 'Collection Trade Dress',
    identity: 'Catalog wordmark or specimen emblem',
    logoStyle: 'full set name lockup or archival stamp',
    logoPlacement: 'upper label or catalog seal',
    logo: 'specimen-label badge',
    border: 'museum label border with clean catalog lines',
    nameplate: 'archival nameplate',
    backFrame: 'catalog-style data panel',
    watermark: 'subtle catalog watermark',
    motif: 'archival and specimen language',
    accentPalette: 'neutral archival tones with one accent color',
    baseRule: 'Base cards should feel like they belong to the same catalog.',
    variantRule: 'Variants can change the specimen treatment while preserving the catalog grammar.',
    premiumRule: 'Premium variants may take on exhibition or display-case framing.',
    notes: 'Use for science, art, nature, or archival collection sets.',
  },
  novelty: {
    name: 'Novelty Trade Dress',
    identity: 'Playful set wordmark or parody emblem',
    logoStyle: 'full set name or playful emblem, not an acronym',
    logoPlacement: 'top banner, corner seal, or product-style crest',
    logo: 'playful novelty badge',
    border: 'gag-friendly border with packaging cues',
    nameplate: 'obvious joke-forward nameplate',
    backFrame: 'mock product or faux-document back frame',
    watermark: 'subtle parody stamp',
    motif: 'package, certificate, or ad parody language',
    accentPalette: 'bold novelty accents and punchy contrast',
    baseRule: 'Base cards should still read like a coherent novelty line.',
    variantRule: 'Variants can shift into packaging, booklet, ticket, or parody-ad framing.',
    premiumRule: 'Premium novelty variants may intentionally break the card grammar for the gag.',
    notes: 'Use this when the card itself is the joke, not just the subject.',
  },
  'pop-culture-parody': {
    name: 'Pop Culture Parody Trade Dress',
    identity: 'OpenClaw parody wordmark or terminal emblem',
    logoStyle: 'full set name or emblem, never the internal code',
    logoPlacement: 'top banner, upper-left seal, or centered crest',
    logo: 'OpenClaw-style parody badge',
    border: 'chrome border with terminal corners and tech-ui ticks',
    nameplate: 'compact lower-third tech UI nameplate',
    backFrame: 'two-column stats grid with a flavor strip and serial rail',
    watermark: 'subtle claw glyph watermark',
    motif: 'terminal UI, chat, and developer-tool cues',
    accentPalette: 'ink black, chrome silver, electric blue, and purple',
    baseRule: 'Base cards should carry the terminal UI language prominently.',
    variantRule: 'Variants should keep the set logo and rail language readable unless they are intentionally premium.',
    premiumRule: 'High-end variants can break the base dress and use a stronger finish-specific frame.',
    notes: 'Use for parody sets where the house style should feel like an OpenClaw product line.',
  },
};

const NOVELTY_PROFILES = {
  default: {
    family: 'novelty',
    subtype: 'generic novelty card',
    layout: 'Playful novelty framing with one clear gag and one clean collectible read.',
    packaging: 'Use packaging, faux-document, ticket, or insert-like framing when it helps the joke land.',
    copyTone: 'wry, playful, and self-aware',
    visualDevice: 'sticker, ticket stub, certificate, wrapper, or parody ad language',
    frontRule: 'Make the novelty obvious on the front without turning the composition into clutter.',
    backRule: 'Keep the back legible while preserving the gag and the collectible structure.',
    backRole: 'The back can act like a faux spec sheet, ad panel, certificate, or toy-package reverse.',
    notes: 'Fallback novelty profile for mixed gag cards and parody inserts.',
  },
  packaging: {
    family: 'novelty',
    subtype: 'packaging gag',
    layout: 'Blister-pack or product-box language with a clean display-window hierarchy.',
    packaging: 'Treat the card like a premium retail package or toy insert with visible consumer-product cues.',
    copyTone: 'retail parody, product-demo, and collectible gimmick',
    visualDevice: 'hang tag, box front, blister window, or wrapper panel',
    frontRule: 'Use packaging cues as the main joke and keep the subject readable through the package logic.',
    backRule: 'Make the back feel like the reverse of a premium retail package or insert card.',
    backRole: 'Use the back as a product label, ingredient panel, or package copy surface.',
    notes: 'Best when the novelty is literally the package language itself.',
  },
  certificate: {
    family: 'novelty',
    subtype: 'certificate or credential gag',
    layout: 'Faux certificate structure with formal seals, borders, and a mock legal hierarchy.',
    packaging: 'Frame the card like an official certificate, award, license, or credential.',
    copyTone: 'formal, dry, and intentionally over-serious',
    visualDevice: 'seal, embossed border, signature line, or official stamp',
    frontRule: 'Play the formality straight so the joke comes from the contrast.',
    backRule: 'Use the back like an official continuation page, endorsement, or verification note.',
    backRole: 'The back can read like a certifying authority page or a mock documentation panel.',
    notes: 'Works for fake awards, credentials, and parody validation cards.',
  },
  ad: {
    family: 'novelty',
    subtype: 'advertisement parody',
    layout: 'Retro ad composition with bold headline, callouts, and one dominant visual punchline.',
    packaging: 'Use magazine-ad or catalog-ad framing with a crisp promotional hierarchy.',
    copyTone: 'punchy, promotional, and knowingly exaggerated',
    visualDevice: 'headline burst, callout arrows, price bubble, or testimonial strip',
    frontRule: 'Treat the front like an ad that has been compressed into card form.',
    backRule: 'Let the back read like the ad’s fine print, alternate panel, or product details page.',
    backRole: 'The back can function as a mock sales sheet or a continuation of the ad copy.',
    notes: 'Good when the card is spoofing a product launch or lifestyle advertisement.',
  },
  ticket: {
    family: 'novelty',
    subtype: 'ticket or voucher',
    layout: 'Perforated ticket, voucher, or admission stub with numbered rail logic.',
    packaging: 'Use stub edges, perforation marks, seat or row fields, and a compact event layout.',
    copyTone: 'event-style, playful, and lightly ceremonial',
    visualDevice: 'stub perforation, seat field, barcode, or admission panel',
    frontRule: 'Make the card feel like an admission artifact or collectible ticket.',
    backRule: 'Use the back like a venue back, a redemption panel, or a mock access page.',
    backRole: 'The back can behave like event details, terms, or a collectible stub reverse.',
    notes: 'Good for cards that want a tear-off, admission, or token feel.',
  },
  sticker: {
    family: 'novelty',
    subtype: 'sticker or decal sheet',
    layout: 'Sticker-sheet logic with peel cues, outlines, and playful cut lines.',
    packaging: 'Make the card feel like a decal sheet, sticker pack, or adhesive collectible.',
    copyTone: 'casual, playful, and accessory-like',
    visualDevice: 'peel tab, die line, outline sticker, or sheet grid',
    frontRule: 'Frame the subject as a sticker-ready graphic or decal insert.',
    backRule: 'Keep the back like a sticker sheet reverse, reference sheet, or pack note.',
    backRole: 'The back can read like sheet numbering, application instructions, or material notes.',
    notes: 'Use when the novelty is in the peel-and-collect surface language.',
  },
  comic: {
    family: 'novelty',
    subtype: 'mini-comic or panel card',
    layout: 'Comic-panel sequencing with gutters, captions, and a staged reveal.',
    packaging: 'Treat the card as a tiny comic page or sequential insert.',
    copyTone: 'story-driven, snappy, and lightly theatrical',
    visualDevice: 'panel gutter, caption box, sound effect, or speech balloon',
    frontRule: 'Use panel rhythm so the front feels like a miniature comic page.',
    backRule: 'Let the back continue the story or function as a credits page.',
    backRole: 'The back can work as an issue page, caption strip, or story continuation.',
    notes: 'Useful for novelty cards that need sequential storytelling on-card.',
  },
  fauxdoc: {
    family: 'novelty',
    subtype: 'faux document',
    layout: 'Official-looking document or memo structure with fields and stamp marks.',
    packaging: 'Use docket, memo, report, receipt, or form language.',
    copyTone: 'bureaucratic, deadpan, and intentionally over-documented',
    visualDevice: 'field labels, stamp marks, memo blocks, or file headers',
    frontRule: 'Make the front feel like a real document that also happens to be a card.',
    backRule: 'Use the back as a continuation sheet, addendum, or filing page.',
    backRole: 'The back can serve as the reverse of a form, memo, or official notice.',
    notes: 'Strong choice when the gag comes from bureaucratic authenticity.',
  },
  reveal: {
    family: 'novelty',
    subtype: 'reveal or scratch-off gag',
    layout: 'Hidden-panel, scratch-off, or reveal-card structure with an obvious discovery moment.',
    packaging: 'Use conceal/reveal language, opaque masks, or layered surprise cues.',
    copyTone: 'mischievous, suspenseful, and reveal-driven',
    visualDevice: 'scratch layer, tear strip, hidden window, or reveal flap',
    frontRule: 'Signal the hidden reveal clearly so the card reads as interactive.',
    backRule: 'The back can explain the reveal or show the revealed state cleanly.',
    backRole: 'The back may function like instructions, reveal copy, or the answer state.',
    notes: 'Use when the card’s novelty depends on the reveal mechanic itself.',
  },
};

const NOVELTY_ALIASES = {
  'mini-comic': 'comic',
  'mini comic': 'comic',
  'faux-doc': 'fauxdoc',
  'faux-document': 'fauxdoc',
  'faux document': 'fauxdoc',
  'parody-box': 'packaging',
  'product-box': 'packaging',
  'toy-pack': 'packaging',
  'wrapper-card': 'packaging',
  'scratch-off': 'reveal',
  'scratch off': 'reveal',
  'reveal-card': 'reveal',
  'reveal card': 'reveal',
};

function inferSetTradeDressProfile(set) {
  const source = set?.tradeDress || {};
  const key = slugify(set?.setCategory || set?.category || 'default');
  const base = SET_TRADE_DRESS_PROFILES[key] || SET_TRADE_DRESS_PROFILES.default;
  return {
    name: clean(source.name || base.name),
    identity: clean(source.identity || base.identity),
    logoStyle: clean(source.logoStyle || base.logoStyle),
    logoPlacement: clean(source.logoPlacement || base.logoPlacement),
    logo: clean(source.logo || source.mark || base.logo),
    border: clean(source.border || base.border),
    nameplate: clean(source.nameplate || base.nameplate),
    backFrame: clean(source.backFrame || base.backFrame),
    watermark: clean(source.watermark || base.watermark),
    motif: clean(source.motif || base.motif),
    accentPalette: clean(source.accentPalette || base.accentPalette),
    baseRule: clean(source.baseRule || base.baseRule),
    variantRule: clean(source.variantRule || base.variantRule),
    premiumRule: clean(source.premiumRule || base.premiumRule),
    logoRule: clean(source.logoRule || base.logoStyle || base.identity),
    notes: clean(source.notes || base.notes),
  };
}

function inferNoveltyProfile(card, set) {
  const source = card?.novelty || {};
  const raw = clean(
    source.type ||
      source.category ||
      source.style ||
      card?.noveltyType ||
      card?.noveltyCategory ||
      card?.noveltyStyle ||
      card?.cardTypeName ||
      card?.special ||
      ''
  );
  const key = slugify(raw);
  const resolvedKey = NOVELTY_ALIASES[key] || key;
  const setKey = slugify(set?.setCategory || set?.category || '');
  const isNoveltyCard =
    Boolean(
      source.type ||
        source.category ||
        source.style ||
        card?.noveltyType ||
        card?.noveltyCategory ||
        card?.noveltyStyle
    ) ||
    key === 'novelty' ||
    key === 'parody' ||
    setKey === 'novelty';

  if (!isNoveltyCard) {
    return {
      isNoveltyCard: false,
      family: 'novelty',
      subtype: 'standard collectible card',
      layout: 'No novelty-specific framing.',
      packaging: 'Use the standard card grammar.',
      copyTone: 'straight collectible card tone',
      visualDevice: 'standard card layout',
      frontRule: 'No novelty-specific treatment is required.',
      backRule: 'No novelty-specific treatment is required.',
      backRole: 'Standard back structure.',
      notes: 'This card does not need a novelty subtree.',
    };
  }

  const base = NOVELTY_PROFILES.default;
  const profile = {
    ...base,
    ...NOVELTY_PROFILES[resolvedKey],
  };

  return {
    isNoveltyCard: true,
    family: profile.family,
    subtype: clean(profile.subtype || raw || base.subtype),
    layout: clean(profile.layout || base.layout),
    packaging: clean(profile.packaging || base.packaging),
    copyTone: clean(profile.copyTone || base.copyTone),
    visualDevice: clean(profile.visualDevice || base.visualDevice),
    frontRule: clean(profile.frontRule || base.frontRule),
    backRule: clean(profile.backRule || base.backRule),
    backRole: clean(profile.backRole || base.backRole),
    notes: clean(profile.notes || base.notes),
  };
}

function tradeDressModeForVariant(variantProfile, set) {
  if (isBakedPromptSet(set)) return 'baked';

  const rawName = slugify(variantProfile?.name || '');
  const family = slugify(variantProfile?.family || '');

  if (!rawName || rawName === 'base' || family === 'paper') return 'carry';
  if (/superfractor|black-infinite|printing-plate/.test(rawName)) return 'break';
  if (family === 'obsidian' || family === 'plate' || family === 'superfractor') return 'break';
  if (family === 'gilded' && !/gold$/.test(rawName)) return 'accent';
  if (family === 'chrome' || family === 'prizm' || family === 'acetate' || family === 'pattern') return 'accent';
  return 'carry';
}

function finalizeVariantProfile(profile, set) {
  return {
    ...profile,
    tradeDressMode: tradeDressModeForVariant(profile, set),
  };
}

const FORMAT_PROFILES = {
  standard: {
    name: 'Standard',
    ratio: '2.5:3.5 portrait',
    frontLayout: 'Centered hero portrait with a clean lower-third nameplate and narrow border rail.',
    backLayout: 'Two-column stats grid with the flavor text band across the bottom and serial stamp along the upper rail.',
    physical: 'Standard trading-card thickness with crisp corners and print-safe margins.',
  },
  mini: {
    name: 'Mini',
    ratio: 'compact portrait',
    frontLayout: 'Tighter crop, larger border weight, and a simplified title block to keep the subject readable at small size.',
    backLayout: 'Condensed stats grid, enlarged identifiers, and fewer decorative elements.',
    physical: 'Smaller surface area, tighter type scale, and strong edge contrast.',
  },
  landscape: {
    name: 'Landscape',
    ratio: 'wide horizontal',
    frontLayout: 'Wide hero composition with the subject offset to one side and the action trail flowing across the frame.',
    backLayout: 'Long stats band running left-to-right with the title and serial anchored at opposite ends.',
    physical: 'Broad panoramic framing with extra breathing room on the long edge.',
  },
  booklet: {
    name: 'Booklet',
    ratio: 'foldout multi-panel',
    frontLayout: 'Two-panel spread with a visible center fold and a staged reveal between the panels.',
    backLayout: 'Inside spread with the main scene on one panel and data / relic / auto placement on the other.',
    physical: 'Heavy premium stock with a hinge-safe fold and generous bleed around the seam.',
  },
  'die-cut': {
    name: 'Die-Cut',
    ratio: 'custom silhouette',
    frontLayout: 'Subject locked inside a custom cutout shape with negative space that follows the contour of the design.',
    backLayout: 'Cleaner, simpler back so the die-cut silhouette remains the headline feature.',
    physical: 'Shaped card stock with exposed negative space and protected corner bridges.',
  },
  oversized: {
    name: 'Oversized',
    ratio: 'large display',
    frontLayout: 'Large-format composition with extra environment detail, bigger title treatment, and a more cinematic background.',
    backLayout: 'Expanded stat layout with room for longer copy and larger visual hierarchy.',
    physical: 'Display-scale stock with broader borders and stronger framing.',
  },
  acetate: {
    name: 'Acetate',
    ratio: 'transparent',
    frontLayout: 'Floating subject on translucent stock with layered highlights and visible depth through the clear material.',
    backLayout: 'Back design should still read cleanly through the transparent surface and avoid dense clutter.',
    physical: 'Clear, glossy plastic-like card stock with luminous edge glow and internal reflections.',
  },
};

const VARIANT_PROFILES = {
  Base: {
    family: 'paper',
    palette: 'neutral white, silver, and team-accent color',
    foil: 'minimal spot gloss',
    pattern: 'clean card face with restrained accents',
    border: 'thin border rail with a tidy nameplate',
    frontLayout: 'Centered portrait, clean lower-third nameplate, and simple badge placement.',
    backLayout: 'Classic stats back with a tidy grid, flavor banner, and understated branding.',
    notes: 'Base cards should feel like the anchor of the set: readable, balanced, and not overworked.',
  },
  Chrome: {
    family: 'chrome',
    palette: 'mirror silver, cyan bloom, and rainbow highlights',
    foil: 'true refractor chrome with a rainbow-like reflective finish',
    pattern: 'smooth mirror stock with spectral shine',
    border: 'thin chrome border and tight radiating highlights',
    frontLayout: 'Centered portrait with crisp chrome edges and a strong reflective sheen across the frame.',
    backLayout: 'Chrome-accented back with clean stat blocks and a thin refractor rail.',
    notes: 'Topps Chrome-style rendering: chromium stock, durable feel, and a bright rainbow refractor bloom.',
  },
  Sapphire: {
    family: 'chrome',
    palette: 'deep sapphire blue, ice white, and bright cyan',
    foil: 'sapphire refractor foil boards',
    pattern: 'gemlike blue highlights with a premium icy glow',
    border: 'blue-framed premium border with luminous edge glints',
    frontLayout: 'Lush blue highlights, gemstone-like reflections, and a premium chrome face.',
    backLayout: 'Blue-accented back with high contrast and a luxury feel.',
    notes: 'Use a refined blue gemstone treatment rather than a generic blue wash.',
  },
  'Purple Shimmer': {
    family: 'chrome',
    palette: 'violet, plum, and electric lilac',
    foil: 'soft holographic shimmer',
    pattern: 'subtle wave shimmer with purple sheen',
    border: 'violet edge glow',
    frontLayout: 'Purple refractor mood with a soft ripple in the reflective surface.',
    backLayout: 'Purple foil accents, satin shadows, and a clean stat frame.',
    notes: 'Should read like a premium purple holo, not a flat purple tint.',
  },
  'Blue Crackle': {
    family: 'chrome',
    palette: 'electric blue, white ice, and dark navy',
    foil: 'cracked-ice foil',
    pattern: 'fractured blue ice shards across the foil layer',
    border: 'jagged ice-crack perimeter with bright spark scatter',
    frontLayout: 'Action art over a crackle-ice foil field with energetic shard reflections.',
    backLayout: 'Blue ice crackle accents around the stat grid.',
    notes: 'The foil should feel shattered and electric, like frozen glass under hard light.',
  },
  'Tie-Dye': {
    family: 'chrome',
    palette: 'rainbow swirl, neon yellow, hot pink, cyan, and lime',
    foil: 'swirling tie-dye holofoil',
    pattern: 'kaleidoscopic rainbow ripple',
    border: 'multicolor halo',
    frontLayout: 'Chaotic rainbow energy with a psychedelic chrome finish.',
    backLayout: 'Tie-dye streaks behind a readable data panel.',
    notes: 'Keep the palette bold but still collectible, not poster-chaos.',
  },
  'Pink Neon': {
    family: 'chrome',
    palette: 'hot pink, magenta, and blacklight purple',
    foil: 'neon pulse foil',
    pattern: 'electric neon glow with pink edge bloom',
    border: 'pink-lit border rail',
    frontLayout: 'Hard neon pink highlights and a nightclub-like reflective shine.',
    backLayout: 'Pink neon accents around a high-contrast back design.',
    notes: 'Should feel like a late-night retail chase parallel.',
  },
  Gold: {
    family: 'gilded',
    palette: 'metallic gold, champagne, and warm ivory',
    foil: 'full gold foil',
    pattern: 'embossed gold depth with reflective grain',
    border: 'embossed gold border and premium cresting',
    frontLayout: 'Luxury gold treatment with a weighted, trophy-like presence.',
    backLayout: 'Gold frame with formal stats and premium finish cues.',
    notes: 'Use rich metallic gold, not flat yellow.',
  },
  'Green Lava': {
    family: 'prizm',
    palette: 'emerald, black, and molten lime',
    foil: 'lava-flow metallic foil',
    pattern: 'dark green metallic veins with heat crack texture',
    border: 'glowing green fissure border',
    frontLayout: 'Dark green heat-map energy with molten streaks under the foil.',
    backLayout: 'Green lava waves around the stat panel and serial rail.',
    notes: 'Should feel molten and scarce, not neon flat.',
  },
  'Cyan Ice': {
    family: 'prizm',
    palette: 'cyan, glacier white, and cool silver',
    foil: 'frosted ice foil',
    pattern: 'crystalline frost and angular ice refraction',
    border: 'frosted cyan frame',
    frontLayout: 'Cold crystal treatment with strong specular highlights.',
    backLayout: 'Ice-glow stats panel with frosted borders.',
    notes: 'The effect should look frozen and glassy.',
  },
  'Magenta Pulse': {
    family: 'prizm',
    palette: 'magenta, ultraviolet, and hot pink',
    foil: 'energy pulse foil',
    pattern: 'radiating pulse lines and wave interference',
    border: 'magenta energy ring',
    frontLayout: 'High-voltage magenta surges wrapping the card face.',
    backLayout: 'Pulse-line back with bright magenta control blocks.',
    notes: 'Use strong pulsing lines rather than soft pastel gradients.',
  },
  'Orange Blaze': {
    family: 'prizm',
    palette: 'orange, amber, ember red, and smoke black',
    foil: 'flame-edge foil',
    pattern: 'fire streaks and ember sparks',
    border: 'burnished orange blaze border',
    frontLayout: 'Heat-driven fire foil with a scorched-looking energy wave.',
    backLayout: 'Orange highlight rail and fire-lit stats grid.',
    notes: 'Feels like a chase card on fire without becoming noisy.',
  },
  'Teal Surge': {
    family: 'prizm',
    palette: 'teal, aqua, and electric blue',
    foil: 'surge foil',
    pattern: 'electric surge lines and sharp waveform cuts',
    border: 'teal current border',
    frontLayout: 'Clean teal electricity with controlled wave motion.',
    backLayout: 'Teal surge back treatment with crisp modular blocks.',
    notes: 'Sharper and cleaner than a generic blue foil.',
  },
  'Red Magma': {
    family: 'prizm',
    palette: 'molten red, lava orange, and black basalt',
    foil: 'magma crack foil',
    pattern: 'molten fissures and hot-rock fracture texture',
    border: 'red volcanic border',
    frontLayout: 'A deep lava-core look with fractured heat under the gloss.',
    backLayout: 'Magma-streak stats panel and strong contrast on the back.',
    notes: 'The foil should feel heavy and dangerous.',
  },
  'Black Shattered': {
    family: 'obsidian',
    palette: 'jet black, smoke gray, and prismatic shards',
    foil: 'shattered-glass prism foil',
    pattern: 'broken-glass overlay with prismatic fractures',
    border: 'black mirrored edge with sharp shard highlights',
    frontLayout: 'Dark premium void with fractured rainbow shards across the face.',
    backLayout: 'Black fractured back with prismatic separators.',
    notes: 'This is the high-end dark parallel: hard contrast, not muddy gray.',
  },
  'White Rainbow': {
    family: 'chrome',
    palette: 'white opal, pearl, and full-spectrum rainbow',
    foil: 'white rainbow refraction',
    pattern: 'opal sheen with broad rainbow scatter',
    border: 'white metallic border with prismatic bloom',
    frontLayout: 'Bright white premium stock with a broad rainbow refractive layer.',
    backLayout: 'White-opal back with clean iridescent contrast.',
    notes: 'Keep the white surface luminous rather than flat paper-white.',
  },
  Acetate: {
    family: 'acetate',
    palette: 'clear, pearl, and faint spectrum highlights',
    foil: 'transparent layered gloss',
    pattern: 'see-through layering with subtle edge glow',
    border: 'clear frame with soft luminous edges',
    frontLayout: 'Transparent-layer treatment with airy depth and a floating subject.',
    backLayout: 'Back design should stay crisp through the clear stock.',
    notes: 'Used for clear or acetate-style card treatments.',
  },
  'Gold Superfractor': {
    family: 'superfractor',
    palette: 'full-spectrum rainbow over gold',
    foil: 'superfractor full-rainbow foil',
    pattern: 'maximal rainbow refraction with a gold core',
    border: 'golden rainbow border',
    frontLayout: 'Ultimate 1/1 energy with the entire card surface bending light.',
    backLayout: 'A 1/1 back with unmistakable superfractor prestige.',
    notes: 'The visual should scream one-of-one from across the room.',
  },
  'Black Infinite': {
    family: 'obsidian',
    palette: 'black on black with deep silver microglints',
    foil: 'infinite-depth black laser etch',
    pattern: 'near-monochrome depth with subtle specular cuts',
    border: 'dark mirror border',
    frontLayout: 'Black-on-black luxury with extremely restrained highlights.',
    backLayout: 'Minimal black back with a tiny, sharp serial and elegant text blocks.',
    notes: 'Use depth and restraint; it should feel nearly void-like.',
  },
  'Printing Plate': {
    family: 'plate',
    palette: 'cyan, magenta, yellow, or key black metal',
    foil: 'industrial print-plate sheen',
    pattern: 'machined plate texture and process marks',
    border: 'factory-metal border with plate cues',
    frontLayout: 'Actual printing plate aesthetic, metallic and process-driven.',
    backLayout: 'Back should look like part of the print process, not a decorative parallel.',
    notes: 'Treat as factory hardware, not a standard foil card.',
  },
  'Sepia Refractor': {
    family: 'chrome',
    palette: 'sepia, bronze, warm chrome, and cream',
    foil: 'sepia-toned refractor',
    pattern: 'warm vintage chrome with subtle rainbow flicker',
    border: 'brown-gold chrome border',
    frontLayout: 'Vintage-toned refractor with a nostalgic monochrome warmth.',
    backLayout: 'Sepia chrome back with polished classic-card cues.',
    notes: 'The finish should feel aged and premium at the same time.',
  },
  'X-Fractor': {
    family: 'chrome',
    palette: 'silver, white, and blue-gray',
    foil: 'crosshatch refractor',
    pattern: 'diagonal X-grid hatch across the card face',
    border: 'X-grid chrome border',
    frontLayout: 'Classic X-Fractor geometry with repeating crosshatch texture.',
    backLayout: 'Back uses the same hatch language but stays readable.',
    notes: 'The texture should be obviously patterned, not just shiny.',
  },
  'Negative Refractor': {
    family: 'chrome',
    palette: 'inverted blacks, whites, and spectral tint',
    foil: 'negative-image refractor',
    pattern: 'inverted tonality with a stark reverse-color treatment',
    border: 'reverse-contrast border',
    frontLayout: 'Inverted visual treatment, like a photographic negative on chrome stock.',
    backLayout: 'Reverse-contrast back with the same inverted logic.',
    notes: 'Feels experimental and slightly eerie.',
  },
  'Prism Refractor': {
    family: 'prizm',
    palette: 'prismatic silver, blue, green, and violet',
    foil: 'classic prism foil',
    pattern: 'faceted prism shards and angular light breaks',
    border: 'prism-slice border',
    frontLayout: 'Faceted prism look with strong angular reflections.',
    backLayout: 'Prism facets frame the stats and title panel.',
    notes: 'A clean prism treatment rather than a noisy rainbow wash.',
  },
  RayWave: {
    family: 'chrome',
    palette: 'silver, neon blue, and violet wave tones',
    foil: 'ray-wave foil',
    pattern: 'radiating wave arcs and beam streaks',
    border: 'wave-ring border',
    frontLayout: 'Wave-radiant foil with beams that fan outward from the subject.',
    backLayout: 'Wave arcs create motion around the data blocks.',
    notes: 'The waves should read as directional energy.',
  },
  Logofractor: {
    family: 'chrome',
    palette: 'team logos, chrome, and bright accent colors',
    foil: 'logo scatter foil',
    pattern: 'small repeated logo treatment across the frame',
    border: 'logo-dense chrome border',
    frontLayout: 'Card face filled with repeating micro-logos and a premium chrome center.',
    backLayout: 'Logo scatter should stay on the back border and not overwhelm the stats.',
    notes: 'Think branded texture rather than a giant logo block.',
  },
  Geometric: {
    family: 'chrome',
    palette: 'silver, black, cyan, and structured accent colors',
    foil: 'geometric foil lattice',
    pattern: 'polygon facets and angular color planes',
    border: 'structured geometric frame',
    frontLayout: 'Faceted, architectural foil with sharp polygon planes.',
    backLayout: 'Geometry carries into the back as a disciplined grid.',
    notes: 'Sharp, modern, and architectural.',
  },
  'Silver Prizm': {
    family: 'prizm',
    palette: 'silver, pearl, and faint rainbow',
    foil: 'classic silver prizm',
    pattern: 'high-gloss refractor with subtle prismatic depth',
    border: 'silver prizm border',
    frontLayout: 'The canonical Prizm look: glossy, clean, and highly reflective.',
    backLayout: 'Clean silver back treatment with strong hierarchy.',
    notes: 'The classic rainbow chrome chase look.',
  },
  'Hyper Prizm': {
    family: 'prizm',
    palette: 'silver, steel, and diagonal white highlights',
    foil: 'diagonal hyper foil',
    pattern: 'crisscross diagonal pattern',
    border: 'hyper-grid border',
    frontLayout: 'Diagonal crisscross texture with a kinetic, hyperactive surface.',
    backLayout: 'Same crisscross logic but toned down for readability.',
    notes: 'The diagonal pattern should be immediately visible.',
  },
  'Ice Prizm': {
    family: 'prizm',
    palette: 'icy white, aqua, and pale silver',
    foil: 'ice prizm frost',
    pattern: 'cold crystalline sparkle with frost haze',
    border: 'icy glass border',
    frontLayout: 'Frozen sparkle with a frosty surface and cold specular points.',
    backLayout: 'Frosted back accents and a clean, chilly panel system.',
    notes: 'The surface should feel hard and chilled.',
  },
  'Disco Prizm': {
    family: 'prizm',
    palette: 'silver, mirror, and saturated club colors',
    foil: 'disco dot foil',
    pattern: 'bubbly disco dots and sparkling reflections',
    border: 'club-light border',
    frontLayout: 'Dance-floor sparkle with bright dots and a glossy mirror effect.',
    backLayout: 'Disco foil continues around the stats without drowning the text.',
    notes: 'Bright, fun, and immediately recognizable as disco.',
  },
  'Mojo': {
    family: 'prizm',
    palette: 'swirling multicolor accents over silver',
    foil: 'mojo wave foil',
    pattern: 'undulating swirling channels',
    border: 'mojo swirl border',
    frontLayout: 'Energetic swirl pattern that feels alive across the full surface.',
    backLayout: 'Mojo swirls along the rails with clean center data blocks.',
    notes: 'The foil should feel playful and kinetic.',
  },
  'Pink Pulsar': {
    family: 'prizm',
    palette: 'pink, fuchsia, and white starburst',
    foil: 'pulsar burst foil',
    pattern: 'bright pulsar rings and starburst light',
    border: 'pink pulsar border',
    frontLayout: 'Pulsing pink starburst treatment with clean radiating motion.',
    backLayout: 'Pink pulsar lines orbit the stats and flavor panel.',
    notes: 'This is a high-energy retail-exclusive style.',
  },
  'Gold Vinyl': {
    family: 'gilded',
    palette: 'metallic gold and dark contrast',
    foil: 'gold vinyl mirror foil',
    pattern: 'hard-edged vinyl shine with gold opacity',
    border: 'gold vinyl border',
    frontLayout: 'Hard gold mirror treatment with premium vinyl-like punch.',
    backLayout: 'Gold vinyl back with elegant but aggressive shine.',
    notes: 'Should feel like the loudest gold chase in the room.',
  },
  Zebra: {
    family: 'pattern',
    palette: 'black and white zebra stripes',
    foil: 'striped animal foil',
    pattern: 'bold zebra striping',
    border: 'high-contrast stripe border',
    frontLayout: 'Animal-print zebra treatment used as the defining texture.',
    backLayout: 'Stripes should frame the back without overpowering the text.',
    notes: 'Use strong black-and-white striping, not a subtle pattern.',
  },
  'Tiger Stripe': {
    family: 'pattern',
    palette: 'amber, black, and burnished orange',
    foil: 'tiger stripe foil',
    pattern: 'wide tiger stripes with aggressive contrast',
    border: 'striped safari border',
    frontLayout: 'Predatory tiger-striping across the foil surface.',
    backLayout: 'Stripes stay to the edge rails so the back is still readable.',
    notes: 'A loud striped chase look with warm metallic energy.',
  },
  Snakeskin: {
    family: 'pattern',
    palette: 'desert tan, olive, brown, and black',
    foil: 'snakeskin texture foil',
    pattern: 'scaled reptile texture',
    border: 'scaled border',
    frontLayout: 'Scaled reptile texture with a premium serpent-skin feel.',
    backLayout: 'Snakeskin texture recedes into the rails on the back.',
    notes: 'Should read like actual scales rather than random dots.',
  },
  Obsidian: {
    family: 'obsidian',
    palette: 'black glass, dark violet, and electric teal',
    foil: 'etched void foil',
    pattern: 'dark cosmic etching with subtle nebula glow',
    border: 'black crystal border',
    frontLayout: 'Black-stock premium design with electric etched lines and void-like depth.',
    backLayout: 'Dark back with luminous micro-details and sparse text blocks.',
    notes: 'Lean into darkness, depth, and edge-lighting.',
  },
  ColorBlast: {
    family: 'promo',
    palette: 'explosive full-spectrum color',
    foil: 'burst-color foil',
    pattern: 'saturated rainbow burst',
    border: 'radial burst border',
    frontLayout: 'Explosive color-blast treatment with maximal saturation and strong contrast.',
    backLayout: 'Back uses a bright but still clean burst ring around the data.',
    notes: 'Think statement insert, not subtle parallel.',
  },
};

const TYPE_PROFILES = {
  Base: {
    layout: 'Standard base-card architecture with a large hero frame, a clear title zone, and a modest stat footer.',
    frontNotes: 'Treat as the clean default card class.',
    backNotes: 'Use the classic stats back and keep it highly readable.',
  },
  Variation: {
    layout: 'Alternate-art structure using the same card identity but a different pose, lighting angle, or crop.',
    frontNotes: 'The art should feel like an alternate print variation of the same card.',
    backNotes: 'Flag the alternate-art nature on the back with a subtle variation callout.',
  },
  Autograph: {
    layout: 'Autograph panel or signature strip in the lower third or along the card edge, depending on format.',
    frontNotes: 'Reserve a clean signature zone and make the autograph feel premium.',
    backNotes: 'Add a small auto callout on the back if the card is shown from behind.',
  },
  'Sticker Auto': {
    layout: 'Sticker-applied signature treatment with a slightly raised label look.',
    frontNotes: 'The signature should look applied rather than inked directly into the card art.',
    backNotes: 'Highlight the sticker application and keep the card surface clean.',
  },
  Relic: {
    layout: 'Memorabilia window, swatch cutout, or embedded material panel in the lower-right or center-right zone.',
    frontNotes: 'Make the relic window feel physically embedded in the card stock.',
    backNotes: 'Show the relic callout and let the material read as a real swatch or embedded fragment.',
  },
  'Dual Auto': {
    layout: 'Two signature zones balanced across the lower half or split symmetrically across the card.',
    frontNotes: 'The two signatures should be clearly distinct and well-spaced.',
    backNotes: 'Call out the dual-autograph nature on the back.',
  },
  'Auto Patch': {
    layout: 'Signature zone paired with a premium patch window or relic block.',
    frontNotes: 'Keep the signature and patch readable as separate premium features.',
    backNotes: 'Back should sell the auto-plus-relic combination as the headline.',
  },
  Booklet: {
    layout: 'Foldout two-panel or three-panel premium booklet with a visible hinge line and story-reveal structure.',
    frontNotes: 'Respect the fold line and compose the design as a premium booklet spread.',
    backNotes: 'Show the inside booklet logic rather than a flat single-card layout.',
  },
  'Error Variant': {
    layout: 'Intentional print anomaly: off-register elements, miscut border, swapped colors, or wrong data.',
    frontNotes: 'The error should feel collectible and clearly deliberate in the prompt.',
    backNotes: 'Back can echo the same mistake language in a restrained way.',
  },
  Novelty: {
    layout: 'Standard novelty shell that should be refined by a dedicated novelty subtype.',
    frontNotes: 'Use the novelty subtree to define the actual gag framing.',
    backNotes: 'Use the novelty subtree to define the actual reverse treatment.',
  },
};

const CONDITION_PROFILES = {
  raw: {
    label: 'Ungraded raw card',
    presentation: 'show the card unencased, with no slab and no magnetic holder',
    notes: 'This is a raw card presentation. Keep the surface visible and do not wrap it in a case.',
  },
  graded: {
    label: 'Graded slab',
    presentation: 'show the card sealed inside a clear magnetic slab case with a crisp grade label',
    notes: 'Only graded cards go in a magnetic case. The slab should feel premium, clean, and tamper-resistant.',
  },
};

const SERIALIZATION_PROFILES = {
  etched: {
    label: 'Etched serial',
    presentation: 'etch the serial number into the card or into a thin metallic nameplate using a credit-card style font',
    notes: 'Topps-style numbering: small, elegant, and physically embedded rather than stickered.',
  },
  sticker: {
    label: 'Hologram sticker',
    presentation: 'place a hologram security sticker near the serial or signature area',
    notes: 'Use a visible foil security sticker instead of a direct etched serial.',
  },
  foil: {
    label: 'Foil stamp',
    presentation: 'use a foil-stamped number or badge with bright reflective ink',
    notes: 'Best for Panini-style or premium insert treatment where the serial is clearly printed as part of the foil language.',
  },
  plate: {
    label: 'Printing plate',
    presentation: 'represent the card as an actual printing plate with machine marks and plate-metal texture',
    notes: 'This should read like factory tooling, not a decorative sticker.',
  },
};

function inferFormatProfile(card) {
  const raw = clean(card.cardFormat || card.format || card.layout || 'standard').toLowerCase();
  return FORMAT_PROFILES[raw] || FORMAT_PROFILES.standard;
}

function inferVariantProfile(card, set) {
  const raw = clean(card.parallel || card.variant || card.parallelName || 'Base');
  if (isBakedPromptSet(set)) {
    return finalizeVariantProfile({
      name: 'Baked Design',
      family: 'baked',
      palette: 'set-specific baked artwork palette',
      foil: 'source-prompt-defined finish',
      pattern: 'card-specific design language already baked into the image prompt',
      border: 'use the exact border language from the source prompt',
      frontLayout: 'Preserve the baked front design encoded in the source prompt.',
      backLayout: 'Preserve the baked back design encoded in the source prompt.',
      notes: 'This set should not be forced into a generic variant taxonomy. Use the card-specific baked design language from the prompt source.',
    }, set);
  }
  if (VARIANT_PROFILES[raw]) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES[raw] }, set);
  }

  const lower = raw.toLowerCase();
  if (/superfractor/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES['Gold Superfractor'] }, set);
  }
  if (/black infinite/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES['Black Infinite'] }, set);
  }
  if (/printing plate|plate/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES['Printing Plate'] }, set);
  }
  if (/color blast|colorblast/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.ColorBlast }, set);
  }
  if (/chrome|refractor|sapphire/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.Chrome }, set);
  }
  if (/prizm|mojo|disco|hyper|ice|pulsar/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES['Silver Prizm'] }, set);
  }
  if (/obsidian|black|infinite|magma/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.Obsidian }, set);
  }
  if (/gold|gilded|vinyl/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.Gold }, set);
  }
  if (/acetate|clear/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.Acetate }, set);
  }
  if (/zebra|tiger|snake/.test(lower)) {
    return finalizeVariantProfile({ name: raw, ...VARIANT_PROFILES.Zebra }, set);
  }

  return finalizeVariantProfile({
    name: raw,
    ...VARIANT_PROFILES.Base,
    notes: `Fallback variant profile for ${raw}. Keep the look disciplined and collectible.`,
  }, set);
}

function inferTypeProfile(card, formatProfile) {
  const raw = clean(card.cardTypeName || card.special || card.type || '');
  if (TYPE_PROFILES[raw]) {
    return { name: raw, ...TYPE_PROFILES[raw] };
  }

  if (formatProfile.name === 'Booklet') {
    return { name: 'Booklet', ...TYPE_PROFILES.Booklet };
  }
  if (formatProfile.name === 'Acetate') {
    return {
      name: 'Acetate',
      layout: 'Transparent-layer composition that uses the clear material as part of the visual reveal.',
      frontNotes: 'Let the background and foreground layers read through the clear stock.',
      backNotes: 'Keep the back crisp and readable through the acetate surface.',
    };
  }

  return { name: raw || 'Base', ...TYPE_PROFILES.Base };
}

function gradeLabel(card) {
  if (!card.graded) return 'Ungraded';
  if (card.gradeName) return clean(card.gradeName);
  if (typeof card.grade === 'number') return `PSA ${card.grade}`;
  return 'Graded';
}

function inferConditionProfile(card) {
  const graded = Boolean(card.graded || card.gradingResult);
  const hints = Array.isArray(card.quality?.hints) ? card.quality.hints.slice(0, 3) : [];
  return {
    key: graded ? 'graded' : 'raw',
    label: graded ? gradeLabel(card) : 'Ungraded raw card',
    presentation: graded
      ? `show the card sealed inside a clear magnetic slab case with a visible ${gradeLabel(card)} label`
      : 'show the card unencased, with no slab and no magnetic holder',
    notes: compact([
      graded ? 'Only graded cards go in a magnetic case.' : 'This card should appear raw and unencased.',
      hints.length ? `Visible condition cues: ${hints.join('; ')}` : '',
    ]),
  };
}

function serialTotalForParallel(parallel) {
  const raw = clean(parallel);
  const totals = {
    Gold: 2026,
    'Green Lava': 499,
    'Cyan Ice': 299,
    'Magenta Pulse': 199,
    'Orange Blaze': 99,
    'Teal Surge': 75,
    'Red Magma': 50,
    'Black Shattered': 25,
    'White Rainbow': 10,
    'Gold Superfractor': 1,
    'Black Infinite': 1,
    'Printing Plate': 1,
  };
  if (totals[raw]) return totals[raw];
  return null;
}

function inferSerializationProfile(card, variantProfile) {
  if (card.plate) {
    return {
      key: 'plate',
      label: 'Printing plate',
      serialText: '1/1',
      presentation: SERIALIZATION_PROFILES.plate.presentation,
      notes: SERIALIZATION_PROFILES.plate.notes,
      placement: 'treat the plate mark as factory hardware anchored near the lower edge',
    };
  }

  const serialText = clean(card.serStr || (card.sn && serialTotalForParallel(card.parallel) ? `#${card.sn}/${serialTotalForParallel(card.parallel)}` : ''));
  if (!serialText) {
    return {
      key: 'none',
      label: 'No visible serial',
      serialText: '',
      presentation: 'no visible serial number',
      notes: 'The card is not serialized. Keep the surface free of serial marks.',
      placement: 'none',
    };
  }

  const lowerType = clean(card.cardTypeName || card.special || '').toLowerCase();
  const lowerVariant = clean(card.parallel || '').toLowerCase();

  if (/sticker/.test(lowerType)) {
    return {
      key: 'sticker',
      label: 'Hologram sticker',
      serialText,
      presentation: SERIALIZATION_PROFILES.sticker.presentation,
      notes: SERIALIZATION_PROFILES.sticker.notes,
      placement: 'place the sticker near the lower back-right or signature area',
    };
  }

  if (/prizm|optic|obsidian|disco|mojo|hyper|ice|pulsar|foil|gold|sapphire/.test(lowerVariant)) {
    return {
      key: 'foil',
      label: 'Foil stamp',
      serialText,
      presentation: SERIALIZATION_PROFILES.foil.presentation,
      notes: SERIALIZATION_PROFILES.foil.notes,
      placement: 'print the serial cleanly along the upper rail or lower border in a bright foil badge',
    };
  }

  return {
    key: 'etched',
    label: 'Etched serial',
    serialText,
    presentation: SERIALIZATION_PROFILES.etched.presentation,
    notes: SERIALIZATION_PROFILES.etched.notes,
    placement: 'etch the number into the card face or lower rail using a credit-card style font',
  };
}

function getCategorySubject(card, set) {
  const category = clean(set?.setCategory || set?.category || 'character').toLowerCase();
  if (card.imagePrompt) return clean(card.imagePrompt);

  if (category === 'sports') {
    const parts = [
      `${clean(card.name)} in a premium action portrait`,
      card.team ? `team colors ${clean(card.team)}` : '',
      card.position ? `position ${clean(card.position)}` : '',
      card.jerseyNumber ? `jersey #${card.jerseyNumber}` : '',
    ];
    return compact(parts);
  }

  if (category === 'celebrity') {
    return compact([
      `${clean(card.name)} in a polished celebrity trading card portrait`,
      card.profession ? clean(card.profession) : '',
      card.era ? clean(card.era) : '',
    ]);
  }

  if (category === 'movie' || category === 'tv') {
    return compact([
      card.sceneTitle || card.name,
      card.sceneDescription || card.desc,
      card.chapter ? `chapter ${card.chapter}` : '',
      card.season ? `season ${card.season}` : '',
    ]);
  }

  if (category === 'collection') {
    return compact([
      `${clean(card.name)} specimen card`,
      card.classification ? clean(card.classification) : '',
      card.origin ? clean(card.origin) : '',
      card.rarity ? clean(card.rarity) : '',
    ]);
  }

  if (category === 'novelty') {
    return compact([
      `${clean(card.name)} novelty insert`,
      card.noveltyCategory ? clean(card.noveltyCategory) : '',
      card.desc ? clean(card.desc) : '',
    ]);
  }

  return compact([
    clean(card.name),
    card.desc ? clean(card.desc) : '',
  ]);
}

function buildTextBlocks(card, set, side, typeProfile, variantProfile, tradeDressProfile, noveltyProfile, conditionProfile, serializationProfile) {
  const blocks = [];
  const serialLabel = serializationProfile.serialText || 'none';
  const grade = conditionProfile.label;
  const category = clean(set?.setCategory || set?.category || 'character');

  if (side === 'front') {
    blocks.push({ zone: 'title', text: clean(card.name), note: 'Main card nameplate' });
    blocks.push({ zone: 'badge', text: `${clean(set?.name || set?.code || '')} ${clean(card.num || card.cardNum || '')}`.trim(), note: 'Set and card identifier' });
    if (serialLabel !== 'none') blocks.push({ zone: 'serial', text: serialLabel, note: serializationProfile.presentation });
    blocks.push({ zone: 'variant', text: variantProfile.name, note: variantProfile.notes });
    blocks.push({ zone: 'trade-dress', text: tradeDressProfile.name, note: `${tradeDressProfile.identity}; ${tradeDressProfile.logoPlacement}` });
    if (noveltyProfile.isNoveltyCard) blocks.push({ zone: 'novelty', text: noveltyProfile.subtype, note: noveltyProfile.frontRule });
    if (card.imagePromptBackFlavor) blocks.push({ zone: 'flavor', text: clean(card.imagePromptBackFlavor), note: 'Back flavor preview' });
  } else {
    blocks.push({ zone: 'title', text: clean(card.name), note: 'Back title strip' });
    blocks.push({ zone: 'stats', text: formatStats(card), note: 'Stats panel' });
    if (card.imagePromptBackFlavor) blocks.push({ zone: 'flavor', text: clean(card.imagePromptBackFlavor), note: 'Back flavor text' });
    if (serialLabel !== 'none') blocks.push({ zone: 'serial', text: serialLabel, note: serializationProfile.presentation });
    blocks.push({ zone: 'category', text: category, note: 'Card category line' });
    blocks.push({ zone: 'trade-dress', text: tradeDressProfile.backFrame, note: `${tradeDressProfile.identity}; ${tradeDressProfile.logoPlacement}` });
    if (noveltyProfile.isNoveltyCard) blocks.push({ zone: 'novelty', text: noveltyProfile.backRole, note: noveltyProfile.backRule });
  }

  if (typeProfile.name && typeProfile.name !== 'Base') {
    blocks.push({ zone: 'type', text: typeProfile.name, note: typeProfile.layout });
  }

  if (conditionProfile.key === 'graded') {
    blocks.push({ zone: 'grade', text: grade, note: conditionProfile.notes });
  }

  return blocks;
}

function formatStats(card) {
  const stats = card.stats || {};
  const keys = [
    ['power', 'POW'],
    ['speed', 'SPD'],
    ['technique', 'TEC'],
    ['endurance', 'END'],
    ['charisma', 'CHR'],
  ];
  const values = keys.map(([key, abbr]) => {
    if (typeof stats[key] === 'number') return `${abbr} ${Math.round(stats[key])}`;
    return null;
  }).filter(Boolean);
  return values.length ? values.join('  ') : 'stats unavailable';
}

function buildGeneralSegment({ side, set, card, variantProfile, formatProfile, tradeDressProfile, noveltyProfile }) {
  return compact([
    'Generate a real Topps-style premium collectible trading card render with a centered portrait card layout, a clear title bar, a set logo or wordmark, and a readable stats back.',
    'This is a trading-card product, not a poster, magazine spread, or generic illustration.',
    `Side: ${side}.`,
    `Set: ${clean(set?.name || set?.code || 'unknown set')}.`,
    'Keep the composition print-ready, legible, and centered inside the requested card ratio.',
    `Respect the ${formatProfile.ratio} layout and the card-safe text zones.`,
    `Set trade dress: ${tradeDressProfile.name}.`,
    `Trade dress mode for this card: ${variantProfile.tradeDressMode || 'carry'}.`,
    `Use a ${variantProfile.family} card finish with controlled reflections, premium print materials, and a clear Topps trading-card structure.`,
    noveltyProfile.isNoveltyCard ? `Novelty subtype: ${noveltyProfile.subtype}.` : '',
    'Avoid poster composition, wallpaper composition, magazine spread layouts, random extra subjects, warped logos, and illegible typography.',
  ]);
}

function buildBaseSegment({ side, set, card, formatProfile, variantProfile, tradeDressProfile }) {
  const tradeDressMode = clean(variantProfile.tradeDressMode || 'carry');
  const setRule =
    tradeDressMode === 'break'
      ? 'High-end variant may override the standard set dress with a chase-card frame.'
      : tradeDressProfile.baseRule;
  return compact([
    summaryLine('Card', `${clean(card.num || card.cardNum || '')} ${clean(card.name || 'Untitled Card')}`),
    summaryLine('Set', clean(set?.name || set?.code || 'character')),
    summaryLine('Card ratio', formatProfile.ratio),
    summaryLine('Front layout', formatProfile.frontLayout),
    summaryLine('Back layout', formatProfile.backLayout),
    summaryLine('Set identity', tradeDressProfile.identity),
    summaryLine('Logo standard', tradeDressProfile.logoStyle),
    summaryLine('Logo placement', tradeDressProfile.logoPlacement),
    summaryLine('Set border', tradeDressProfile.border),
    summaryLine('Nameplate', tradeDressProfile.nameplate),
    summaryLine('Frame language', variantProfile.border),
    summaryLine('Set rule', setRule),
    tradeDressMode === 'break' ? summaryLine('Variant override', 'Let the premium frame overtake the base dress if the chase parallel calls for it.') : summaryLine('Variant override', tradeDressProfile.variantRule),
    summaryLine('Placement', side === 'front' ? formatProfile.frontLayout : formatProfile.backLayout),
  ]);
}

function buildTradeDressSegment(tradeDressProfile, variantProfile, side) {
  const mode = clean(variantProfile.tradeDressMode || 'carry');
  const modeNotes = {
    carry: 'Carry the shared set identity through the card face and keep the base frame visible.',
    accent: 'Keep the shared set structure but let the finish and texture accent the rails.',
    break: 'Break the standard set dress and replace it with a premium chase-card frame.',
    baked: 'Follow the baked set-specific layout from the source prompt and do not normalize it into a generic set frame.',
  };

  return compact([
    summaryLine('Set trade dress', tradeDressProfile.name),
    summaryLine('Set identity', tradeDressProfile.identity),
    summaryLine('Logo standard', tradeDressProfile.logoStyle),
    summaryLine('Logo placement', tradeDressProfile.logoPlacement),
    summaryLine('Border', tradeDressProfile.border),
    summaryLine('Nameplate', tradeDressProfile.nameplate),
    summaryLine('Back frame', tradeDressProfile.backFrame),
    summaryLine('Watermark', tradeDressProfile.watermark),
    summaryLine('Motif', tradeDressProfile.motif),
    summaryLine('Accent palette', tradeDressProfile.accentPalette),
    summaryLine('Base rule', tradeDressProfile.baseRule),
    summaryLine('Variant rule', tradeDressProfile.variantRule),
    summaryLine('Premium rule', tradeDressProfile.premiumRule),
    summaryLine('Logo rule', tradeDressProfile.logoRule),
    summaryLine('Card mode', `${mode}: ${modeNotes[mode] || modeNotes.carry}`),
    summaryLine('Side cue', side === 'front' ? 'Front should surface the set identity first.' : 'Back should reuse the set identity through the stats and flavor layout.'),
  ]);
}

function buildVariantSegment(variantProfile, tradeDressProfile) {
  if (variantProfile.family === 'baked') {
    return compact([
      summaryLine('Design mode', 'Baked card-specific art direction'),
      summaryLine('Rule', 'Do not map this card into a generic parallel taxonomy'),
      summaryLine('Front/back cue', 'Use the exact baked visual language from the source prompt'),
      summaryLine('Set identity', tradeDressProfile.name),
      summaryLine('Notes', variantProfile.notes),
    ]);
  }
  return compact([
    summaryLine('Variant name', variantProfile.name),
    summaryLine('Variant family', variantProfile.family),
    summaryLine('Foil treatment', variantProfile.foil),
    summaryLine('Surface pattern', variantProfile.pattern),
    summaryLine('Palette', variantProfile.palette),
    summaryLine('Trade dress mode', variantProfile.tradeDressMode || 'carry'),
    summaryLine('Notes', variantProfile.notes),
  ]);
}

function buildTypeSegment(typeProfile, noveltyProfile) {
  return compact([
    summaryLine('Card type', typeProfile.name),
    summaryLine('Layout', typeProfile.layout),
    summaryLine('Front note', typeProfile.frontNotes),
    summaryLine('Back note', typeProfile.backNotes),
    noveltyProfile.isNoveltyCard ? summaryLine('Novelty linkage', noveltyProfile.subtype) : '',
  ]);
}

function buildNoveltySegment(noveltyProfile) {
  if (!noveltyProfile.isNoveltyCard) return '';
  return compact([
    summaryLine('Novelty subtype', noveltyProfile.subtype),
    summaryLine('Layout', noveltyProfile.layout),
    summaryLine('Packaging', noveltyProfile.packaging),
    summaryLine('Copy tone', noveltyProfile.copyTone),
    summaryLine('Visual device', noveltyProfile.visualDevice),
    summaryLine('Front rule', noveltyProfile.frontRule),
    summaryLine('Back rule', noveltyProfile.backRule),
    summaryLine('Back role', noveltyProfile.backRole),
    summaryLine('Notes', noveltyProfile.notes),
  ]);
}

function buildPhysicalSegment(formatProfile, conditionProfile, serializationProfile) {
  return compact([
    summaryLine('Physical properties', formatProfile.physical),
    summaryLine('Condition', conditionProfile.presentation),
    summaryLine('Condition note', conditionProfile.notes),
    summaryLine('Serialization', serializationProfile.presentation),
    summaryLine('Serialization note', serializationProfile.notes),
    summaryLine('Placement', serializationProfile.placement),
  ]);
}

function buildImageSegment(card, set, side, tradeDressProfile, variantProfile, noveltyProfile) {
  if (side === 'back') {
    const lines = [card.imagePromptBack || ''];
    if (!card.imagePromptBack && card.stats) lines.push(`Stats: ${formatStats(card)}`);
    if (card.imagePromptBackFlavor) lines.push(`Flavor text: ${clean(card.imagePromptBackFlavor)}`);
    if (card.desc) lines.push(`Narrative context: ${clean(card.desc)}`);
    if (noveltyProfile.isNoveltyCard) {
      lines.push(`Novelty treatment: ${noveltyProfile.backRole}`);
      lines.push(`Novelty rule: ${noveltyProfile.backRule}`);
    }
    if (variantProfile.tradeDressMode === 'break') {
      lines.push(`High-end variant rule: break the standard set dress and use a premium chase-card back frame.`);
    } else if (variantProfile.tradeDressMode === 'accent') {
      lines.push('Trade dress rule: preserve the set back frame, nameplate, and watermark while allowing the finish to accent the rails.');
    } else if (variantProfile.tradeDressMode === 'baked') {
      lines.push(`Trade dress rule: preserve the baked back language exactly as encoded in the source prompt.`);
    } else {
      lines.push('Trade dress rule: carry the shared set back frame using the back frame, nameplate, and watermark.');
    }
    lines.push('Compose the back as a premium collectible back design with a readable stat panel, flavor banner, and serial/identifier rail.');
    return compact(lines);
  }

  const subject = getCategorySubject(card, set);
  const lines = [card.imagePrompt || ''];
  if (!card.imagePrompt) lines.push(subject);
  if (card.desc) lines.push(`Context: ${clean(card.desc)}`);
  if (noveltyProfile.isNoveltyCard) {
    lines.push(`Novelty treatment: ${noveltyProfile.visualDevice}`);
    lines.push(`Novelty rule: ${noveltyProfile.frontRule}`);
  }
  if (variantProfile.tradeDressMode === 'break') {
    lines.push('Trade dress rule: the premium variant may break the base frame and replace it with a chase-card presentation.');
  } else if (variantProfile.tradeDressMode === 'accent') {
    lines.push('Trade dress rule: preserve the set logo or wordmark, border, and nameplate while accenting the finish.');
  } else if (variantProfile.tradeDressMode === 'baked') {
    lines.push('Trade dress rule: preserve the baked front design exactly as supplied by the source prompt.');
  } else {
    lines.push('Trade dress rule: carry the shared set identity using the set logo or wordmark, border, and nameplate.');
  }
  lines.push('Render the subject as the card front hero art with premium lighting, sharp focus, and clean text-safe zones.');
  return compact(lines);
}

function buildRenderPromptShort(card, set, side, formatProfile, variantProfile, tradeDressProfile, noveltyProfile, conditionProfile, serializationProfile) {
  const subject = clean(card.name || card.cardNum || 'the card');
  const parts = [
    `Topps Chrome-style collectible trading card, ${side}.`,
    formatProfile.ratio,
    side === 'front'
      ? `Single centered hero subject: ${subject}.`
      : `Readable stats panel and flavor banner for ${subject}.`,
    `Set emblem: ${tradeDressProfile.identity}.`,
    variantProfile.tradeDressMode === 'baked'
      ? 'Use the baked set-specific layout.'
      : `Use a ${variantProfile.family} finish with the ${variantProfile.tradeDressMode} trade-dress mode.`,
    side === 'front'
      ? 'Clean lower-third nameplate, crisp chrome border, realistic printed-card finish, tight card-safe crop.'
      : 'Crisp stats grid, serial rail, readable flavor text, realistic printed-card finish.',
    conditionProfile.key === 'graded'
      ? `Graded slab presentation: ${gradeLabel(card)}.`
      : 'Ungraded raw card, no slab.',
    serializationProfile.serialText
      ? `Serial: ${serializationProfile.serialText}.`
      : 'No visible serial.',
    noveltyProfile.isNoveltyCard ? `Novelty subtype: ${noveltyProfile.subtype}.` : '',
    'Crisp legible typography, no poster composition, no infographic layout, no extra UI motifs.',
  ];
  return compact(parts);
}

function buildRenderPromptDetailed(card, set, side, formatProfile, variantProfile, tradeDressProfile, noveltyProfile, typeProfile, conditionProfile, serializationProfile, imageSegment) {
  const subject = getCategorySubject(card, set);
  const parts = [
    `Topps-style premium collectible trading card render.`,
    `Side ${side} for ${clean(set?.name || set?.code || 'the set')} card ${clean(card.num || card.cardNum || '')} ${clean(card.name || 'Untitled Card')}.`,
    `Use the ${formatProfile.ratio} format with ${side === 'front' ? formatProfile.frontLayout : formatProfile.backLayout}.`,
    `Set identity: ${tradeDressProfile.identity}; logo placement: ${tradeDressProfile.logoPlacement}; border: ${tradeDressProfile.border}.`,
    `Type: ${typeProfile.name}; variant: ${variantProfile.name} (${variantProfile.family}); trade-dress mode: ${variantProfile.tradeDressMode || 'carry'}.`,
    `Condition: ${conditionProfile.presentation}.`,
    `Serialization: ${serializationProfile.presentation}.`,
    noveltyProfile.isNoveltyCard ? `Novelty: ${noveltyProfile.subtype}; front rule: ${noveltyProfile.frontRule}; back rule: ${noveltyProfile.backRule}.` : '',
    `Subject/context: ${subject}.`,
    imageSegment,
    'Keep the composition print-ready, legible, and tightly card-framed. Avoid poster, magazine spread, album cover, wallpaper, extra logos, and unreadable typography.',
  ];
  return compact(parts);
}

function buildNegativePrompt(side) {
  return compact([
    'no random extra logos',
    'no duplicate subjects',
    'no warped or unreadable typography',
    'no extra card frame beyond the requested card',
    'no watermarks',
    'no cropped hands or faces',
    side === 'back' ? 'no front-side hero composition on the back' : 'no back-side stats panel on the front',
  ]);
}

function buildPromptTextPrompt({ side, set, card, general, base, tradeDress, variant, type, physical, conditionProfile, serializationProfile, image, novelty }) {
  return general;
}

function buildPromptJsonPrompt({
  side,
  set,
  card,
  formatProfile,
  variantProfile,
  tradeDressProfile,
  noveltyProfile,
  serializationProfile,
  renderPromptShort,
}) {
  const promptObject = {
    product: 'Topps-style trading card product',
    side,
    set: {
      name: clean(set?.name || ''),
      category: clean(set?.setCategory || set?.category || 'character'),
      year: set?.year || null,
    },
    card: {
      num: clean(card.num || card.cardNum || ''),
      name: clean(card.name || ''),
      cardType: clean(card.cardTypeName || card.special || 'Base'),
      format: formatProfile.name,
      graded: Boolean(card.graded || card.gradingResult),
      grade: card.grade ?? null,
      gradeName: card.gradeName || null,
      serial: serializationProfile?.serialText || '',
    },
    prompt: renderPromptShort,
    artDirection: {
      ratio: formatProfile.ratio,
      tradeDress: tradeDressProfile.name,
      setIdentity: tradeDressProfile.identity,
      logoPlacement: tradeDressProfile.logoPlacement,
      border: tradeDressProfile.border,
      variant: {
        name: variantProfile.name,
        family: variantProfile.family,
        tradeDressMode: variantProfile.tradeDressMode || 'carry',
      },
      novelty: noveltyProfile.isNoveltyCard ? noveltyProfile.subtype : null,
    },
    renderRules: {
      centerComposition: true,
      preserveReadableTypography: true,
      useCardSafeZones: true,
      noPosterComposition: true,
      noExtraLogos: true,
      noWatermarks: true,
      setIdentityStyle: tradeDressProfile.identity,
      setLogoStyle: tradeDressProfile.logoStyle,
      setLogoPlacement: tradeDressProfile.logoPlacement,
    },
  };

  return JSON.stringify(promptObject, null, 2);
}

function buildPromptPayload(card, set, side, options = {}) {
  const formatProfile = inferFormatProfile(card);
  const tradeDressProfile = inferSetTradeDressProfile(set);
  const variantProfile = inferVariantProfile(card, set);
  const noveltyProfile = inferNoveltyProfile(card, set);
  const typeProfile = inferTypeProfile(card, formatProfile);
  const conditionProfile = inferConditionProfile(card);
  const serializationProfile = inferSerializationProfile(card, variantProfile);

  const general = buildGeneralSegment({ side, set, card, variantProfile, formatProfile, tradeDressProfile, noveltyProfile });
  const base = buildBaseSegment({ side, set, card, formatProfile, variantProfile, tradeDressProfile });
  const tradeDress = buildTradeDressSegment(tradeDressProfile, variantProfile, side);
  const variant = buildVariantSegment(variantProfile, tradeDressProfile);
  const type = buildTypeSegment(typeProfile, noveltyProfile);
  const novelty = buildNoveltySegment(noveltyProfile);
  const physical = buildPhysicalSegment(formatProfile, conditionProfile, serializationProfile);
  const image = buildImageSegment(card, set, side, tradeDressProfile, variantProfile, noveltyProfile);
  const renderPromptShort = buildRenderPromptShort(card, set, side, formatProfile, variantProfile, tradeDressProfile, noveltyProfile, conditionProfile, serializationProfile);
  const renderPromptDetailed = buildRenderPromptDetailed(card, set, side, formatProfile, variantProfile, tradeDressProfile, noveltyProfile, typeProfile, conditionProfile, serializationProfile, image);
  const promptFormat = clean(options.promptFormat || 'text').toLowerCase() === 'json' ? 'json' : 'text';

  const modules = {
    general,
    base,
    tradeDress,
    variant,
    type,
    novelty,
    physical,
    condition: conditionProfile.notes,
    serialization: serializationProfile.notes,
    image,
  };

  const promptText = buildPromptTextPrompt({
    side,
    set,
    card,
    general: renderPromptShort,
    base,
    tradeDress,
    variant,
    type,
    physical,
    conditionProfile,
    serializationProfile,
    image,
    novelty,
  });

  const prompt = promptFormat === 'json'
    ? buildPromptJsonPrompt({
        side,
        set,
        card,
        general,
        base,
        tradeDress,
        variant,
        type,
        physical,
        conditionProfile,
        serializationProfile,
        image,
        novelty,
        formatProfile,
        variantProfile,
        tradeDressProfile,
        noveltyProfile,
        renderPromptShort,
        renderPromptDetailed,
      })
    : promptText;

  const negativePrompt = buildNegativePrompt(side);

  const payload = {
    version: '1.0',
    side,
    set: {
      code: clean(set?.code || ''),
      name: clean(set?.name || ''),
      category: clean(set?.setCategory || set?.category || 'character'),
      year: set?.year || null,
    },
    card: {
      num: clean(card.num || card.cardNum || ''),
      name: clean(card.name || ''),
      subset: clean(card.subset || ''),
      starTier: clean(card.starTier || ''),
      parallel: clean(card.parallel || ''),
      cardType: clean(card.cardTypeName || card.special || 'Base'),
      format: formatProfile.name,
      graded: Boolean(card.graded || card.gradingResult),
      grade: card.grade ?? null,
      gradeName: card.gradeName || null,
      serial: serializationProfile.serialText || '',
    },
    modules,
    renderPromptShort,
    renderPromptDetailed,
    textBlocks: buildTextBlocks(card, set, side, typeProfile, variantProfile, tradeDressProfile, noveltyProfile, conditionProfile, serializationProfile),
    prompt: renderPromptShort,
    promptDetailed: renderPromptDetailed,
    promptFormat,
    negativePrompt,
    layout: {
      ratio: formatProfile.ratio,
      front: formatProfile.frontLayout,
      back: formatProfile.backLayout,
      tradeDress: tradeDressProfile.name,
    },
    promptMode: isBakedPromptSet(set) ? 'baked' : 'taxonomy',
    promptKind: promptFormat,
  };

  if (!novelty) {
    delete modules.novelty;
  }

  if (promptFormat === 'json') {
    payload.prompt = prompt;
  }

  if (options.includeSource !== false) {
    payload.source = {
      imagePrompt: clean(card.imagePrompt || ''),
      imagePromptBack: clean(card.imagePromptBack || ''),
      imagePromptBackFlavor: clean(card.imagePromptBackFlavor || ''),
    };
  }

  return payload;
}

function buildPromptBundle(card, set, side, options = {}) {
  if (side === 'both') {
    return {
      front: buildPromptPayload(card, set, 'front', options),
      back: buildPromptPayload(card, set, 'back', options),
    };
  }
  return buildPromptPayload(card, set, side, options);
}

function writePromptBundleToSet(set, bundleByCardNum) {
  const updated = JSON.parse(JSON.stringify(set));
  updated.cards = updated.cards.map((card) => {
    const bundle = bundleByCardNum.get(clean(card.num || card.cardNum || ''));
    if (!bundle) return card;

    if (bundle.front) {
      card.imagePrompt = bundle.front.prompt;
      card.imagePromptPayloadFront = bundle.front;
    }
    if (bundle.back) {
      card.imagePromptBack = bundle.back.prompt;
      card.imagePromptPayloadBack = bundle.back;
    }
    if (bundle.front || bundle.back) {
      card.imagePromptPayload = {
        front: bundle.front || null,
        back: bundle.back || null,
      };
    }
    return card;
  });
  return updated;
}

function selectCards(set, selector = {}) {
  const cards = Array.isArray(set.cards) ? set.cards : [];
  if (selector.card) {
    const target = clean(selector.card).padStart(3, '0');
    return cards.filter((card) => clean(card.num || card.cardNum || '') === target);
  }
  if (selector.cards && selector.cards.length) {
    const wanted = new Set(selector.cards.map((num) => clean(num).padStart(3, '0')));
    return cards.filter((card) => wanted.has(clean(card.num || card.cardNum || '')));
  }
  if (selector.range) {
    const [startRaw, endRaw] = selector.range;
    const start = parseInt(startRaw, 10);
    const end = parseInt(endRaw, 10);
    return cards.filter((card) => {
      const num = parseInt(card.num || card.cardNum || '0', 10);
      return num >= start && num <= end;
    });
  }
  return cards;
}

module.exports = {
  DATA_DIR,
  SETS_DIR,
  CONFIG_PATH,
  FORMAT_PROFILES,
  VARIANT_PROFILES,
  SET_TRADE_DRESS_PROFILES,
  NOVELTY_PROFILES,
  TYPE_PROFILES,
  CONDITION_PROFILES,
  SERIALIZATION_PROFILES,
  resolveSetPath,
  buildPromptPayload,
  buildPromptBundle,
  writePromptBundleToSet,
  selectCards,
  formatStats,
  inferVariantProfile,
  inferSetTradeDressProfile,
  inferNoveltyProfile,
  inferTypeProfile,
  inferConditionProfile,
  inferSerializationProfile,
  inferFormatProfile,
  tradeDressModeForVariant,
};
