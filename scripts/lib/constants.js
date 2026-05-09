#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const crypto=require('crypto');

// getDataDir() is called afresh each time — respects TRADING_CARDS_DATA_DIR set at runtime
const getDataDir=()=>process.env.TRADING_CARDS_DATA_DIR?path.resolve(process.env.TRADING_CARDS_DATA_DIR):path.join(__dirname,'..','..','data');

// ─── CARD FORMAT SYSTEM ──────────────────────────────────────────
const CARD_FORMATS={
  standard:  {name:'Standard (2.5×3.5)', mult:1,   rarityMod:1,   emoji:'🃏'},
  mini:      {name:'Mini (1.5×2.5)',     mult:0.6, rarityMod:1.3, emoji:'🎫'},
  landscape: {name:'Landscape (3.5×2.5)', mult:1.3, rarityMod:0.9, emoji:'🖼️'},
  booklet:   {name:'Booklet (4×6 open)', mult:2.5, rarityMod:0.5, emoji:'📖'},
  'die-cut': {name:'Die-Cut (custom)',   mult:1.8, rarityMod:0.7, emoji:'✂️'},
  oversized: {name:'Oversized (5×7)',    mult:3,   rarityMod:0.3, emoji:'📋'},
  acetate:   {name:'Acetate (clear)',    mult:2,   rarityMod:0.6, emoji:'💎'},
};

// ─── AUTO/RELIC COMPOSABLE MODIFIERS ────────────────────────────
const AUTO_TYPES=[
  {id:'on-card',  name:'On-Card',         mult:1,   emoji:'✍️'},
  {id:'sticker',  name:'Sticker Auto',    mult:0.7, emoji:'📌'},
  {id:'cut',      name:'Cut Signature',   mult:1.5, emoji:'✂️'},
  {id:'facsimile',name:'Facsimile Auto',  mult:0.3, emoji:'📝'},
];
const AUTO_VARIANTS=[
  {id:'single', name:'',           mult:1,  weight:60},
  {id:'dual',   name:'Dual ',      mult:2.2,weight:20},
  {id:'triple', name:'Triple ',    mult:4,  weight:5},
  {id:'quad',   name:'Quad ',      mult:7,  weight:1.5},
  {id:'multi',  name:'Multi ',     mult:5,  weight:3},
];
const RELIC_TYPES=[
  {id:'jersey',  name:'Jersey',     mult:1,   emoji:'👕'},
  {id:'patch',   name:'Patch',      mult:1.8, emoji:'🧩'},
  {id:'bat',     name:'Bat',        mult:1.2, emoji:'🏏'},
  {id:'ball',    name:'Ball',       mult:1.1, emoji:'⚽'},
  {id:'base',    name:'Base',       mult:1.3, emoji:'🏠'},
  {id:'coin',    name:'Coin',       mult:2,   emoji:'🪙'},
  {id:'medal',   name:'Medal',      mult:1.5, emoji:'🏅'},
  {id:'logoman', name:'Logoman',    mult:5,   emoji:'🏷️'},
];
const RELIC_QUALITY=[
  {id:'standard',    name:'',          mult:1},
  {id:'prime',       name:'Prime ',    mult:1.8},
  {id:'super-prime', name:'Super ',    mult:3.5},
  {id:'tag',         name:'Tag ',      mult:1.3},
  {id:'nameplate',   name:'Nameplate', mult:6},
];

// ─── RNG for compose functions ────────────────────────────────────
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let ENGINE_BASE_SEED=null;
let GLOBAL_RNG=()=>crypto.randomInt(0,0x100000000)/0x100000000;
function RNG(){return GLOBAL_RNG();}
function pwK(arr,k,rng){const t=arr.reduce((s,x)=>s+x[k],0);let r=rng()*t;for(const x of arr){r-=x[k];if(r<=0)return x}return arr[arr.length-1]}

// Build a composed auto name + price modifier
function composeAuto(){
  const type=pwK(AUTO_TYPES,'mult',RNG); // weighted toward lower mult
  const variant=pwK(AUTO_VARIANTS,'weight',RNG);
  return {name:variant.name+type.name, mult:type.mult*variant.mult, emoji:type.emoji+variant.name.replace(/ /g,'').slice(0,1),
    autoType:type.id, autoVariant:variant.id};
}
function composeRelic(){
  const type=pwK(RELIC_TYPES,'mult',RNG);
  const quality=pwK(RELIC_QUALITY,'mult',RNG);
  return {name:quality.name+type.name+' Relic', mult:type.mult*quality.mult, emoji:type.emoji,
    relicType:type.id, relicQuality:quality.id};
}

// ─── PACK CONFIG (loaded from data/pack-config.json) ──────────────
const PACK_CONFIG_PATH=path.join(__dirname,'..','..','data','pack-config.json');
let _PACK_CACHE=null;
let _PARALLEL_CACHE=null;

function loadPackConfig(forceReload=false){
  if(_PACK_CACHE&&!forceReload)return _PACK_CACHE;
  const raw=JSON.parse(fs.readFileSync(PACK_CONFIG_PATH,'utf8'));
  const packs={};
  for(const [key,cfg] of Object.entries(raw.packs)){
    packs[key]={
      name:cfg.name,
      packs:cfg.packsPerBox,
      cpp:cfg.cardsPerPack,
      price:cfg.price,
      hitRate:cfg.hitRate,
      slots:cfg.slots,
      parallels:cfg.parallels,
    };
  }
  _PACK_CACHE=packs;
  // Derive default parallels from the first pack type (retail)
  const firstKey=Object.keys(raw.packs)[0];
  if(firstKey&&raw.packs[firstKey].parallels){
    _PARALLEL_CACHE=raw.packs[firstKey].parallels.map(p=>({...p}));
  }
  return _PACK_CACHE;
}

function getDefaultParallels(){
  if(!_PARALLEL_CACHE)loadPackConfig();
  return _PARALLEL_CACHE;
}

// Backward-compat constants derived from pack config
const DEFAULT_PARALLELS=getDefaultParallels();
const PACKS=loadPackConfig();

// Alias for backward compat
const PARALLELS=DEFAULT_PARALLELS;

// ─── DEFAULT CARD TYPES (backward compat) ────────────────────────
const DEFAULT_CARD_TYPES=[
  {id:'variation',name:'Variation',rarity:0.35,priceMultiplier:1.5,format:'standard',desc:'🎨 Alt Art Variation'},
  {id:'novelty',name:'Novelty',rarity:0.20,priceMultiplier:1.2,format:'standard',desc:'🍕 Novelty/Food Issue'},
  {id:'relic',name:'Relic',rarity:0.20,priceMultiplier:4,format:'standard',desc:'🏅 Relic'},
  {id:'autograph',name:'Autograph',rarity:0.15,priceMultiplier:6,format:'standard',desc:'✍️ Autograph'},
  {id:'booklet',name:'Booklet',rarity:0.06,priceMultiplier:3,format:'booklet',desc:'📖 Booklet'},
  {id:'error',name:'Error Variant',rarity:0.025,priceMultiplier:2,format:'standard',desc:'❌ Error Variant'},
  {id:'dual-auto',name:'Dual Auto',rarity:0.012,priceMultiplier:12,format:'standard',desc:'✍️✍️ Dual Autograph'},
  {id:'auto-patch',name:'Auto Patch',rarity:0.003,priceMultiplier:18,format:'standard',desc:'✍️🏅 Auto Patch'},
];

// Backward compat alias
const SPECIALS=DEFAULT_CARD_TYPES.map(ct=>({name:ct.name,odds:ct.rarity*100,mult:ct.priceMultiplier,desc:ct.desc}));

// Resolve parallels for a set (custom or default)
function resolveParallels(set){return set&&set.parallels&&set.parallels.length?set.parallels:DEFAULT_PARALLELS}
// Resolve card types for a set (custom or default)
function resolveCardTypes(set){return set&&set.cardTypes&&set.cardTypes.length?set.cardTypes:DEFAULT_CARD_TYPES}
// Resolve inserts for a set
function resolveInserts(set){return set&&set.inserts||[]}

const TIERS=[
  {name:"Common",w:55,st:[40,75],pr:[0.10,0.30]},
  {name:"Uncommon",w:18,st:[50,80],pr:[0.30,0.75]},
  {name:"Star",w:14,st:[60,90],pr:[0.75,1.50]},
  {name:"Superstar",w:9,st:[70,95],pr:[1.50,3.00]},
  {name:"Legendary",w:4,st:[80,98],pr:[3.00,5.00]},
];
const SUBS=[{name:"Base",w:50,m:1},{name:"Rookie",w:20,m:1.3},{name:"Legend",w:8,m:1.5},{name:"AllStar",w:12,m:1.2},{name:"Flashback",w:10,m:1.1}];
const GRADES=[
  {grade:10,name:"PSA 10 Gem Mint", w:8,  mult:1.35},
  {grade:9, name:"PSA 9 Mint",       w:28, mult:1.15},
  {grade:8, name:"PSA 8 NM-MT",      w:32, mult:1.0},
  {grade:7, name:"PSA 7 NM",         w:17, mult:0.85},
  {grade:6, name:"PSA 6 EX-MT",      w:8,  mult:0.65},
  {grade:5, name:"PSA 5 EX",         w:4,  mult:0.50},
  {grade:4, name:"PSA 4 VG-EX",      w:1.5,mult:0.35},
  {grade:3, name:"PSA 3 VG",         w:1,  mult:0.25},
  {grade:2, name:"PSA 2 GD",         w:0.4,mult:0.15},
  {grade:1, name:"PSA 1 PR-FR",      w:0.1,mult:0.08},
];

// PSA grading tiers — cost depends on declared card value
const PSA_TIERS=[
  {name:"Value",        maxVal:500,   fee:28},
  {name:"Value Max",    maxVal:1000,  fee:60},
  {name:"Regular",      maxVal:2500,  fee:75},
  {name:"Express",      maxVal:5000,  fee:150},
  {name:"Super Express",maxVal:10000, fee:300},
  {name:"Walk Through", maxVal:Infinity, fee:600},
];
const PLATES=["Cyan","Magenta","Yellow","Black"];

// ─── GRADING ECONOMY ──────────────────────────────────────────────
const GRADING_DIR=path.join(getDataDir(),'grading');
const COMPANIES_FILE=path.join(GRADING_DIR,'companies.json');
const GRADING_STATE_FILE=path.join(GRADING_DIR,'state.json');
const POP_FILE=path.join(GRADING_DIR,'population.json');

// Display mappings
const TIER_EMOJI={Common:"",Uncommon:"🔶",Star:"⭐",Superstar:"🌟",Legendary:"👑"};
const TIER_COLOR={Common:"",Uncommon:"🟢",Star:"🔵",Superstar:"🟣",Legendary:"🟡"};
const PAR_EMOJI={Base:"",Chrome:"💎","Purple Shimmer":"💜","Blue Crackle":"🔷","Tie-Dye":"🌈","Pink Neon":"💗",
  "Gold":"🥇","Green Lava":"🟢","Cyan Ice":"🧊","Magenta Pulse":"🍓","Orange Blaze":"🔥","Teal Surge":"🌊",
  "Red Magma":"🌋","Black Shattered":"🖤","White Rainbow":"🌈","Gold Superfractor":"🏆","Black Infinite":"♾️","Printing Plate":"⚙️"};
const SUB_EMOJI={Base:"🃏",Rookie:"🔰",Legend:"📜",AllStar:"🏅",Flashback:"⏪"};
const FLOPPS_BULLETINS=[
  {id:'premium-alignment',title:'Premium Alignment Initiative',summary:'Flopps says its premium pricing now better reflects collector aspiration.',paraphrase:'They are raising prices and calling it alignment.',stockDelta:-0.05,weight:1.2},
  {id:'organizational-focus',title:'Organizational Focus Update',summary:'A small number of roles are being removed so the company can focus on growth.',paraphrase:'They are firing people and calling it focus.',stockDelta:-0.09,weight:1.1},
  {id:'allocation-recalibration',title:'Allocation Recalibration',summary:'Retailers will receive product in a more disciplined, highly selective way.',paraphrase:'They are cutting supply and pretending it is fairness.',stockDelta:-0.04,weight:1.0},
  {id:'collector-experience',title:'Collector Experience Enhancement',summary:'Flopps is lowering odds on certain chase items to improve long-term excitement.',paraphrase:'They lowered drop chances and called it excitement.',stockDelta:-0.06,weight:1.1},
  {id:'roadmap-clarity',title:'Roadmap Clarity Note',summary:'Management reaffirmed that more sets, more often, remains the operating norm.',paraphrase:'They are speeding up the release cycle.',stockDelta:0.03,weight:0.9},
  {id:'margin-discipline',title:'Margin Discipline Review',summary:'The company is reviewing every line for premium alignment and margin integrity.',paraphrase:'They are squeezing every last cent out of the hobby.',stockDelta:-0.03,weight:0.95},
  {id:'community-transparency',title:'Community Transparency Bulletin',summary:'Flopps assures collectors that all product decisions are made with them in mind.',paraphrase:'They are whitewashing a harder business decision.',stockDelta:-0.02,weight:0.85},
  {id:'warehouse-rationalization',title:'Warehouse Rationalization Program',summary:'Logistics will be consolidated to better support the modern collector journey.',paraphrase:'They are centralizing logistics to keep product tighter.',stockDelta:-0.04,weight:0.9},
  {id:'retail-partner-reset',title:'Retail Partner Reset',summary:'The company is asking partners to accept a leaner, more premium product mix.',paraphrase:'They are squeezing stores and calling it partnership.',stockDelta:-0.03,weight:0.9},
  {id:'investor-day',title:'Investor Day Preview',summary:'Leadership will explain why scarcity, velocity, and demand are all good news.',paraphrase:'They are prepping a Wall Street performance about greed.',stockDelta:0.07,weight:1.0},
  {id:'shareholder-letter',title:'Shareholder Letter',summary:'The board praised disciplined scarcity and the ongoing strength of the hobby economy.',paraphrase:'They are bragging about squeezing collectors for shareholders.',stockDelta:0.06,weight:1.0},
  {id:'buyback-window',title:'Share Repurchase Window',summary:'Flopps authorized a buyback of its own shares while leaving product tight.',paraphrase:'They are using money to prop up the ticker.',stockDelta:0.08,weight:0.8},
  {id:'anti-regulation',title:'Collector Choice Advocacy',summary:'The company expanded its advocacy efforts around collector freedom and market flexibility.',paraphrase:'They are lobbying against rules without saying the quiet part.',stockDelta:0.02,weight:0.85},
  {id:'trade-group',title:'Industry Participation Update',summary:'Flopps joined a coalition focused on growth, access, and responsible business clarity.',paraphrase:'They are funding generic dark-money style influence.',stockDelta:0.01,weight:0.85},
  {id:'pricing-study',title:'Pricing Study Results',summary:'Internal research suggests the audience remains extremely responsive to premium language.',paraphrase:'They learned collectors will pay more if you smile while asking.',stockDelta:-0.03,weight:0.95},
  {id:'odds-refinement',title:'Odds Refinement Notice',summary:'Hit ratios will be tuned for a better, more balanced collector arc.',paraphrase:'They are lowering hit rates and pretending it is balance.',stockDelta:-0.07,weight:1.15},
  {id:'shortage-lab',title:'Shortage Lab Launch',summary:'A new operations initiative will better match printed supply to collector demand.',paraphrase:'They are engineering scarcity on purpose.',stockDelta:-0.05,weight:1.0},
  {id:'price-hike',title:'Price Architecture Adjustment',summary:'MSRP will rise to reflect premium positioning across select product lines.',paraphrase:'They raised the price again and called it architecture.',stockDelta:-0.08,weight:1.15},
  {id:'line-optimization',title:'Product Line Optimization',summary:'Several legacy SKUs will be retired to make room for a sharper assortment.',paraphrase:'They are killing products that do not squeeze hard enough.',stockDelta:0.02,weight:0.9},
  {id:'support-automation',title:'Support Modernization Update',summary:'Customer support will be streamlined through a more efficient digital-first model.',paraphrase:'They are automating the complaints department.',stockDelta:-0.03,weight:0.85},
  {id:'launch-acceleration',title:'Launch Acceleration Notice',summary:'The next drop is moving up the calendar to meet collector appetite sooner.',paraphrase:'They moved the release earlier to keep people buying.',stockDelta:0.04,weight:0.95},
  {id:'chase-refresh',title:'Chase Architecture Refresh',summary:'High-end hits will receive a refreshed structure to better sustain engagement.',paraphrase:'They are changing the chases to keep the addiction loop fresh.',stockDelta:-0.04,weight:1.0},
  {id:'marketing-pivot',title:'Marketing Pivot Brief',summary:'Flopps is testing a warmer tone while preserving the same aggressive product stack.',paraphrase:'They are smiling harder while doing the same thing.',stockDelta:0.01,weight:0.8},
  {id:'compliance-note',title:'Compliance and Conduct Note',summary:'The company reminded employees that all public language should remain collector-positive.',paraphrase:'They told staff to keep the cruelty polite.',stockDelta:-0.01,weight:0.7},
  {id:'margin-expansion',title:'Margin Expansion Program',summary:'Leadership believes the hobby can support slightly higher prices without losing momentum.',paraphrase:'They think the market will tolerate more greed.',stockDelta:0.03,weight:1.0},
  {id:'exclusive-rights',title:'Exclusive Rights Celebration',summary:'Flopps renewed a major rights agreement and called it a win for fans.',paraphrase:'They are celebrating another gatekeeping victory.',stockDelta:0.06,weight:0.9},
  {id:'creator-partnership',title:'Creator Partnership Rollout',summary:'A new live-content partnership will turn more breaks into event media.',paraphrase:'They are turning commerce into content to sell faster.',stockDelta:0.05,weight:0.95},
  {id:'recall-management',title:'Recall Management Update',summary:'A small subset of product is being reviewed for presentation consistency.',paraphrase:'They are hiding a problem in bureaucracy.',stockDelta:-0.08,weight:0.75},
  {id:'collector-fatigue',title:'Collector Fatigue Acknowledgment',summary:'Leadership noted that some collectors may need a stronger reason to stay engaged.',paraphrase:'They noticed the audience is tired and plan to push harder.',stockDelta:-0.06,weight:0.85},
  {id:'holiday-briefing',title:'Holiday Briefing',summary:'Seasonal demand will be supported by a tighter, more premium giftable lineup.',paraphrase:'They are gearing up for the annual spending trap.',stockDelta:0.04,weight:0.9},
  {id:'earnings-call',title:'Earnings Call Preview',summary:'Management will present another quarter of disciplined execution and collectible enthusiasm.',paraphrase:'They are preparing a call where greed gets translated into confidence.',stockDelta:0.07,weight:1.0},
  {id:'street-response',title:'Street Response Note',summary:'Flopps is monitoring market reaction and remains confident in the current valuation story.',paraphrase:'They are watching the stock and pretending nothing is wrong.',stockDelta:0.02,weight:0.8},
  {id:'allocation-tightening',title:'Allocation Tightening Advisory',summary:'Some regions will see tighter drop allocations while core markets receive priority.',paraphrase:'They are rationing product by geography.',stockDelta:-0.05,weight:0.95},
  {id:'aftermarket-fee',title:'Aftermarket Fee Update',summary:'Platform fees and consignment terms are being adjusted for a more sustainable ecosystem.',paraphrase:'They are taking a bigger cut from the secondary market.',stockDelta:-0.04,weight:0.9},
  {id:'ethics-whitewash',title:'Community Responsibility Statement',summary:'Flopps reaffirmed its commitment to collector trust, transparency, and responsible excitement.',paraphrase:'They are laundering the vibe in corporate language.',stockDelta:0.0,weight:0.9},
  {id:'calendar-discipline',category:'cadence',title:'Calendar Discipline Memo',summary:'Flopps said the release slate will be managed with stricter sequencing to reduce idle demand periods.',paraphrase:'They found a more disciplined way to keep customers from cooling off.',stockDelta:0.03,weight:0.8},
  {id:'preorder-governance',category:'pricing',title:'Preorder Governance Update',summary:'Preorder access will move to a more curated framework that better rewards highly engaged collectors.',paraphrase:'They are gating preorders harder and calling it loyalty.',stockDelta:0.02,weight:0.8},
  {id:'bundle-optimization',category:'pricing',title:'Bundle Optimization Initiative',summary:'Selected products will now ship in higher-value bundles designed to simplify the collector decision journey.',paraphrase:'They are forcing customers into bigger carts.',stockDelta:0.04,weight:0.9},
  {id:'breaker-ecosystem',category:'community',title:'Breaker Ecosystem Support Plan',summary:'Flopps is increasing support for live breakers as key storytelling partners in the collector economy.',paraphrase:'They are feeding the people who turn sales into spectacle.',stockDelta:0.04,weight:0.85},
  {id:'factory-modernization',category:'operations',title:'Factory Modernization Brief',summary:'Capital investment in print operations will improve premium consistency and protect future launch velocity.',paraphrase:'They are buying equipment so they can squeeze harder at higher volume.',stockDelta:0.05,weight:0.75},
  {id:'security-protocol',category:'operations',title:'Collector Security Protocol Notice',summary:'Enhanced anti-leak controls are being introduced across packaging, logistics, and partner handling.',paraphrase:'They are locking down the pipeline because leaks disrupt the hype calendar.',stockDelta:0.01,weight:0.7},
  {id:'waitlist-enhancement',category:'allocation',title:'Waitlist Enhancement Program',summary:'Flopps is introducing a more sophisticated waitlist flow for high-demand drops and premium windows.',paraphrase:'They are industrializing disappointment.',stockDelta:0.02,weight:0.9},
  {id:'lottery-access',category:'allocation',title:'Fair Access Lottery Pilot',summary:'A randomized access pilot will help distribute limited products across a broader collector base.',paraphrase:'They are making scarcity feel participatory.',stockDelta:0.01,weight:0.85},
  {id:'regional-tiering',category:'allocation',title:'Regional Tiering Framework',summary:'Priority regions will receive stronger support while emerging zones are managed through a disciplined allocation curve.',paraphrase:'They are deciding which geographies matter this quarter.',stockDelta:-0.03,weight:0.85},
  {id:'shelf-rationalization',category:'operations',title:'Shelf Rationalization Program',summary:'Retail presentation standards are being tightened so fewer products occupy more premium shelf moments.',paraphrase:'They are shrinking the visible choice set to steer demand.',stockDelta:0.02,weight:0.8},
  {id:'channel-harmonization',category:'operations',title:'Channel Harmonization Note',summary:'Pricing and availability will become more consistent across stores, breakers, and direct channels.',paraphrase:'They are making sure every channel squeezes in the same direction.',stockDelta:0.03,weight:0.8},
  {id:'fulfillment-priority',category:'operations',title:'Fulfillment Priority Matrix',summary:'Priority handling is being extended to key products, top partners, and premium customer segments.',paraphrase:'They are formalizing favoritism as operations.',stockDelta:0.02,weight:0.8},
  {id:'return-friction',category:'pricing',title:'Returns Experience Revision',summary:'Flopps is refining the returns journey to protect product integrity and long-term ecosystem health.',paraphrase:'They are making returns more annoying.',stockDelta:0.01,weight:0.75},
  {id:'packaging-heritage',category:'community',title:'Packaging Heritage Statement',summary:'The company is preserving iconic packaging cues while elevating the unboxing moment for modern collectors.',paraphrase:'They are using nostalgia to justify the next premium box.',stockDelta:0.02,weight:0.75},
  {id:'print-run-opacity',category:'community',title:'Print-Run Confidence Note',summary:'Flopps says collectors should focus on quality, not speculative estimates about print volumes.',paraphrase:'They are asking people not to look too closely at supply.',stockDelta:0.0,weight:0.9},
  {id:'serial-storytelling',category:'pricing',title:'Serial Storytelling Expansion',summary:'Limited numbering will be embedded more intentionally into future product narratives and collector journeys.',paraphrase:'They are turning scarcity labels into plot devices.',stockDelta:0.03,weight:0.8},
  {id:'vip-corridor',category:'allocation',title:'VIP Corridor Rollout',summary:'A new premium access corridor will improve service for Flopps highest-conviction customers and partners.',paraphrase:'They are building a velvet rope for whales.',stockDelta:0.04,weight:0.85},
  {id:'slab-synergy',category:'marketplace',title:'Slab Synergy Initiative',summary:'Grading, marketplace, and release timing will be aligned more closely to support healthier price discovery.',paraphrase:'They want every part of the machine compounding the same frenzy.',stockDelta:0.05,weight:0.8},
  {id:'consignment-confidence',category:'marketplace',title:'Consignment Confidence Refresh',summary:'Higher-value consignment inventory will be curated more aggressively to protect market tone and premium outcomes.',paraphrase:'They are curating the resale market so prices stay flattering.',stockDelta:0.03,weight:0.75},
  {id:'direct-channel-growth',category:'marketplace',title:'Direct Channel Growth Update',summary:'More high-profile products will be routed through Flopps-owned channels to improve the end-to-end collector experience.',paraphrase:'They want a bigger share of the whole stack.',stockDelta:0.05,weight:0.85},
  {id:'break-calendar',category:'community',title:'Event Break Calendar Announcement',summary:'The company is formalizing a break-event calendar to better synchronize releases, media, and collector anticipation.',paraphrase:'They are scheduling the hype as a service.',stockDelta:0.04,weight:0.8},
  {id:'forum-listening',category:'community',title:'Forum Listening Initiative',summary:'Community teams will expand passive listening across hobby forums, creator channels, and resale chatter.',paraphrase:'They are monitoring the audience more carefully.',stockDelta:0.01,weight:0.7},
  {id:'ambassador-refresh',category:'community',title:'Collector Ambassador Refresh',summary:'Flopps is updating its ambassador roster to better reflect the modern voice of the hobby.',paraphrase:'They are hiring new hype intermediaries.',stockDelta:0.02,weight:0.8},
  {id:'overtime-alignment',category:'labor',title:'Overtime Alignment Notice',summary:'Operational teams will enter a short-term extended-hours posture to secure launch readiness across priority products.',paraphrase:'They are squeezing staff through launch week.',stockDelta:0.01,weight:0.8},
  {id:'headcount-rebalancing',category:'labor',title:'Headcount Rebalancing Update',summary:'Corporate support layers are being rebalanced to keep resources close to execution and premium demand moments.',paraphrase:'They are cutting back-office people to protect launch budgets.',stockDelta:0.03,weight:0.9},
  {id:'benefits-modernization',category:'labor',title:'Benefits Modernization Bulletin',summary:'Employee offerings will move to a more modern framework aligned with the companys next phase of growth.',paraphrase:'They are taking things away and calling it modernization.',stockDelta:-0.02,weight:0.8},
  {id:'campus-consolidation',category:'labor',title:'Campus Consolidation Plan',summary:'Flopps will centralize more teams into a smaller number of strategic offices over the next cycle.',paraphrase:'They want fewer offices and more control.',stockDelta:0.02,weight:0.75},
  {id:'contractor-flexibility',category:'labor',title:'Flexible Talent Model Update',summary:'The company is broadening its use of flexible specialist talent to remain responsive to market rhythms.',paraphrase:'They are leaning harder on contractors.',stockDelta:0.03,weight:0.8},
  {id:'policy-education',category:'lobbying',title:'Policy Education Campaign',summary:'Flopps will expand policy education efforts around market flexibility, collector choice, and modern commerce.',paraphrase:'They are lobbying with friendlier stationery.',stockDelta:0.02,weight:0.75},
  {id:'grassroots-simulation',category:'lobbying',title:'Grassroots Advocacy Activation',summary:'Collectors will have new opportunities to make their voices heard on issues shaping the future of the hobby.',paraphrase:'They are manufacturing a grassroots campaign.',stockDelta:0.01,weight:0.7},
  {id:'compliance-reframing',category:'lobbying',title:'Regulatory Clarity Working Group',summary:'Flopps joined a working group focused on proportional rules for modern collectibles commerce.',paraphrase:'They are trying to soften oversight before it arrives.',stockDelta:0.02,weight:0.75},
  {id:'licensing-optionality',category:'licensing',title:'Licensing Optionality Update',summary:'Management is pursuing a wider set of flexible licensing pathways to support future product moments.',paraphrase:'They are shopping for whatever fandom prices best next cycle.',stockDelta:0.04,weight:0.8},
  {id:'franchise-readiness',category:'licensing',title:'Franchise Readiness Review',summary:'Flopps says several entertainment properties are being assessed for release-window fit, collector resonance, and premium viability.',paraphrase:'They are focus-testing fandoms for extraction potential.',stockDelta:0.05,weight:0.85},
  {id:'trend-desk',category:'licensing',title:'Marketability Committee Brief',summary:'The trend desk has elevated a shortlist of culturally ascendant properties after reviewing search momentum, release windows, and monetization fit.',paraphrase:'They are picking the next set by testing what the internet is currently obsessed with.',stockDelta:0.04,weight:0.9},
  {id:'franchise-stack',category:'licensing',title:'Franchise Stack Expansion',summary:'Future sets will balance evergreen licenses, release-window spikes, and prestige nostalgia opportunities across the calendar.',paraphrase:'They are building a conveyor belt of monetizable IP.',stockDelta:0.05,weight:0.85},
  {id:'investor-narrative',category:'investor',title:'Narrative Quality Update',summary:'Flopps says the market increasingly understands its disciplined release architecture and premium collectibles thesis.',paraphrase:'They think the stock story is finally polished enough for institutions.',stockDelta:0.05,weight:0.75},
  {id:'guidance-tightening',category:'investor',title:'Guidance Tightening Statement',summary:'Management is tightening guidance language to reflect stronger visibility into releases, pricing, and partner monetization.',paraphrase:'They are managing expectations with better spreadsheet theater.',stockDelta:0.04,weight:0.75},
  {id:'synergy-realization',category:'investor',title:'Synergy Realization Update',summary:'Cross-functional alignment between licensing, marketplace, and product teams is producing more coherent premium outcomes.',paraphrase:'They found another way to say the machine is feeding itself.',stockDelta:0.04,weight:0.75},
  {id:'cash-deployment',category:'investor',title:'Capital Deployment Note',summary:'Flopps will prioritize capital deployment toward formats, licenses, and channels with the highest long-term collector yield.',paraphrase:'They are investing where the squeeze is cleanest.',stockDelta:0.05,weight:0.75},
  {id:'customer-lifetime',category:'pricing',title:'Collector Lifetime Value Review',summary:'The company has refined its view of lifetime collector engagement across sealed, grading, and resale touchpoints.',paraphrase:'They are measuring exactly how much one person can be worth over time.',stockDelta:0.03,weight:0.85},
  {id:'bundle-ethics',category:'community',title:'Accessibility and Value Note',summary:'Flopps says curated bundles remain one of the most accessible ways for collectors to participate at scale.',paraphrase:'They are pretending forced bundles are generous.',stockDelta:0.01,weight:0.8},
  {id:'microdrop-governance',category:'cadence',title:'Microdrop Governance Memo',summary:'Short-form drops will be used more strategically to maintain relevance between major releases without overwhelming the calendar.',paraphrase:'They are creating smaller excuses to keep the funnel warm.',stockDelta:0.03,weight:0.8},
  {id:'surprise-window',category:'cadence',title:'Surprise Window Activation',summary:'Management has reserved optional surprise windows to capture moments of elevated cultural attention.',paraphrase:'They want the right to opportunistically monetize a sudden trend spike.',stockDelta:0.04,weight:0.85},
  {id:'deceleration-denial',category:'investor',title:'Demand Normalization Commentary',summary:'Flopps believes recent moderation in some categories reflects healthy normalization, not softness in the hobby model.',paraphrase:'They are calling weaker demand healthy.',stockDelta:-0.01,weight:0.7},
  {id:'heritage-extraction',category:'pricing',title:'Nostalgia Monetization Update',summary:'Legacy design language will be deployed more deliberately in premium formats where collector memory supports stronger realized value.',paraphrase:'They are weaponizing nostalgia with sharper margins.',stockDelta:0.03,weight:0.8},
  {id:'queue-experience',category:'allocation',title:'Queue Experience Improvement',summary:'Digital queues will be refreshed to improve fairness, clarity, and anticipation during high-traffic release moments.',paraphrase:'They are redesigning the line so waiting feels like a feature.',stockDelta:0.02,weight:0.8},
  {id:'mystery-box',category:'pricing',title:'Discovery Format Pilot',summary:'A new discovery-led format will blend curated uncertainty with premium storytelling and limited availability.',paraphrase:'They invented a fancier loot box sentence.',stockDelta:0.04,weight:0.9},
  {id:'reputation-defense',category:'community',title:'Collector Trust Defense',summary:'Flopps said online criticism often misses the complexity required to sustain a modern premium collectibles ecosystem.',paraphrase:'They are defending the company by blaming the audience for not understanding the machine.',stockDelta:0.0,weight:0.75},
];
const FLOPPS_EXECUTIVES=[
  {role:'CEO',name:'Adrian Vale',domain:'portfolio'},
  {role:'CFO',name:'Lillian Mercer',domain:'margin'},
  {role:'President of Product',name:'Grant Bell',domain:'cadence'},
  {role:'CMO',name:'Elena Cross',domain:'hype'},
  {role:'VP of Allocation',name:'Marcus Reed',domain:'allocation'},
  {role:'Head of Community',name:'Noelle Park',domain:'community'},
  {role:'Chief People Officer',name:'Dana Sloane',domain:'labor'},
  {role:'Head of Government Affairs',name:'Reed Harlan',domain:'lobbying'},
  {role:'Investor Relations',name:'Mira North',domain:'ticker'},
];
const FLOPPS_PRODUCT_LINES=[
  'Flagship Series','Chrome Velocity','Heritage Archive','Midnight Obsidian',
  'Prism Apex','Museum Reserve','Instant Shock Drop','Bowline Prospects',
  'Dynasty Reserve','Cosmic Crossover'
];
const FLOPPS_PARTNERS=[
  'Major League Baseball','global football rights desk','combat sports licensing',
  'prestige entertainment studio','retro animation vault','streaming franchise slate',
  "children's fantasy estate",'sci-fi action universe','wrestling media partner','racing series office'
];
const FLOPPS_PHASES=[
  {id:'planning',label:'Long-Range Planning'},
  {id:'licensing',label:'Licensing Negotiation'},
  {id:'prelaunch',label:'Prelaunch Tease Cycle'},
  {id:'launch',label:'Launch Window'},
  {id:'sellthrough',label:'Sell-Through Extraction'},
  {id:'cooldown',label:'Collector Fatigue Management'},
];
const FLOPPS_TREND_CANDIDATES=[
  {name:'Harry Potter',partner:'Warner-style fantasy partner',category:'entertainment',base:0.88,windowMonths:[4,10],formatBias:'premium'},
  {name:'Superhero summer tentpole',partner:'major comic-film studio',category:'entertainment',base:0.82,windowMonths:[5,6,7],formatBias:'chrome'},
  {name:'Prestige sci-fi franchise',partner:'streaming sci-fi slate',category:'entertainment',base:0.77,windowMonths:[9,11],formatBias:'hobby'},
  {name:'Anime crossover event',partner:'global anime licensing desk',category:'entertainment',base:0.79,windowMonths:[1,4,10],formatBias:'instant-drop'},
  {name:'Premier football stars',partner:'global football rights desk',category:'sports',base:0.84,windowMonths:[8,9],formatBias:'flagship'},
  {name:'MLB opening week',partner:'Major League Baseball',category:'sports',base:0.81,windowMonths:[3,4],formatBias:'flagship'},
  {name:'NFL rookie season',partner:'pro football rights office',category:'sports',base:0.86,windowMonths:[4,8,9],formatBias:'chrome'},
  {name:'Formula racing spotlight',partner:'global racing series office',category:'sports',base:0.73,windowMonths:[3,5,10],formatBias:'premium'},
  {name:'Wrestling premium event',partner:'wrestling media partner',category:'sports-entertainment',base:0.75,windowMonths:[0,3,7,10],formatBias:'hobby'},
  {name:'Fantasy streaming reboot',partner:"children's fantasy estate",category:'entertainment',base:0.76,windowMonths:[6,9,11],formatBias:'heritage'},
];
// Quality hint pools — what a collector casually notices inspecting a card
const HINT_CENTERING={
  10:["Perfectly centered","Flawless centering","Dead-on borders"],
  9: ["Slight tilt barely visible","One border a touch narrow","Almost perfect centering"],
  8: ["Slightly off-center on the left","Borders mostly even","Tiny centering variance"],
  7: ["Visibly off-center left","Top border noticeably narrow","A bit lopsided"],
  6: ["Off-center, left-heavy","Uneven borders","Top border is thin"],
  5: ["Notably off-center","Borders clearly uneven","Significant tilt"],
  4: ["Very off-center","Major centering issue","One border barely exists"],
  3: ["Severely off-center","Border nearly gone on one side"],
  2: ["Extreme centering issues","Card image shifted badly"],
  1: ["Comically off-center","Image practically touching edge"],
};
const HINT_CORNERS={
  10:["Razor sharp corners","Pristine corners","Four perfect points"],
  9: ["Three perfect, one tiny touch","Almost razor sharp","One micro-fuzz under magnification"],
  8: ["One slightly soft corner","Minor wear on top-right","One corner just barely touched"],
  7: ["Two soft corners","Rounding on top-left visible","Corners losing their edge"],
  6: ["Rounded corners visible","Ding on bottom-right corner","Wear on multiple corners"],
  5: ["Noticeably rounded corners","Dinged corners","Fraying on corners"],
  4: ["Heavily rounded","Corner fuzzing obvious","Multiple dings"],
  3: ["Very rounded corners","Corners worn down","Significant fraying"],
  2: ["Severely rounded corners","Corner damage","Battered corners"],
  1: ["Destroyed corners","Corners basically gone","Massive corner wear"],
};
const HINT_EDGES={
  10:["Clean edges","Pristine edges","No edge wear"],
  9: ["One micro-chip on close inspection","Edges look clean","Tiny rough spot on one edge"],
  8: ["Slight chipping on one edge","Minor edge wear visible","One rough edge"],
  7: ["Chipping on two edges","Edge whitening starting","Rough spot on bottom"],
  6: ["Multiple edge chips","White showing on edges","Noticeable chipping"],
  5: ["Chipped edges","Edge wear visible","Rough edges"],
  4: ["Heavy edge chipping","Edges showing white","Worn edges"],
  3: ["Very rough edges","Significant edge damage"],
  2: ["Tattered edges","Edges badly worn"],
  1: ["Destroyed edges","Edges frayed and torn"],
};
const HINT_SURFACE={
  10:["Glossy and clean","Pristine surface","Surface is perfect"],
  9: ["Barely visible print line","Surface looks great","One tiny mark under angled light"],
  8: ["Faint print line visible","Minor surface mark in light","One small surface scratch"],
  7: ["Print line across the card","Slight surface scuffing","Loss of gloss beginning"],
  6: ["Visible print defect","Scratch catches the light","Surface wear visible"],
  5: ["Scratching visible","Print defect obvious","Surface losing its shine"],
  4: ["Multiple surface scratches","Loss of gloss","Surface wear obvious"],
  3: ["Heavy surface wear","Scratched up","Dull surface"],
  2: ["Severely scratched","Surface staining","Very worn surface"],
  1: ["Surface destroyed","Heavy staining and scratching"],
};
const HINT_APPEAL={
  10:["Looks pristine 🔍","Eye-catching","Flawless presentation"],
  9: ["Looks fantastic","Near-perfect eye appeal","Beautiful card"],
  8: ["Looks great in the sleeve","Nice overall","Solid eye appeal"],
  7: ["Looks good overall","Some minor issues but nice","Decent presentation"],
  6: ["Some visible wear","Fair eye appeal","Acceptable condition"],
  5: ["Wear is noticeable","Below average condition","Decent from a distance"],
  4: ["Worn but presentable","Heavy wear visible","Condition is an issue"],
  3: ["Very worn","Poor eye appeal","Well-loved"],
  2: ["Poor condition","Heavily worn","Significant damage"],
  1: ["Terrible condition","Very heavily damaged","Extreme wear"],
};
const SP_EMOJI={Variation:"🎨",Novelty:"🍕",Relic:"🏅",Autograph:"✍️",Booklet:"📖","Error Variant":"❌","Dual Auto":"✍️✍️","Auto Patch":"✍️🏅"};

const CATS=[
  {n:"Sci-Fi/Space",w:20,th:["Deep Space Rangers","Nebula Nomads","Orbital Pirates","Void Walkers","Stellar Cartographers"],
   f:["Zara","Kael","Nova","Rex","Lyra","Orion","Vex","Nyx","Atlas","Cleo","Dax","Iris","Finn","Echo","Sage","Titan","Aura","Blaze","Kai","Luna","Sol","Zen","Arco","Vega","Rune","Ember","Ash","Drift","Cipher","Stella","Phoenix"],
   l:["Starweaver","Voidborn","Lightfoot","Ironclad","Moonsbane","Skyrender","Duskwalker","Deepforge","Starseed","Ironfin","Nighthollow","Solborn","Windrider","Flamecrest","Dawnbringer","Stormseeker","Sunforge","Thornback","Riftwalker","Starfall","Nightshade","Coldsteel","Emberheart","Voidwalker","Brightblade","Steelsong","Ashborne","Moonshadow","Deepcurrent","Gravewhisper"]},
  {n:"Fantasy/Myth",w:15,th:["Realm of Eldoria","Dragonfire Legends","Elven Twilight","Dwarven Forge Kings","Arcane Bloodlines"],
   f:["Theron","Isolde","Grimbold","Elara","Fenris","Seraphina","Bran","Morgana","Draven","Lirien","Gwendolyn","Alaric","Rowan","Freya","Cedric","Ysolde","Leoric","Elowen","Gareth","Nimue","Finnian","Brynn","Torin","Maeve","Callum","Sylas","Rhea","Talon","Aria","Oberon"],
   l:["Ashwood","Stormborn","Ironheart","Duskfire","Frostweaver","Bloodbane","Shadowmere","Goldspire","Thornwood","Moonblade","Flamekin","Ravencrest","Deepwater","Stonehelm","Starweave","Wildroot","Emberfall","Nightbloom","Dawnkeeper","Runeforged","Briarcliff","Wolfsbane","Ironveil","Sunstrike","Brightspear","Darkhollow","Silverthorn","Oakhaven","Mistwalker","Bonecrusher"]},
  {n:"Sports Alt",w:10,th:["Thunder League","Velocity Circuit","Apex Arena","Titan Bowl","Gravity Games"],
   f:["Marcus","Tyson","Raven","Blitz","Diesel","Flash","Ace","Rumble","Spark","Bolt","Crush","Dynamo","Viper","Slash","Brawler","Storm","Fury","Rush","Tank","Rico","Jett","Duke","Havoc","Beast","Knockout","Rocket","Max","Zane","Clutch","Savage"],
   l:["McCrush","Steelarm","Blitzberg","Thunder","Breaker","Rushmore","Powerhouse","Ironwill","Bonecrusher","Speedster","Slamdunk","Gravedigger","Wrecking","Bonebreak","Skullcrack","Bodycheck","Haymaker","Thunderbolt","Rampage","Demolition","Overtime","Knockdown","Firestorm","Shockwave","Battering","Striker","Endzone","Wildcard","Bulldozer","Smasher"]},
  {n:"Historical",w:10,th:["Empires Collide","Revolutionary Spirits","Ancient Dynasties","Renaissance Minds","Age of Discovery"],
   f:["Alexander","Cleopatra","Augustus","Boudica","Leonardo","Napoleon","Genghis","Elizabeth","Julius","Hypatia","Charlemagne","Theodora","Constantine","Joan","Saladin","Ashoka","Nefertiti","Spartacus","Lysandra","Pericles","Hatshepsut","Ramesses","Darius","Themistocles","Zenobia","Trajan","Cyrus","Brutus","Marcus","Octavian"],
   l:["the Great","of Macedon","Augusta","Ironside","da Firenze","Bonaparte","Khan","Tudor","Caesar","of Alexandria","Magnus","the Bold","the Wise","of Arc","Ayyubid","Maurya","the Radiant","Thracian","the Just","of Athens","the Golden","the Second","of Palmyra","the Conqueror","the Elder","of Iceni","Aurelius","Barca","Scipio","Sulla"]},
  {n:"Nature/Animals",w:10,th:["Untamed Wilds","Ocean Depths","Canopy Kingdom","Savanna Pride","Arctic Tundra"],
   f:["Fang","Claw","Shadow","Storm","Blaze","Ember","Frost","River","Mountain","Thorn","Moss","Coral","Luna","Breeze","Canyon","Reef","Tundra","Dusk","Petal","Crest","Bark","Brook","Fern","Boulder","Misty","Sage","Pebble","Willow","Feather","Zephyr"],
   l:["Mane","Whisper","Runner","Heart","Fang","Pelt","Claw","Roar","Tail","Wing","Paw","Howl","Horn","Fur","Beak","Scale","Bloom","Shade","Dive","Swoop","Leap","Growl","Track","Flyer","Splash","Call","Song","Trunk","Stripe","Prowl"]},
  {n:"Urban/Modern",w:10,th:["Street Legends","Neon District","Concrete Jungle","Metro Underground","Skyline Syndicate"],
   f:["Marcus","Zara","Vince","Luna","Dex","Nikki","Rico","Mika","Trey","Sasha","Kai","Raven","Milo","Jade","Leo","Nova","Quinn","Viper","Echo","Blade","Jax","Roxy","Flint","Aria","Tank","Silk","Dusty","Celeste","Nero","Pixie"],
   l:["DaSilva","Moreno","Blackwood","Storm","Cruz","Kim","O'Brien","Stone","Reyes","Chen","Walsh","Frost","Rivera","Cross","Santos","Volkov","Park","Davis","Kowalski","Santini","Bradley","Foster","Hayes","Morgan","Sullivan","Petrov","Lane","Sinclair","Wright","Mercer"]},
  {n:"Horror/Gothic",w:8,th:["Crimson Hollow","Grimm Estates","Shadowsfall","Whispering Pines","Blackwood Asylum"],
   f:["Morticia","Raven","Damien","Lilith","Vlad","Edgar","Ophelia","Lucius","Mabel","Barnabas","Rosalind","Silas","Hecate","Dorian","Annabel","Gideon","Morwenna","Alistair","Lenore","Phineas","Tabitha","Montague","Desdemona","Balthazar","Elspeth","Cornelius","Cassandra","Septimus","Perdita","Roderick"],
   l:["Blackwood","Nightshade","Graves","Hollow","Croft","Ashmore","Wraith","Crimson","Thorne","Grimshaw","Bloodworth","Shadows","Ravencroft","Dreadmoor","Sable","Mortis","Winters","Gloom","Barrow","Sinister","Obsidian","Shadwell","Bonehill","Phantom","Doom","Darke","Specter","Frost","Holloway","Nethercott"]},
  {n:"Pop Culture Parody",w:7,th:["Meme Legends","Stream Warriors","Viral Nation","Internet Hall of Fame","Digital Icons"],
   f:["Pixel","Glitch","Bit","Ninja","Turbo","Sigma","Flux","Nova","Viral","Meme","Cloud","Byte","Spark","Neo","Echo","Hype","Buzzy","Retro","Rage","Toast","Loot","Grind","AFK","Buff","Nerf","Crit","DPS","Meta","Pog","Yolo"],
   l:["Master","Overlord","Slayer","Lord","King","Queen","Chef","Boss","Hero","Legend","Prime","God","Machine","Walker","Rider","Hunter","Maker","Chief","Guru","Wizard","Crasher","Runner","Farmer","Dancer","Star","Craft","Theory","Breaker","Hacker","Stacker"]},
  {n:"Mecha/Tech",w:5,th:["Steel Vanguard","Circuit Breakers","Neural Ops","Chrome Titans","Robo Force"],
   f:["Unit-7","AXION","PRISM","Volt","Cache","Logic","Binary","Vector","Flux","Cipher","Kernel","Socket","Proxy","Daemon","Render","Core","Pulse","Spark","Frame","Sync","Hex","Node","Codec","Fiber","Patch","Query","Debug","Stack","Array","Matrix"],
   l:["Prime","Omega","Sigma","Alpha","Delta","Zero","One","Core","X","Ultima","Nova","Vex","Ion","Arc","Bolt","Grid","Link","Wire","Chip","Disk","Byte","Bit","Flow","Tech","Mech","Drone","Bot","Lab","Net","Sys"]},
  {n:"Culinary",w:5,th:["Iron Chef Arena","Pastry Wars","Street Food Kings","Fermentation Masters","Spice Road"],
   f:["Gordon","Julia","Marco","Auguste","Alain","Thomas","Rene","Alice","Jose","Wolfgang","Nigella","Bobby","Cat","Paul","Jamie","Dominique","Yotam","Daniel","Emeril","Grant","Ferran","Heston","David","Lidia","Jacques","Anne","Morimoto","Nayeli","Ramsay","Sanjeev"],
   l:["Flambe","Saute","Blanch","Paprika","Truffle","Saffron","Caramel","Brioche","Miso","Umami","Cardamom","Vanilla","Espresso","Sriracha","Kimchi","Gochujang","Risotto","Tartare","Brulee","Terrine","Ganache","Bouillon","Julienne","Mignon","Prosciutto","Parmesan","Fontina","Zest","Crumb","Gratin"]},
];

module.exports = {
  // ── Path helpers ──
  getDataDir,
  // ── Card Format System ──
  CARD_FORMATS,
  // ── Auto/Relic Modifiers ──
  AUTO_TYPES,
  AUTO_VARIANTS,
  RELIC_TYPES,
  RELIC_QUALITY,
  composeAuto,
  composeRelic,
  // ── RNG internals (used by compose functions) ──
  mulberry32,
  ENGINE_BASE_SEED,
  GLOBAL_RNG,
  RNG,
  pwK,
  // ── Pack Config ──
  PACK_CONFIG_PATH,
  loadPackConfig,
  getDefaultParallels,
  PACKS,
  DEFAULT_PARALLELS,
  PARALLELS,
  // ── Default Card Types ──
  DEFAULT_CARD_TYPES,
  SPECIALS,
  resolveParallels,
  resolveCardTypes,
  resolveInserts,
  // ── Tiers, Subs, Grades ──
  TIERS,
  SUBS,
  GRADES,
  PSA_TIERS,
  PLATES,
  // ── Grading Economy ──
  GRADING_DIR,
  COMPANIES_FILE,
  GRADING_STATE_FILE,
  POP_FILE,
  // ── Display Mappings ──
  TIER_EMOJI,
  TIER_COLOR,
  PAR_EMOJI,
  SUB_EMOJI,
  SP_EMOJI,
  // ── Flopps ──
  FLOPPS_BULLETINS,
  FLOPPS_EXECUTIVES,
  FLOPPS_PRODUCT_LINES,
  FLOPPS_PARTNERS,
  FLOPPS_PHASES,
  FLOPPS_TREND_CANDIDATES,
  // ── Quality Hint Pools ──
  HINT_CENTERING,
  HINT_CORNERS,
  HINT_EDGES,
  HINT_SURFACE,
  HINT_APPEAL,
  // ── Categories ──
  CATS,
};
