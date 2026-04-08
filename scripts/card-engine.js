#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {execSync,execFileSync}=require('child_process');
const DATA_DIR=process.env.TRADING_CARDS_DATA_DIR?path.resolve(process.env.TRADING_CARDS_DATA_DIR):path.join(__dirname,'..','data');
const FLOPPS_DIR=path.join(DATA_DIR,'flopps');
const FLOPPS_STATE_FILE=path.join(FLOPPS_DIR,'state.json');
const FLOPPS_WILDCARD_DIR=path.join(FLOPPS_DIR,'wildcards');
const CAT=require('./categories.js');
const { buildRichSetMetadata } = require('./set-metadata.js');

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

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

// Build a composed auto name + price modifier
function composeAuto(){
  const type=pwK(AUTO_TYPES,'mult',Math.random); // weighted toward lower mult
  const variant=pwK(AUTO_VARIANTS,'weight',Math.random);
  return {name:variant.name+type.name, mult:type.mult*variant.mult, emoji:type.emoji+variant.name.replace(/ /g,'').slice(0,1),
    autoType:type.id, autoVariant:variant.id};
}
function composeRelic(){
  const type=pwK(RELIC_TYPES,'mult',Math.random);
  const quality=pwK(RELIC_QUALITY,'mult',Math.random);
  return {name:quality.name+type.name+' Relic', mult:type.mult*quality.mult, emoji:type.emoji,
    relicType:type.id, relicQuality:quality.id};
}

// ─── DEFAULT PARALLEL TEMPLATE (backward compat) ─────────────────
const DEFAULT_PARALLELS=[
  {name:"Base",tier:1,odds:1,num:false,ser:null,pm:1},
  {name:"Chrome",tier:2,odds:3,num:false,ser:null,pm:1.3},
  {name:"Purple Shimmer",tier:3,odds:6,num:false,ser:null,pm:1.8},
  {name:"Blue Crackle",tier:4,odds:12,num:false,ser:null,pm:2.5},
  {name:"Tie-Dye",tier:5,odds:18,num:false,ser:null,pm:3.5},
  {name:"Pink Neon",tier:6,odds:24,num:false,ser:null,pm:5},
  {name:"Gold",tier:7,odds:36,num:true,ser:2026,pm:8},
  {name:"Green Lava",tier:8,odds:60,num:true,ser:499,pm:12},
  {name:"Cyan Ice",tier:9,odds:80,num:true,ser:299,pm:18},
  {name:"Magenta Pulse",tier:10,odds:100,num:true,ser:199,pm:25},
  {name:"Orange Blaze",tier:11,odds:130,num:true,ser:99,pm:35},
  {name:"Teal Surge",tier:12,odds:160,num:true,ser:75,pm:45},
  {name:"Red Magma",tier:13,odds:200,num:true,ser:50,pm:60},
  {name:"Black Shattered",tier:14,odds:350,num:true,ser:25,pm:100},
  {name:"White Rainbow",tier:15,odds:500,num:true,ser:10,pm:180},
  {name:"Gold Superfractor",tier:16,odds:5000,num:true,ser:1,pm:400},
  {name:"Black Infinite",tier:17,odds:5000,num:true,ser:1,pm:600},
  {name:"Printing Plate",tier:18,odds:5000,num:true,ser:1,pm:350},
];

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

// Pack hit rates: % chance each pack has a hit slot that fires
// Hobby: ~42% hit rate → ~5 hits per 12-pack box (realistic)
// Blaster: ~17% → ~1 hit per 6-pack box
// Retail: 3% → occasional hit
// Jumbo: 50% per hit slot, 2 hit slots
const PACKS={
  hobby:{name:"Hobby Box",packs:12,cpp:5,price:120,hitRate:0.42,slots:[{mt:2},{mt:6},{mt:10},{mt:15},{hit:true}]},
  blaster:{name:"Blaster Box",packs:6,cpp:5,price:50,hitRate:0.17,slots:[{mt:2},{mt:2},{mt:8},{mt:12},{hit:true}]},
  retail:{name:"Retail Pack",packs:1,cpp:5,price:5,hitRate:0.03,slots:[{mt:2},{mt:2},{mt:6},{mt:10},{mt:10}]},
  jumbo:{name:"Jumbo Pack",packs:1,cpp:10,price:30,hitRate:0.50,slots:[{mt:2},{mt:2},{mt:4},{mt:6},{mt:8},{mt:10},{mt:10},{mt:12},{hit:true},{hit:true}]},
};

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
function psaTierForValue(v){return PSA_TIERS.find(t=>v<=t.maxVal)||PSA_TIERS[PSA_TIERS.length-1];}
const PLATES=["Cyan","Magenta","Yellow","Black"];

// ─── GRADING ECONOMY ──────────────────────────────────────────────
const GRADING_DIR=path.join(DATA_DIR,'grading');
const COMPANIES_FILE=path.join(GRADING_DIR,'companies.json');
const GRADING_STATE_FILE=path.join(GRADING_DIR,'state.json');
const POP_FILE=path.join(GRADING_DIR,'population.json');

function loadCompanies(){return rJ(COMPANIES_FILE)||{};}
function loadGradingState(){let s=rJ(GRADING_STATE_FILE);if(!s)s={submissions:[],history:[]};return s;}
function saveGradingState(s){wJ(GRADING_STATE_FILE,s);}
function loadPopulation(){return rJ(POP_FILE)||{};}
function savePopulation(p){wJ(POP_FILE,p);}

function gaussRand(mean,std){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*std+mean;}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

function generateCondition(tier){
  // Higher tier cards get slightly better condition
  const tierBoost=(tier==='Legendary')?1.2:(tier==='Superstar')?0.8:(tier==='Star')?0.4:0;
  return {
    centering: Math.round(clamp(gaussRand(85+tierBoost,8),50,100)),
    corners: Math.round(clamp(gaussRand(8+tierBoost*0.1,1.2),1,100))/10,
    edges: Math.round(clamp(gaussRand(8.5+tierBoost*0.05,1.0),1,100))/10,
    surface: Math.round(clamp(gaussRand(8+tierBoost*0.08,1.5),1,100))/10,
  };
}

function ensureCondition(card){
  if(card.condition)return card.condition;
  const cond=generateCondition(card.starTier||'Common');
  card.condition=cond;
  return cond;
}

function conditionToGrade(cond,company){
  const comp=loadCompanies()[company];
  if(!comp)return conditionToGrade(cond,'PSA');
  const strict=comp.strictness||0;
  // Normalize all to 0-10 scale
  const cCentering=cond.centering/10;
  const cCorners=cond.corners;
  const cEdges=cond.edges;
  const cSurface=cond.surface;
  // Weighted average with slight variance
  const avg=(cCentering*0.25+cCorners*0.25+cEdges*0.25+cSurface*0.25);
  const variance=(Math.random()-0.5)*0.5; // ±0.25
  let score=avg+variance+strict*0.15; // strictness shifts score
  score=clamp(score,1,10);
  // Map to grade scale
  if(score>=9.5)return 10;
  if(score>=8.75)return 9;
  if(score>=8.0)return 8.5;
  if(score>=7.0)return 8;
  if(score>=6.0)return 7;
  if(score>=5.0)return 6;
  if(score>=4.0)return 5;
  if(score>=3.0)return 4;
  if(score>=2.0)return 3;
  if(score>=1.0)return 2;
  return 1;
}

function isBlackLabel(cond){
  return cond.centering>=95&&cond.corners>=9.8&&cond.edges>=9.8&&cond.surface>=9.8;
}

function gradeMultiplier(grade,company,cond){
  const base={10:3,9:2.5,8.5:1.8,8:1.3,7:1.0,6:0.85,5:0.7,4:0.5,3:0.35,2:0.2,1:0.1}[grade]||1;
  let mult=base;
  if(company==='BGS'&&grade===10&&isBlackLabel(cond))mult*=2.5; // Black Label premium
  if(company==='PSA')mult*=1.1; // PSA highest resale
  if(company==='SGC')mult*=0.9;
  return mult;
}

function estimateGradeProbability(cond,company,targetGrade){
  // Monte Carlo estimate
  let hits=0;const trials=200;
  for(let i=0;i<trials;i++){
    if(conditionToGrade(cond,company)>=targetGrade)hits++;
  }
  return hits/trials;
}

function gradeLabel(grade,company,cond){
  if(company==='BGS'&&grade===10&&isBlackLabel(cond))return 'BGS 10 Black Label 💎';
  return `${company} ${grade}`;
}

function progressStr(elapsed,total){
  const pct=Math.min(elapsed/total,1);
  const filled=Math.round(pct*15);
  return '█'.repeat(filled)+'░'.repeat(15-filled);
}

function bumpPopulation(setKey,cardNum,company,grade){
  const pop=loadPopulation();
  if(!pop[setKey])pop[setKey]={};
  if(!pop[setKey][cardNum])pop[setKey][cardNum]={totalGraded:0};
  const card=pop[setKey][cardNum];
  if(!card[company])card[company]={};
  card[company][grade]=(card[company][grade]||0)+1;
  card.totalGraded++;
  // Simulate NPC grading (add some noise to population)
  const npcChance=Math.random();
  if(npcChance<0.3){
    const npcCompanies=['PSA','BGS','SGC'];
    const npcCompany=npcCompanies[Math.floor(Math.random()*npcCompanies.length)];
    const npcGrades=[10,9,8.5,8,7];
    const npcGrade=npcGrades[Math.floor(Math.random()*npcGrades.length)];
    if(!card[npcCompany])card[npcCompany]={};
    card[npcCompany][npcGrade]=(card[npcCompany][npcGrade]||0)+1;
    card.totalGraded++;
  }
  savePopulation(pop);
}

function simNpcPopulationGrowth(setKey,cardNum){
  // Called on grade pop/status to simulate NPC grading over time
  const pop=loadPopulation();
  if(!pop[setKey]||!pop[setKey][cardNum])return;
  const card=pop[setKey][cardNum];
  const currentTotal=card.totalGraded;
  const growth=Math.floor(Math.random()*Math.min(3,Math.max(1,currentTotal*0.05)));
  for(let i=0;i<growth;i++){
    const npcCompanies=['PSA','BGS','SGC'];
    const weights=[0.5,0.3,0.2];
    let r=Math.random();let npcCompany='PSA';
    let acc=0;for(let j=0;j<npcCompanies.length;j++){acc+=weights[j];if(r<=acc){npcCompany=npcCompanies[j];break;}}
    const npcGrades=[10,9,8.5,8,7];
    const npcWeights=[0.08,0.3,0.25,0.22,0.15];
    let r2=Math.random();let npcGrade=9;let acc2=0;
    for(let j=0;j<npcGrades.length;j++){acc2+=npcWeights[j];if(r2<=acc2){npcGrade=npcGrades[j];break;}}
    if(!card[npcCompany])card[npcCompany]={};
    card[npcCompany][npcGrade]=(card[npcCompany][npcGrade]||0)+1;
    card.totalGraded++;
  }
  savePopulation(pop);
}

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
  'children\'s fantasy estate','sci-fi action universe','wrestling media partner','racing series office'
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
  {name:'Fantasy streaming reboot',partner:'children\'s fantasy estate',category:'entertainment',base:0.76,windowMonths:[6,9,11],formatBias:'heritage'},
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

function rollGrade(){
  const t=GRADES.reduce((s,g)=>s+g.w,0);
  let r=Math.random()*t;
  for(const g of GRADES){r-=g.w;if(r<=0)return g}
  return GRADES[2]; // fallback to PSA 8
}

function generateQuality(gradeInput){
  const grade = typeof gradeInput === 'object' ? gradeInput.grade : gradeInput;
  // Pick 2-3 visible hints that a collector would casually notice
  // Higher grades: fewer/weaker hints. Lower grades: more/obvious hints.
  const hintCount = grade>=9 ? 1 : grade>=7 ? 2 : grade>=5 ? 3 : 4;
  const pick=(pool)=>pool[Math.floor(Math.random()*pool.length)];
  const gradeHints=HINT_CENTERING[grade]||HINT_CENTERING[8];
  const cornerHints=HINT_CORNERS[grade]||HINT_CORNERS[8];
  const edgeHints=HINT_EDGES[grade]||HINT_EDGES[8];
  const surfaceHints=HINT_SURFACE[grade]||HINT_SURFACE[8];
  const appealHints=HINT_APPEAL[grade]||HINT_APPEAL[8];
  const hints=[];
  // Always include one appeal hint
  hints.push(pick(appealHints));
  // Build from other categories
  const cats=[{pool:gradeHints,cat:'centering'},{pool:cornerHints,cat:'corners'},
              {pool:edgeHints,cat:'edges'},{pool:surfaceHints,cat:'surface'}];
  // Shuffle and pick
  const shuffled=cats.sort(()=>Math.random()-0.5);
  for(let i=0;i<Math.min(hintCount,shuffled.length);i++){
    hints.push(pick(shuffled[i].pool));
  }
  // For grades 1-4, add one extra harsh hint
  if(grade<=4) hints.push(pick(cornerHints));
  return {grade, hints, graded:false};
}

function getCond(){
  // Legacy compat: returns {name, m} for calcPrice
  // Replaced by rollGrade()+generateQuality() but kept for transition
  const g=rollGrade();
  return {name:g.name, m:g.mult, grade:g.grade};
}
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

// Utils
function rJ(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function wJ(p,d){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2))}
function pwK(arr,k,rng){const t=arr.reduce((s,x)=>s+x[k],0);let r=rng()*t;for(const x of arr){r-=x[k];if(r<=0)return x}return arr[arr.length-1]}
function ri(rng,a,b){const r=rng||Math.random;return Math.floor(r()*(b-a+1))+a}
function fm$(n){return'$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function pR(s,w){return s.length<w?s+' '.repeat(w-s.length):s.slice(0,w)}

// Virtual vs Real mode:
//   Virtual (default): no wallet deduction, no cards saved to collection — just simulates the break
//   Real: deducts from wallet, saves cards to collection (personal assets for wealth tracking)
//   Pass --real flag to open-pack/open-box to commit cards to collection.
//   The wallet starts at $50 — roughly one blaster or ten retail packs.
//   A broke collector scraping by on retail packs is the default lifestyle.

function loadCfg(){return rJ(path.join(DATA_DIR,'config.json'))||{wallet:50,activeSet:null,archivedSets:[],mode:'virtual',pocketMoney:5}}
function saveCfg(c){wJ(path.join(DATA_DIR,'config.json'),c)}
function loadSet(){
  const c=loadCfg();
  if(!c.activeSet)return null;
  const p=path.join(DATA_DIR,'sets',c.activeSet+'.json');
  const s=rJ(p);
  if(!s){c.activeSet=null;saveCfg(c);return null}
  return s;
}
function loadCol(sk){const c=loadCfg();const k=sk||c.activeSet;if(!k)return null;const cp=path.join(DATA_DIR,'collections',k+'.json');let col=rJ(cp);if(!col){if(c.activeSet===k){c.activeSet=null;saveCfg(c);return null}col={setKey:k,cards:[],pulls:{},stats:{total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0},bestPull:null,parallelCounts:{},wallet:c.wallet,sealedInventory:{}};wJ(cp,col)}if(!col.sealedInventory) col.sealedInventory={};return col}
function saveCol(col){wJ(path.join(DATA_DIR,'collections',col.setKey+'.json'),col)}
function rebuildPulls(col){col.pulls={};col.cards.forEach(c=>col.pulls[c.cardNum]=(col.pulls[c.cardNum]||0)+1)}
function nextAcquisitionBatchId(col){
  if(!col.acquisitionSeq) col.acquisitionSeq=0;
  col.acquisitionSeq+=1;
  return `${Date.now()}-${col.acquisitionSeq}`;
}
function createAcquisitionTracker(col,{opType,packType,packIndex}={}){
  const batchId=nextAcquisitionBatchId(col);
  return {
    batchId,
    opType:opType||'open-pack',
    packType:packType||null,
    packIndex:packIndex??null,
    openedAt:new Date().toISOString(),
    pullsBefore:{...(col?.pulls||{})},
    openingSeen:{},
  };
}
function annotateAcquiredCard(card, tracker){
  if(!tracker) return card;
  card.acquiredBatchId=tracker.batchId;
  card.acquiredOpType=tracker.opType;
  card.acquiredPackType=tracker.packType;
  card.acquiredPackIndex=tracker.packIndex;
  card.acquiredAt=tracker.openedAt;
  const prevDup=(tracker.pullsBefore?.[card.cardNum]||0)+(tracker.openingSeen?.[card.cardNum]||0);
  const currentDup=prevDup+1;
  card.acquiredCopyIndex=currentDup;
  card.acquiredIsDuplicate=currentDup>1;
  tracker.openingSeen[card.cardNum]=(tracker.openingSeen[card.cardNum]||0)+1;
  return card;
}
function setLastAcquisitionBatch(col, tracker, summary={}){
  if(!col||!tracker) return;
  col.lastAcquisitionBatch={
    id:tracker.batchId,
    opType:tracker.opType,
    packType:tracker.packType,
    packIndex:tracker.packIndex,
    openedAt:tracker.openedAt,
    duplicateCount:summary.duplicateCount||0,
    newCount:summary.newCount||0,
    cardCount:summary.cardCount||0,
  };
}
function getLatestAcquisitionBatch(col){
  return col?.lastAcquisitionBatch||null;
}
function ensureSealedInventory(col){
  if(!col.sealedInventory) col.sealedInventory={};
  return col.sealedInventory;
}
function getSealedInventoryEntry(col,product){
  return col?.sealedInventory?.[product]||null;
}
function getSealedQty(col,product){
  return getSealedInventoryEntry(col,product)?.qty||0;
}
function addSealedProduct(col,product,qty,meta={}){
  const inv=ensureSealedInventory(col);
  const entry=inv[product]||{qty:0,spent:0,history:[]};
  entry.qty+=qty;
  if(Number.isFinite(meta.spent)) entry.spent+=(meta.spent||0);
  entry.updatedAt=new Date().toISOString();
  if(meta.source||meta.storeName) entry.history=Array.isArray(entry.history)?entry.history:[];
  if(meta.source||meta.storeName){
    entry.history.push({
      timestamp:new Date().toISOString(),
      source:meta.source||'unknown',
      storeId:meta.storeId||null,
      storeName:meta.storeName||null,
      qty,
      spent:meta.spent||0,
    });
    if(entry.history.length>10) entry.history=entry.history.slice(-10);
  }
  inv[product]=entry;
}
function consumeSealedProduct(col,product,qty=1){
  const entry=getSealedInventoryEntry(col,product);
  if(!entry||entry.qty<qty) return false;
  entry.qty-=qty;
  entry.updatedAt=new Date().toISOString();
  if(entry.qty<=0) delete col.sealedInventory[product];
  return true;
}
function getSealedInventoryValue(col){
  if(!col?.sealedInventory) return 0;
  let total=0;
  for(const [product,entry] of Object.entries(col.sealedInventory)){
    const pt=PACKS[product];
    if(!pt) continue;
    total+=(entry.qty||0)*pt.price;
  }
  return total;
}
function formatSealedInventorySummary(col){
  if(!col?.sealedInventory) return '';
  const bits=[];
  for(const [product,entry] of Object.entries(col.sealedInventory)){
    const pt=PACKS[product];
    if(!pt||!(entry.qty>0)) continue;
    bits.push(`${entry.qty}× ${pt.name}`);
  }
  return bits.join(' │ ');
}
function isReal(){return process.argv.includes('--real')}
function normalizeSeed(seed,fallback=Date.now()){
  const n=Number(seed);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function genCard(num,cat,theme,rng){
  const cr=mulberry32(num*13+cat.f.length*7+cat.l.length*3);
  const tier=pwK(TIERS,'w',cr),sub=pwK(SUBS,'w',cr);
  const name=cat.f[ri(cr,0,cat.f.length-1)]+' '+cat.l[ri(cr,0,cat.l.length-1)];
  const ds=[`${name} dominates the ${theme} circuit`,`A legend of ${theme},${name} never backs down`,
    `${name}'s legacy in ${theme} is unmatched`,`The ${theme} chronicles feature ${name}`,
    `${name} rose through ${theme} with unmatched skill`];
  const stats={};for(const k of['power','speed','technique','endurance','charisma'])stats[k]=ri(cr,tier.st[0],tier.st[1]);
  return{num:String(num).padStart(3,'0'),name,subset:sub.name,starTier:tier.name,stats,desc:ds[ri(cr,0,4)],
    basePrice:tier.pr[0]+cr()*(tier.pr[1]-tier.pr[0])};
}

function genSetCode(rng){const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ';let s='';for(let i=0;i<3;i++)s+=c[ri(rng,0,25)];return s}

function generateSet(category, options) {
  const seed=normalizeSeed(options?.seed);
  const rng=mulberry32(seed);
  
  if (category && category !== 'character') {
    const result = CAT.generateSetByCategory(category, {...(options||{}), seed});
    if (result) {
      const code=genSetCode(rng);
      const year=new Date().getFullYear();
      const themeName=result.collectionTheme||result.propertyName||result.setName;
      const set = {
        code, name: themeName, officialName: themeName, themeName, year, category: result.setName,
        setCategory: category, cards: result.cards,
        seed, created: new Date().toISOString(),
      };
      // Copy extra metadata
      if (result.propertySynopsis) set.propertySynopsis = result.propertySynopsis;
      if (result.propertyGenre) set.propertyGenre = result.propertyGenre;
      if (result.sport) set.sport = result.sport;
      if (result.collectionTheme) set.collectionTheme = result.collectionTheme;
      if (result.seasons) set.seasons = result.seasons;
      set.metadata = buildRichSetMetadata({
        officialName: null,
        themeName,
        category: set.category,
        setCategory: category,
        year,
        code,
        cards: result.cards,
        seed,
        source: 'procedural',
        parallels: DEFAULT_PARALLELS,
        cardTypes: DEFAULT_CARD_TYPES,
        inserts: [],
        sport: set.sport,
        collectionTheme: set.collectionTheme,
        propertyGenre: set.propertyGenre,
        propertySynopsis: set.propertySynopsis,
        seasons: set.seasons,
        cadenceDays: 45,
        createdAt: set.created,
      });
      set.officialName=set.metadata.officialName;
      set.name=set.metadata.officialName;
      const key=`${code}-${year}`;
      wJ(path.join(DATA_DIR,'sets',key+'.json'),set);
      const cfg=loadCfg();cfg.activeSet=key;saveCfg(cfg);
      wJ(path.join(DATA_DIR,'collections',key+'.json'),
        {setKey:key,cards:[],pulls:{},stats:{total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0},bestPull:null,parallelCounts:{},wallet:cfg.wallet,sealedInventory:{}});
      return set;
    }
  }
  
  // Default: character generation (original behavior)
  const tw=CATS.reduce((s,c)=>s+c.w,0);let r=rng()*tw,cat=CATS[0];
  for(const c of CATS){r-=c.w;if(r<=0){cat=c;break}}
  const theme=cat.th[ri(rng,0,cat.th.length-1)];
  const code=genSetCode(rng),year=new Date().getFullYear();
  const cardCount = options?.cards || CAT.SIZE_RANGES?.[category]?.suggest || 150;
  const cards=[];for(let i=1;i<=cardCount;i++)cards.push(genCard(i,cat,theme,rng));
  const set={
    code,
    name:theme,
    officialName:theme,
    themeName:theme,
    year,
    category:cat.n,
    cards,
    seed,
    created:new Date().toISOString(),
  };
  set.metadata = buildRichSetMetadata({
    officialName:null,
    themeName:theme,
    category:cat.n,
    setCategory:category || 'character',
    year,
    code,
    cards,
    seed,
    source:'procedural',
    parallels:DEFAULT_PARALLELS,
    cardTypes:DEFAULT_CARD_TYPES,
    inserts:[],
    cadenceDays:45,
    createdAt:set.created,
  });
  set.officialName=set.metadata.officialName;
  set.name=set.metadata.officialName;
  const key=`${code}-${year}`;
  wJ(path.join(DATA_DIR,'sets',key+'.json'),set);
  const cfg=loadCfg();cfg.activeSet=key;saveCfg(cfg);
  wJ(path.join(DATA_DIR,'collections',key+'.json'),
    {setKey:`${code}-${year}`,cards:[],pulls:{},stats:{total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0},bestPull:null,parallelCounts:{},wallet:cfg.wallet,sealedInventory:{}});
  return set;
}

function rollParallel(maxT,set){
  const parallels=resolveParallels(set);
  const allowed=parallels.filter(p=>p.tier<=maxT);
  for(let i=allowed.length-1;i>=0;i--){
    const p=allowed[i];
    const pm=p.pm||p.priceMultiplier||1; // support both field names
    const odds=p.odds;
    if(p.tier===1)return{parallel:p,sn:null,plate:null};
    if(Math.random()<1/odds){
      let sn=null,plate=null;
      const ser=p.ser||p.serial;
      if(ser===1&&p.name==="Printing Plate"){plate=PLATES[ri(null,0,3)]}
      else if(ser===1){sn=1}
      else if(ser&&ser>1){sn=ri(null,1,typeof ser==='object'?ser.max:ser)}
      return{parallel:{...p,pm:pm},sn,plate};
    }
  }
  return{parallel:{...allowed[0],pm:allowed[0].pm||allowed[0].priceMultiplier||1},sn:null,plate:null};
}

function rollSpecial(set){
  const types=resolveCardTypes(set);
  const total=types.reduce((s,x)=>s+x.rarity,0);
  let r=Math.random()*total;
  for(const t of types){r-=t.rarity;if(r<=0)return t}
  return types[0];
}

// Roll a card type — uses per-card checklist if available, falls back to global roll
function rollCardType(set,card){
  const globalTypes=resolveCardTypes(set);
  const hasPerCard=card&&Array.isArray(card.cardTypes)&&card.cardTypes.length>0;
  if(!hasPerCard){
    // Legacy fallback: old random roll from global types
    const type=rollSpecial(set);
    return composeCardTypeResult(type,globalTypes);
  }
  // Per-card checklist mode: pick from card's allowed types using global rarity weights
  const allowed=card.cardTypes.map(name=>{
    const def=globalTypes.find(t=>t.name===name||t.id===name);
    return def||{id:'base',name:name,rarity:0.85,priceMultiplier:1,format:'standard',desc:'🃏 '+name};
  });
  const total=allowed.reduce((s,t)=>s+(t.rarity||1),0);
  let r=Math.random()*total;
  let picked=allowed[0];
  for(const t of allowed){r-=(t.rarity||1);if(r<=0){picked=t;break}}
  return composeCardTypeResult(picked,globalTypes);
}

function composeCardTypeResult(type,globalTypes){
  const result={...type};
  // Compose auto details for auto types
  if(type.id==='autograph'||type.id==='dual-auto'||type.id==='auto-patch'){
    result.auto=composeAuto();
    if(type.id==='dual-auto'){result.auto.autoVariant='dual';result.auto.name='Dual '+result.auto.name}
    if(type.id==='auto-patch'){result.relic=composeRelic();result.priceMultiplier=(result.auto.mult*result.relic.mult)}
    if(!result.format)result.format='standard';
  }
  if(type.id==='relic'){
    result.relic=composeRelic();
    result.priceMultiplier=result.relic.mult;
  }
  if(result.format&&CARD_FORMATS[result.format]){
    result.formatMult=CARD_FORMATS[result.format].mult;
    result.priceMultiplier=(result.priceMultiplier||1)*CARD_FORMATS[result.format].mult;
  } else {
    result.formatMult=1;
    if(!result.format)result.format='standard';
  }
  return result;
}

function selectCard(set,forHit){
  const w=set.cards.map(c=>{switch(c.starTier){
    case"Common":return forHit?0.5:3;case"Uncommon":return forHit?1:2;case"Star":return forHit?2:1.5;
    case"Superstar":return forHit?4:0.8;case"Legendary":return forHit?8:0.3;default:return 1;}});
  const t=w.reduce((s,v)=>s+v,0);let r=Math.random()*t;
  for(let i=0;i<set.cards.length;i++){r-=w[i];if(r<=0)return set.cards[i]}
  return set.cards[0];
}

function calcPrice(card,par,sp,cond,sn){
  const subMod=SUBS.find(s=>s.name===card.subset)?.m||1;
  let sb=1;if(sn!==null){if(sn<=5)sb=2;else if(sn<=10)sb=1.8;else if(sn<=25)sb=1.5}
  const gradeMult = cond.mult || GRADES.find(g=>g.grade===cond.grade)?.mult || 1;
  const spMult=sp.priceMultiplier||sp.mult||1; // support new card type format
  return card.basePrice*subMod*par.pm*spMult*gradeMult*sb;
}

function fmtCard(c, idx, set, dupCount) {
  const te = TIER_EMOJI[c.starTier] || "";
  const pe = PAR_EMOJI[c.parallel] || "";
  const se = SUB_EMOJI[c.subset] || "🃏";
  const hitTag = c.isHit ? " 💎HIT" : "";
  const dupTag = dupCount > 1 ? ` [x${dupCount}]` : "";
  const serTag = c.serStr ? " " + c.serStr : "";
  const stats = c.stats ? `⚔${c.stats.power} ${c.stats.speed} ${c.stats.technique} ${c.stats.endurance} ${c.stats.charisma}` : "";
  const catLine = c._categoryLine || "";
  const parDisplay = pe ? pe + " " + c.parallel : c.parallel;
  // Quality hints — show what collector notices, NOT the grade (unless graded)
  const quality = c.quality || c.condition || 'Unknown';
  const gradeLabel = c.graded ? `G${c.grade}` : ''; // only show grade after PSA submission
  const hintStr = typeof quality === 'string' ? quality : quality.hints.slice(0, 2).join('; ');
  const condLine = gradeLabel ? `${gradeLabel} │ ${hintStr}` : hintStr;
  const typeTag = c.cardTypeName ? ` │ ${c.cardTypeName}` : '';
  const priceSep = typeTag ? ' │ ' : ' │ ';
  return `  ${String(idx).padStart(2)}. ${te}${set.code}-${c.cardNum} ${c.name}${dupTag}\n` +
    `     ${parDisplay}${serTag} | ${se} ${c.subset} | ${condLine}\n` +
    (catLine ? `     ${catLine}\n` : '') +
    `     ${stats}${typeTag}${priceSep}${fm$(c.price)}${hitTag}`;
}

function pullCards(set,col,packType,openCtx={}){
  const pt=PACKS[packType];const pack=[];let hc=0;
  for(let si=0;si<pt.cpp;si++){
    const slot=pt.slots[si%pt.slots.length];
    let sp={name:"None",mult:1,desc:"",priceMultiplier:1,format:"standard",formatMult:1},bc,isHit=false;
    if(slot.hit){
      if(Math.random()<(PACKS[packType].hitRate||0)){
        bc=selectCard(set,true);sp=rollCardType(set,bc);isHit=true;hc++;
      } else {bc=selectCard(set,false)}
    } else bc=selectCard(set,false);
    const{parallel,sn,plate}=rollParallel(slot.mt||15,set);
    const cond=rollGrade();const quality=generateQuality(cond);const price=calcPrice(bc,parallel,sp,cond,sn);
    const serStr=parallel.num?(plate?`${plate} #1/1`:`#${sn}/${parallel.ser||parallel.serial}`):'';
    const id=`${set.code}-${bc.num}-${parallel.name}${plate?'-'+plate:''}-${sn||'0'}-G${cond.grade}`;
    const baseCard = set.cards.find(sc => sc.num === bc.num);
    const catLine = CAT.fmtCardCategoryLine(baseCard, set.setCategory);
    const condition=generateCondition(bc.starTier);
    const c={id,cardNum:bc.num,name:bc.name,subset:bc.subset,starTier:bc.starTier,stats:bc.stats||{},
      parallel:parallel.name,sn,serStr,plate,special:sp.name,specialDesc:sp.desc,
      quality,grade:cond.grade,gradeName:cond.name,price,isHit,
      marketPrice:price, popScore:0, demandScore:0,
      cardFormat:sp.format||'standard',cardTypeId:sp.id||null,
      cardTypeName:(sp.name==='Base'||sp.name==='None')?null:sp.name,
      condition,
      gradingResult:null,
      _categoryLine:catLine};
    annotateAcquiredCard(c,openCtx);
    pack.push(c);
    if(col){ // only update collection in real mode
      col.cards.push(c);col.pulls[bc.num]=(col.pulls[bc.num]||0)+1;
      col.stats.total++;col.stats.value+=price;col.parallelCounts[parallel.name]=(col.parallelCounts[parallel.name]||0)+1;
      if(isHit)col.stats.hits++;if((parallel.ser||parallel.serial)===1&&sn===1)col.stats.oneOfOnes++;
      if(!col.bestPull||price>col.bestPull.price)col.bestPull=c;
    }
  }
  return{pack,hc};
}

function ensureSet(){const s=loadSet();if(!s){const ns=generateSet();console.log(`\n  🎴 Auto-generated set: ${ns.name} (${ns.code})\n`)}}

function cmdGenSet(){
  // Parse category from args
  const catArg = args.indexOf('--category');
  const category = catArg >= 0 && args[catArg+1] ? args[catArg+1] : null;
  const sportArg = args.indexOf('--sport');
  const sport = sportArg >= 0 && args[sportArg+1] ? args[sportArg+1] : null;
  const cardsArg = args.indexOf('--cards');
  const cardCount = cardsArg >= 0 && args[cardsArg+1] ? parseInt(args[cardsArg+1]) : undefined;
  const themeArg = args.indexOf('--theme');
  const collTheme = themeArg >= 0 && args[themeArg+1] ? args[themeArg+1] : null;
  const seedArg = args.indexOf('--seed');
  const seed = seedArg >= 0 && args[seedArg+1] ? normalizeSeed(args[seedArg+1]) : undefined;
  
  const options = {};
  if (sport) options.sport = sport;
  if (cardCount) options.cards = cardCount;
  if (collTheme) options.theme = collTheme;
  if (seed !== undefined) options.seed = seed;
  
  const s=generateSet(category || 'character', options);
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  🎴 NEW SET GENERATED`);console.log(`${'═'.repeat(50)}`);
  console.log(`  Set: ${s.name} (${s.code})`);console.log(`  Year: ${s.year}`);console.log(`  Category: ${s.category}`);
  console.log(`  Cards: ${s.cards.length}`);console.log(`  Wallet: ${fm$(loadCfg().wallet)}`);
  const bt={};for(const c of s.cards)bt[c.starTier]=(bt[c.starTier]||0)+1;
  for(const t of TIERS)console.log(`    ${pR(t.name,12)} ${bt[t.name]||0}`);
  console.log(`${'═'.repeat(50)}\n`);
}

function cmdOpenPack(type){
  ensureSet();const pt=type||'hobby';if(!PACKS[pt]){console.log(`Unknown: ${pt}`);return}
  const set=loadSet();const real=isReal();
  const cfg=loadCfg();const baseCost=PACKS[pt].price/PACKS[pt].packs;
  const col=real?loadCol():null;
  const usedOwned=real&&col&&getSealedQty(col,pt)>0;
  const cost=usedOwned?0:baseCost;
  if(real){
    if(!usedOwned&&cfg.wallet<cost){console.log(`\n  ❌ Need ${fm$(cost)}, have ${fm$(cfg.wallet)}\n`);return}
    var beforeWallet=cfg.wallet;
    if(usedOwned){
      consumeSealedProduct(col,pt,1);
      col.wallet=cfg.wallet;
      saveCol(col);
    } else {
      cfg.wallet-=cost;saveCfg(cfg);
      col.wallet=cfg.wallet;
      col.stats.spent+=cost;
    }
    col.stats.packs++;
    var prevColLen=col.cards.length;
  }
  const packTracker=real?createAcquisitionTracker(col,{opType:'open-pack',packType:pt,packIndex:col?col.stats.packs:null}):null;
  const{pack}=pullCards(set,col,pt,packTracker);
  if(real){
    rebuildPulls(col);saveCol(col);
    // Catch up the secondary market by elapsed tick time since the last operation.
    const market=initMarket(set);
    catchUpMarketToNow(set,market,col);
    market.lastPackOpened=Date.now();
    saveMarket(market.setKey,market);
    rebuildPulls(col);saveCol(col);
    updateChecklist(set,col);
    const costLabel=usedOwned?'owned sealed':fm$(cost);
    logHistory('open-pack',`${PACKS[pt].name} (${costLabel})`,beforeWallet,cfg.wallet,{setCode:set.code,cardsAdded:col.cards.length-prevColLen,packType:pt,source:usedOwned?'inventory':'purchase'});
  }
  const tv=pack.reduce((s,c)=>s+c.price,0);const roi=cost>0?((tv-cost)/cost*100):0;
  const modeTag=real?(usedOwned?' [OWNED]':' [PURCHASED]'):' [DRY RUN]';
  const packNum=real&&col?' #'+col.stats.packs:'';
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📦 ${PACKS[pt].name.toUpperCase()}${packNum} — ${set.name} ${set.year}${modeTag}`);
  if(real){
    console.log(`  Source: ${usedOwned?'owned sealed inventory':'fresh purchase from wallet'}`);
  }
  console.log(`${'═'.repeat(52)}`);
  let newCount=0,dupCount=0;
  pack.forEach((c,i)=>{
    const isDup=Boolean(c.acquiredIsDuplicate);
    if(isDup)dupCount++;else newCount++;
    console.log(fmtCard(c,i+1,set,isDup?c.acquiredCopyIndex:0));
    console.log('');
  });
  console.log(`${'─'.repeat(52)}`);
  console.log(`  Value: ${fm$(tv)} | Cost: ${fm$(cost)} | ROI: ${cost>0?(roi>=0?'+':'')+roi.toFixed(1)+'%':'n/a'}`);
  if(real){
    console.log(`  New: ${newCount} | Duplicates: ${dupCount} | Wallet: ${fm$(cfg.wallet)}`);
    setLastAcquisitionBatch(col,packTracker,{newCount,duplicateCount:dupCount,cardCount:pack.length});
    saveCol(col);
  } else {
    console.log(`  Wallet: untouched (virtual)`);
  }
  console.log(`${'─'.repeat(52)}\n`);
}

function cmdOpenBox(type){
  ensureSet();const pt=type||'hobby';if(!PACKS[pt]){console.log(`Unknown: ${pt}`);return}
  const set=loadSet();const real=isReal();const cfg=loadCfg();const bp=PACKS[pt].price;
  const col=real?loadCol():null;
  const usedOwned=real&&col&&getSealedQty(col,pt)>0;
  if(real){
    if(!usedOwned&&cfg.wallet<bp){console.log(`\n  ❌ Need ${fm$(bp)}, have ${fm$(cfg.wallet)}\n`);return}
    var beforeWallet=cfg.wallet;
    if(usedOwned){
      consumeSealedProduct(col,pt,1);
      col.wallet=cfg.wallet;
      saveCol(col);
    } else {
      cfg.wallet-=bp;saveCfg(cfg);
      col.wallet=cfg.wallet;
      col.stats.spent+=bp;
    }
    col.stats.boxes++;
    var prevColLen=col.cards.length;
  }
  const np=PACKS[pt].packs;let tv=0,th=0,boxBest=null,totalNew=0,totalDup=0;
  const displayCost=usedOwned?0:bp;
  const modeTag=real?(usedOwned?' [OWNED]':' [PURCHASED]'):' [DRY RUN]';
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📦📦 ${PACKS[pt].name.toUpperCase()} — ${set.name} ${set.year}${modeTag}`);
  console.log(`  ${np} packs × ${PACKS[pt].cpp} cards`);
  if(real){
    console.log(`  Source: ${usedOwned?'owned sealed inventory':'fresh purchase from wallet'}`);
  }
  console.log(`${'═'.repeat(52)}`);
  for(let p=0;p<np;p++){
    if(real){
      col.stats.packs++;
    }
    const packTracker=real?createAcquisitionTracker(col,{opType:'open-box',packType:pt,packIndex:p+1}):null;
    const{pack,hc}=pullCards(set,col,pt,packTracker);th+=hc;
    const pv=pack.reduce((s,c)=>s+c.price,0);tv+=pv;
    const pb=pack.reduce((a,b)=>b.price>a.price?b:a,pack[0]);
    if(!boxBest||pb.price>boxBest.price)boxBest=pb;
    console.log(`\n  ── Pack ${p+1}/${np} ─────────────────────────`);
    pack.forEach((c,i)=>{
      const isDup=Boolean(c.acquiredIsDuplicate);
      if(isDup)totalDup++;else totalNew++;
      console.log(fmtCard(c,i+1,set,isDup?c.acquiredCopyIndex:0));
      console.log('');
    });
    if(real){
      setLastAcquisitionBatch(col,packTracker,{newCount:pack.filter(c=>!c.acquiredIsDuplicate).length,duplicateCount:pack.filter(c=>c.acquiredIsDuplicate).length,cardCount:pack.length});
    }
    console.log(`    Pack ${p+1}: ${fm$(pv)} | ${hc} hit${hc!==1?'s':''}`);
  }
  if(real){
    // Catch up the secondary market by elapsed tick time since the last operation.
    const market=initMarket(set);
    catchUpMarketToNow(set,market,col);
    market.lastPackOpened=Date.now();
    saveMarket(market.setKey,market);
    rebuildPulls(col);saveCol(col);
    updateChecklist(set,col);
    saveCol(col);
    const costLabel=usedOwned?'owned sealed':fm$(bp);
    logHistory('open-box',`${PACKS[pt].name} (${costLabel})`,beforeWallet,cfg.wallet,{setCode:set.code,cardsAdded:col.cards.length-prevColLen,packType:pt,packsInBox:np,source:usedOwned?'inventory':'purchase'});
  }
  const roi=displayCost>0?((tv-displayCost)/displayCost*100):0;
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Cards: ${np*PACKS[pt].cpp} | Value: ${fm$(tv)} | Cost: ${fm$(displayCost)}`);
  console.log(`  ROI: ${real&&usedOwned?'n/a':(roi>=0?'+':'')+roi.toFixed(1)+'%'} | Hits: ${th}`);
  if(real){
    console.log(`  New: ${totalNew} | Duplicates: ${totalDup} | 1/1s: ${col.stats.oneOfOnes}`);
    console.log(`  Wallet: ${fm$(cfg.wallet)}`);
  } else {
    console.log(`  1/1s: — | Wallet: untouched (virtual)`);
  }
  if(boxBest)console.log(`  🏆 Best: ${boxBest.name} — ${boxBest.parallel} ${fm$(boxBest.price)}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdPortfolio(){
  const cfg=loadCfg();
  // load all collections
  const colDir=path.join(DATA_DIR,'collections');
  const files=fs.readdirSync(colDir).filter(f=>f.endsWith('.json'));
  let totalCards=0,totalValue=0,totalSpent=0,totalHits=0,totalOnes=0,setsInfo=[];
  for(const f of files){
    const col=rJ(path.join(colDir,f));if(!col)continue;
    const setPath=path.join(DATA_DIR,'sets',col.setKey+'.json');
    const set=rJ(setPath);
    const uniqNums=new Set();
    for(const c of col.cards) uniqNums.add(c.cardNum);
    const uniq=uniqNums.size;
    const setSize=set?set.cards.length:0;
    const sealedValue=getSealedInventoryValue(col);
    const comp=setSize>0?(uniq/setSize*100):0;
    setsInfo.push({key:col.setKey,name:set?`${set.name} ${set.year}`:col.setKey,total:col.stats.total,uniq,setSize,comp,
      value:col.stats.value,sealedValue,spent:col.stats.spent,hits:col.stats.hits,ones:col.stats.oneOfOnes,best:col.bestPull,
      col});
    totalCards+=col.stats.total;totalValue+=col.stats.value;totalSpent+=col.stats.spent;
    totalHits+=col.stats.hits;totalOnes+=col.stats.oneOfOnes;
  }
  const totalSealedValue=setsInfo.reduce((s,i)=>s+i.sealedValue,0);
  const pl=totalValue+totalSealedValue-totalSpent;const pp=totalSpent>0?(pl/totalSpent*100):0;
  const totalUniq=setsInfo.reduce((s,i)=>s+i.uniq,0);
  const totalBase=setsInfo.reduce((s,i)=>s+i.setSize,0);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 PORTFOLIO`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  💰 Cash:             ${fm$(cfg.wallet)}`);
  console.log(`  🃏 Collection:       ${fm$(totalValue)} (${totalCards} cards, ${totalUniq} unique)`);
  console.log(`  📦 Sealed inventory: ${fm$(totalSealedValue)}`);
  console.log(`  📈 Net Worth:        ${fm$(cfg.wallet+totalValue+totalSealedValue)}`);
  console.log(`  📉 P/L:              ${pl>=0?'+':''}${fm$(pl)} (${pp>=0?'+':''}${pp.toFixed(1)}%)`);
  console.log(`  📊 Set Completion:   ${totalBase>0?(totalUniq/totalBase*100).toFixed(1):'0.0'}%`);
  console.log(`  💎 Hits / 1/1s:      ${totalHits} / ${totalOnes}`);
  console.log(`  📦 Packs opened:     ${setsInfo.reduce((s,i)=>s+i.col.stats.packs,0)}`);
  console.log(`${'─'.repeat(52)}`);
  if(setsInfo.length>1){
    console.log(`  SETS:`);
    setsInfo.forEach(si=>{
      const icon=si.comp>=100?'✅':si.comp>=50?'🟡':'🔴';
      console.log(`   ${icon} ${pR(si.name,30)} ${String(si.uniq).padStart(3)}/${String(si.setSize).padStart(3)} (${si.comp.toFixed(0)}%) ${fm$(si.value).padStart(10)}`);
    });
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdCollection(){
  const cfg=loadCfg();
  // optional set filter from args
  const filterArg=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='collection');
  const colDir=path.join(DATA_DIR,'collections');
  const files=fs.readdirSync(colDir).filter(f=>f.endsWith('.json'));
  if(!files.length){console.log(`\n  ❌ No collections found.\n`);return}
  let shown=0;
  for(const f of files){
    const col=rJ(path.join(colDir,f));if(!col||!col.cards.length)continue;
    const setPath=path.join(DATA_DIR,'sets',col.setKey+'.json');
    const set=rJ(setPath);
    const setName=set?`${set.name} ${set.year}`:col.setKey;
    const setCode=set?set.code:'???';
    // filter by set code or name if arg provided
    if(filterArg&&!(col.setKey.toLowerCase().includes(filterArg.toLowerCase())||
      setCode.toLowerCase().includes(filterArg.toLowerCase())||
      setName.toLowerCase().includes(filterArg.toLowerCase())))continue;
    shown++;
    const ownedByNum={};
    const ownedCount={};
    for(const c of col.cards){
      (ownedByNum[c.cardNum]||(ownedByNum[c.cardNum]=[])).push(c);
      ownedCount[c.cardNum]=(ownedCount[c.cardNum]||0)+1;
    }
    const uniq=Object.keys(ownedByNum).length;
    const setSize=set?set.cards.length:0;
    // group cards by star tier
    const groups={Common:[],Uncommon:[],Star:[],Superstar:[],Legendary:[]};
    col.cards.forEach(c=>{(groups[c.starTier]||groups.Common).push(c)});
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  🃏 ${setName} (${setCode})`);
    console.log(`  ${uniq}/${setSize} unique (${setSize>0?(uniq/setSize*100).toFixed(1):0}%) | ${col.cards.length} cards | ${fm$(col.stats.value)}`);
    if(col.sealedInventory&&Object.keys(col.sealedInventory).length){
      console.log(`  Sealed inventory: ${formatSealedInventorySummary(col)} (${fm$(getSealedInventoryValue(col))})`);
    }
    console.log(`${'═'.repeat(52)}`);
    // need set ref for fmtCard
    const setRef=set||{code:setCode};
    // show by tier, best cards per unique card number (most valuable parallel)
    const bestByNum={};
    for(const c of col.cards){
      if(!bestByNum[c.cardNum]||c.price>bestByNum[c.cardNum].price)bestByNum[c.cardNum]=c;
    }
    // sort by card number
    const entries=Object.entries(bestByNum).sort((a,b)=>a[0].localeCompare(b[0],'en',{numeric:true}));
    // group by tier for display
    for(const tierName of['Legendary','Superstar','Star','Uncommon','Common']){
      const tierCards=entries.filter(([,c])=>c.starTier===tierName);
      if(!tierCards.length)continue;
      const te=TIER_EMOJI[tierName]||'';
      console.log(`\n  ${te} ${tierName.toUpperCase()} (${tierCards.length}/${set?set.cards.filter(c=>c.starTier===tierName).length:tierCards.length}):`);
      for(const[num,c]of tierCards){
        const owned=ownedCount[num]||1;
        console.log(fmtCard(c,parseInt(num),setRef,owned>1?owned:0));
        const allCopies=(ownedByNum[num]||[]).slice().sort((a,b)=>b.price-a.price);
        if(allCopies.length>1){
          for(let ci=1;ci<allCopies.length;ci++){
            const ac=allCopies[ci];
            const pe2=PAR_EMOJI[ac.parallel]||'';
            const parDisp2=pe2?pe2+' '+ac.parallel:ac.parallel;
            const ser2=ac.serStr?' '+ac.serStr:'';
            const aq=ac.quality;
            const hint2=typeof aq==='string'?aq:(aq?.hints?.slice(0,1).join('; ')||'');
            const gLabel2=ac.graded?`G${ac.grade} `:'';
            console.log(`     └ ${parDisp2}${ser2} │ ${gLabel2}${hint2} │ ${fm$(ac.price)}`);
          }
        }
        console.log('');
      }
    }
    console.log(`${'─'.repeat(52)}`);
  }
  if(!shown){
    if(filterArg)console.log(`\n  No cards found matching "${filterArg}".\n`);
    else console.log(`\n  All collections are empty.\n`);
  } else {
    console.log(`\n  💰 Wallet: ${fm$(cfg.wallet)} | Use "portfolio" for full financial overview\n`);
  }
}

function cmdSetInfo(){
  ensureSet();const set=loadSet();if(!set)return;
  const parallels=resolveParallels(set);
  const cardTypes=resolveCardTypes(set);
  const inserts=resolveInserts(set);
  const meta=set.metadata||{};
  const creative=meta.creativeDirection||{};
  const identity=meta.productIdentity||{};
  console.log(`\n${'═'.repeat(50)}`);console.log(`  📖 SET INFO — ${set.name} (${set.code})`);console.log(`${'═'.repeat(50)}`);
  if(set.themeName&&set.themeName!==set.name) console.log(`  Theme: ${set.themeName}`);
  if(meta.productLine) console.log(`  Product Line: ${meta.productLine}`);
  if(meta.brandFamily) console.log(`  Brand Family: ${meta.brandFamily}`);
  console.log(`  Category: ${set.category}`);
  if (set.setCategory) console.log(`  Set Type: ${CAT.CATEGORY_LABELS[set.setCategory] || set.setCategory}`);
  if (set.sport) console.log(`  Sport: ${CAT.SPORTS[set.sport]?.label || set.sport}`);
  if (set.propertySynopsis) console.log(`  Synopsis: ${set.propertySynopsis}`);
  if (set.propertyGenre) console.log(`  Genre: ${set.propertyGenre}`);
  if (set.collectionTheme) console.log(`  Theme: ${set.collectionTheme}`);
  if (set.seasons) console.log(`  Seasons: ${set.seasons}`);
  if(identity.collectorHook) console.log(`  Hook: ${identity.collectorHook}`);
  if(meta.tagline) console.log(`  Tagline: ${meta.tagline}`);
  console.log(`  Year: ${set.year}`);console.log(`  Cards: ${set.cards.length}`);
  console.log(`  Created: ${set.created}`);
  if(set.aiGenerated)console.log(`  Generated: AI (${set.aiGenerated!==true?'yes':'yes'})`);
  if(creative.artisticStyle||creative.layoutStyle||creative.finishProfile){
    console.log(`  Visuals: ${creative.artisticStyle||'n/a'} │ ${creative.layoutStyle||'n/a'} │ ${creative.finishProfile||'n/a'}`);
  }
  if(meta.releaseWindow||meta.marketPosition){
    console.log(`  Market: ${meta.marketPosition||'n/a'}${meta.releaseWindow?` │ ${meta.releaseWindow}`:''}`);
  }
  const bt={};for(const c of set.cards)bt[c.starTier]=(bt[c.starTier]||0)+1;
  console.log(`  Star Tiers:`);for(const t of TIERS)console.log(`    ${pR(t.name,12)} ${bt[t.name]||0}`);
  const bs={};for(const c of set.cards)bs[c.subset]=(bs[c.subset]||0)+1;
  console.log(`  Subsets:`);for(const s of SUBS)console.log(`    ${pR(s.name,12)} ${bs[s.name]||0}`);
  if(meta.chaseArchitecture?.parallelFamilies?.length){
    console.log(`\n  Parallel Families:`);
    for(const fam of meta.chaseArchitecture.parallelFamilies.slice(0,8)){
      const count=fam.count!=null?` (${fam.count})`:'';
      console.log(`    ${fam.family}${count}`);
    }
  }
  if(meta.chaseArchitecture?.chaseNarrative){
    console.log(`  Chase Thesis: ${meta.chaseArchitecture.chaseNarrative}`);
  }
  console.log(`\n  Parallels (${parallels.length}):`);
  for(const p of parallels){
    const pm=p.pm||p.priceMultiplier||1;
    const serTag=p.ser||p.serial?(typeof(p.ser||p.serial)==='object'?`/${(p.ser||p.serial).min}-${(p.ser||p.serial).max}`:`/${p.ser||p.serial}`):'';
    const col=p.color?` [${p.color}]`:'';
    console.log(`    ${pR(p.name,20)} T${p.tier} ${serTag.padEnd(10)} ${pm}x${col}`);
  }
  console.log(`\n  Card Types (${cardTypes.length}):`);
  for(const ct of cardTypes){
    const fmt=ct.format?` [${ct.format}]`:'';
    const sub=ct.subtype?` (${ct.subtype})`:'';
    console.log(`    ${pR(ct.name,20)} ×${ct.priceMultiplier}${fmt}${sub} — ${ct.desc||''}`);
  }
  if(inserts.length){
    console.log(`\n  Insert Sets (${inserts.length}):`);
    for(const ins of inserts){
      const parList=(ins.parallels||[]).join(', ');
      console.log(`    ${pR(ins.name,25)} ${ins.size} cards  1:${ins.odds}  $${(ins.basePrice||[5,15])[0]}-${(ins.basePrice||[5,15])[1]}`);
      if(parList)console.log(`      Parallels: ${parList}`);
      if(ins.description)console.log(`      ${ins.description}`);
    }
  }
  console.log(`\n  Sample Cards:`);
  for(let i=0;i<5&&i<set.cards.length;i++){
    const c=set.cards[i];console.log(`    ${set.code}-${c.num} ${c.name} [${c.starTier}/${c.subset}]`);console.log(`      ${c.desc}`)}
  console.log(`${'═'.repeat(50)}\n`);
}

function cmdCardTypes(){
  ensureSet();const set=loadSet();if(!set)return;
  const parallels=resolveParallels(set);
  const cardTypes=resolveCardTypes(set);
  const inserts=resolveInserts(set);
  const isCustom=set.parallels&&set.parallels.length;
  const isCustomTypes=set.cardTypes&&set.cardTypes.length;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🎴 CARD TYPE SYSTEM — ${set.name} (${set.code})`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Parallels:  ${isCustom?'CUSTOM':'DEFAULT'} (${parallels.length} tiers)`);
  console.log(`  Card Types: ${isCustomTypes?'CUSTOM':'DEFAULT'} (${cardTypes.length} types)`);
  console.log(`  Inserts:    ${inserts.length} insert sets`);
  console.log(`\n  ${'─'.repeat(52)}`);
  console.log(`  PARALLEL TIERS:`);
  for(const p of parallels){
    const pm=p.pm||p.priceMultiplier||1;
    const serTag=p.num?(typeof(p.ser||p.serial)==='object'?`/${(p.ser||p.serial).min}-${(p.ser||p.serial).max}`:`/${p.ser||p.serial}`):(p.ser||p.serial?`/${p.ser||p.serial}`:'');
    const odds=`1:${p.odds}`;
    console.log(`  T${String(p.tier).padStart(2)} ${pR(p.name,22)} ${odds.padEnd(8)}${serTag.padEnd(10)} ${pm}x`);
  }
  console.log(`\n  ${'─'.repeat(52)}`);
  console.log(`  CARD TYPES:`);
  for(const ct of cardTypes){
    const fmtInfo=ct.format?CARD_FORMATS[ct.format]:null;
    const fmtTag=fmtInfo?`${fmtInfo.emoji} ${ct.format}`:'';
    console.log(`  ${pR(ct.name,22)} rarity:${(ct.rarity*100).toFixed(1).padStart(5)}%  ×${String(ct.priceMultiplier).padStart(5)}  ${fmtTag}`);
    if(ct.subtype)console.log(`    subtype: ${ct.subtype}`);
    if(ct.desc)console.log(`    ${ct.desc}`);
  }
  if(inserts.length){
    console.log(`\n  ${'─'.repeat(52)}`);
    console.log(`  INSERT SETS:`);
    for(const ins of inserts){
      const pr=(ins.basePrice||[5,15]);
      console.log(`  ${pR(ins.name,25)} ${ins.size} cards | 1:${ins.odds} | $${pr[0]}-$${pr[1]}`);
      if(ins.parallels?.length)console.log(`    Parallels: ${ins.parallels.join(', ')}`);
      if(ins.description)console.log(`    ${ins.description}`);
    }
  }
  console.log(`\n  ${'─'.repeat(52)}`);
  console.log(`  CARD FORMATS:`);
  for(const[id,f]of Object.entries(CARD_FORMATS)){
    console.log(`  ${f.emoji} ${pR(id,14)} ${f.mult}x value  ${f.name}`);
  }
  console.log(`\n  AUTO TYPES:  ${AUTO_TYPES.map(a=>a.name).join(', ')}`);
  console.log(`  RELIC TYPES: ${RELIC_TYPES.map(r=>r.name).join(', ')}`);
  console.log(`  RELIC QUAL:  ${RELIC_QUALITY.map(r=>r.name+':'+r.mult+'x').join(', ')}`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdNewSeason(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  if(col&&col.cards.length>0){
    const archive={setKey:col.setKey,stats:{...col.stats},bestPull:col.bestPull,
      totalCards:col.cards.length,uniqueCards:new Set(col.cards.map(c=>c.cardNum)).size,archivedAt:new Date().toISOString()};
    cfg.archivedSets=cfg.archivedSets||[];cfg.archivedSets.push(archive);saveCfg(cfg);
    console.log(`\n  📁 Archived: ${set.name} (${set.code}) — ${col.cards.length} cards, ${fm$(col.stats.value)} value`);
  }
  const ns=generateSet();console.log(`  🎴 New season: ${ns.name} (${ns.code})\n`);
}

// ─── SECONDARY MARKET ───────────────────────────────────────────────

// ─── SECONDARY MARKET ───────────────────────────────────────────────

function loadMarket(setKey){
  return rJ(path.join(DATA_DIR,'sets',setKey,'market.json'))||null;
}

function getMarketCardList(market){
  return market.cardList||Object.values(market.cards||{});
}

function saveMarket(setKey,m){
  const dir=path.join(DATA_DIR,'sets',setKey);
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  wJ(path.join(dir,'market.json'),m);
}

function normalizeMarketEvents(market){
  if(!market||!Array.isArray(market.events)) return market;
  const normalized=[];
  const sorted=[...market.events].sort((a,b)=>(a.tick||0)-(b.tick||0));
  for(const event of sorted){
    const existing=normalized.find(prev=>{
      if(prev.type!==event.type) return false;
      const prevEnd=(prev.tick||0)+(prev.duration||14);
      const nextEnd=(event.tick||0)+(event.duration||14);
      return (event.tick||0)<=prevEnd && (prev.tick||0)<=nextEnd;
    });
    if(existing){
      existing.stackCount=(existing.stackCount||1)+1;
      existing.baseDesc=existing.baseDesc||existing.desc||event.desc;
      existing.magnitude=Math.round((existing.magnitude+event.magnitude)*1000)/1000;
      existing.duration=Math.max(existing.duration||0,event.duration||0,(event.tick||0)-(existing.tick||0)+1);
      existing.desc=formatMarketEventDesc(getMarketEventProfile(existing.type), existing.stackCount);
      continue;
    }
    const stackCount=event.stackCount||1;
    normalized.push({
      ...event,
      stackCount,
      baseDesc:event.baseDesc||event.desc,
      desc:formatMarketEventDesc(getMarketEventProfile(event.type), stackCount),
    });
  }
  market.events=normalized;
  return market;
}

const MACRO_FILE=path.join(DATA_DIR,'market-macro.json');

function loadMacroState(){
  return rJ(MACRO_FILE)||{lastFetch:0,source:'FRED SP500',label:'neutral',signal:0,weekPct:0,monthPct:0,compositePct:0};
}

function saveMacroState(state){
  wJ(MACRO_FILE,state);
}

function fetchMacroState(){
  let raw='';
  try{
    const fetchScript = `
const https = require('https');
const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500';
const req = https.get(url, (res) => {
  if (res.statusCode !== 200) {
    res.resume();
    process.exit(1);
    return;
  }
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => process.stdout.write(data));
});
req.setTimeout(8000, () => req.destroy(new Error('timeout')));
req.on('error', () => process.exit(1));
    `.trim();
    raw=execFileSync(process.execPath,['-e',fetchScript],{encoding:'utf8',timeout:9000,maxBuffer:1024*1024,stdio:['ignore','pipe','ignore']});
  } catch{
    return null;
  }

  const lines=raw.trim().split(/\r?\n/);
  if(lines.length<3) return null;
  const points=[];
  for(const line of lines.slice(1)){
    const [date,value]=line.split(',');
    const num=parseFloat(value);
    if(date&&Number.isFinite(num)) points.push({date,value:num});
  }
  if(points.length<6) return null;

  const latest=points[points.length-1];
  const week=points[Math.max(0, points.length-6)];
  const month=points[Math.max(0, points.length-21)];
  const weekPct=((latest.value-week.value)/week.value)*100;
  const monthPct=((latest.value-month.value)/month.value)*100;
  const compositePct=monthPct*0.7+weekPct*0.3;
  const signal=Math.max(-1,Math.min(1,compositePct/15));
  const label=signal>0.35?'bullish':signal<-0.35?'bearish':'neutral';

  return {
    lastFetch:Date.now(),
    source:'FRED SP500',
    updatedAt:new Date().toISOString(),
    latest,
    week,
    month,
    weekPct,
    monthPct,
    compositePct,
    signal,
    label,
  };
}

function getMacroState(force=false){
  const cached=loadMacroState();
  const ageMs=Date.now()-(cached.lastFetch||0);
  const maxAgeMs=48*60*60*1000;
  if(!force&&cached.lastFetch&&ageMs<maxAgeMs) return cached;
  const fresh=fetchMacroState();
  if(fresh){
    saveMacroState(fresh);
    return fresh;
  }
  return cached;
}

function clamp01(v){
  return Math.max(0,Math.min(1,v));
}

function hashStringSeed(str){
  let h=0;
  for(let i=0;i<str.length;i++) h=((h<<5)-h)+str.charCodeAt(i);
  return Math.abs(h|0);
}

function getSimulationDate(day){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+day);
  return d;
}

function floppsDefaultCorporation(){
  return {
    scarcityIndex:0.58,
    hypeIndex:0.54,
    extractionIndex:0.61,
    collectorStress:0.57,
    retailerStress:0.46,
    laborStress:0.41,
    lobbyingHeat:0.28,
    trustMask:0.44,
    allocationTightness:0.52,
    releasePace:0.74,
    partnerHeat:0.38,
    guidance:'disciplined growth through elevated collector engagement',
    activePhase:'planning',
    executiveFocus:'portfolio',
  };
}

function ensureFloppsStateShape(state){
  const next=state||{};
  if(!next.stock) next.stock={price:100, history:[]};
  if(!Array.isArray(next.stock.history)) next.stock.history=[];
  if(!Array.isArray(next.newsHistory)) next.newsHistory=[];
  if(typeof next.lastNewsDay!=='number') next.lastNewsDay=-1;
  if(typeof next.lastStockDay!=='number') next.lastStockDay=-1;
  if(typeof next.lastSeenDay!=='number') next.lastSeenDay=-1;
  if(!next.corporation) next.corporation=floppsDefaultCorporation();
  next.corporation={...floppsDefaultCorporation(), ...next.corporation};
  if(!Array.isArray(next.calendar)) next.calendar=[];
  if(!Array.isArray(next.dayHistory)) next.dayHistory=[];
  if(!next.trendDesk) next.trendDesk={lastRefreshDay:-1,lastCommitteeCycle:-1,watchlist:[],chosenHistory:[]};
  if(!Array.isArray(next.trendDesk.watchlist)) next.trendDesk.watchlist=[];
  if(!Array.isArray(next.trendDesk.chosenHistory)) next.trendDesk.chosenHistory=[];
  if(!Array.isArray(next.announcementHistory)) next.announcementHistory=[];
  return next;
}

function loadFloppsState(){
  return ensureFloppsStateShape(rJ(FLOPPS_STATE_FILE));
}

function saveFloppsState(state){
  wJ(FLOPPS_STATE_FILE,ensureFloppsStateShape(state));
}

function slugifyFloppsText(value){
  return String(value||'wildcard')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,48)||'wildcard';
}

function buildFloppsReleaseCalendar(set, startDay=0){
  const baseCode=set?.code||'FLP';
  const baseName=set?.name||'Flagship';
  const entries=[];
  for(let i=0;i<9;i++){
    const launchDay=startDay+(i*45);
    const line=FLOPPS_PRODUCT_LINES[i%FLOPPS_PRODUCT_LINES.length];
    const partner=FLOPPS_PARTNERS[i%FLOPPS_PARTNERS.length];
    const seasonTag=`${new Date().getFullYear()}-${String(i+1).padStart(2,'0')}`;
    entries.push({
      code:`${baseCode}-${seasonTag}`,
      title:i===0?`${baseName} ${line}`:`${line} ${seasonTag}`,
      day:launchDay,
      partner,
      category:i%3===0?'sports':i%3===1?'entertainment':'premium',
      channel:i%4===0?'hobby':i%4===1?'retail':i%4===2?'dutch-auction':'instant-drop',
      cadenceDays:45,
    });
  }
  return entries;
}

function scoreFloppsTrendCandidate(candidate, day, corp){
  const simDate=getSimulationDate(day);
  const month=simDate.getMonth();
  const nearestWindow=Math.min(...candidate.windowMonths.map((m)=>{
    const direct=Math.abs(month-m);
    return Math.min(direct, 12-direct);
  }));
  const proximityBonus=Math.max(0,0.24-(nearestWindow*0.05));
  const seeded=mulberry32(hashStringSeed(`${candidate.name}:${day}:${corp.activePhase}`));
  const trendProxy=0.35+(seeded()*0.45);
  const formatBonus=
    candidate.formatBias==='premium'?corp.extractionIndex*0.12:
    candidate.formatBias==='chrome'?corp.hypeIndex*0.1:
    candidate.formatBias==='heritage'?(1-corp.releasePace)*0.08:
    0.05;
  const marketability=clamp01(candidate.base*0.45+trendProxy*0.3+proximityBonus+formatBonus+corp.partnerHeat*0.08);
  return {
    ...candidate,
    trendProxy:Math.round(trendProxy*1000)/1000,
    proximityBonus:Math.round(proximityBonus*1000)/1000,
    marketability:Math.round(marketability*1000)/1000,
  };
}

function ensureFloppsTrendDesk(state, day){
  const corp=state.corporation||floppsDefaultCorporation();
  if(!state.trendDesk.watchlist.length || day-state.trendDesk.lastRefreshDay>=14){
    state.trendDesk.watchlist=FLOPPS_TREND_CANDIDATES
      .map((candidate)=>scoreFloppsTrendCandidate(candidate, day, corp))
      .sort((a,b)=>b.marketability-a.marketability);
    state.trendDesk.lastRefreshDay=day;
  }
  const committeeCycle=Math.floor(day/45);
  if(state.trendDesk.lastCommitteeCycle!==committeeCycle){
    const chosen=state.trendDesk.watchlist[0];
    if(chosen){
      state.trendDesk.chosenHistory.push({
        day,
        cycle:committeeCycle,
        name:chosen.name,
        partner:chosen.partner,
        category:chosen.category,
        marketability:chosen.marketability,
      });
      const target=state.calendar.find((entry)=>entry.day>=day+30 && entry.selectionCycle==null);
      if(target){
        target.selectionCycle=committeeCycle;
        target.licenseName=chosen.name;
        target.partner=chosen.partner;
        target.marketability=chosen.marketability;
        target.title=`${chosen.name} ${target.channel==='instant-drop'?'Instant':'Collectors'} Set`;
      }
    }
    state.trendDesk.lastCommitteeCycle=committeeCycle;
  }
  if(state.trendDesk.chosenHistory.length>24) state.trendDesk.chosenHistory=state.trendDesk.chosenHistory.slice(-24);
}

function ensureFloppsReleaseCalendar(state, set, currentDay){
  if(!state.calendar.length){
    state.calendar=buildFloppsReleaseCalendar(set, Math.max(0,currentDay-(currentDay%45)));
  }
  const lastDay=state.calendar[state.calendar.length-1]?.day??0;
  if(lastDay<currentDay+240){
    const extension=buildFloppsReleaseCalendar(set, lastDay+45).slice(0,4);
    state.calendar=state.calendar.concat(extension);
  }
  if(state.calendar.length>16) state.calendar=state.calendar.slice(-16);
}

function getFloppsReleaseWindow(state, day){
  const cal=Array.isArray(state?.calendar)?state.calendar:[];
  if(!cal.length){
    return {phase:FLOPPS_PHASES[0], current:null, next:null, offset:0};
  }
  let current=cal[0];
  let next=cal[cal.length-1];
  for(let i=0;i<cal.length;i++){
    if(cal[i].day<=day) current=cal[i];
    if(cal[i].day>day){ next=cal[i]; break; }
  }
  const offset=day-(current?.day||0);
  let phase=FLOPPS_PHASES[0];
  if(offset<0) phase=FLOPPS_PHASES[1];
  else if(offset<=5) phase=FLOPPS_PHASES[3];
  else if(offset<=18) phase=FLOPPS_PHASES[4];
  else if(offset<=32) phase=FLOPPS_PHASES[5];
  else phase=FLOPPS_PHASES[2];
  return {phase,current,next,offset};
}

function getFloppsEcosystemSnapshot(setKey){
  const storeState=loadStoreState();
  const scalperState=loadScalperState();
  const defaults=loadDefaultStores();
  const inventories=defaults.map((store)=>{
    const inv=storeState.stores?.[store.id]?.inventory?.[setKey]||{};
    let total=0;
    for(const type of Object.keys(PACKS)){
      total+=(inv[type]||0);
    }
    return {store, total};
  });
  const stockTotal=inventories.reduce((sum, entry)=>sum+entry.total,0);
  const avgStock=inventories.length?stockTotal/inventories.length:0;
  const recentScalperBuys=(scalperState.activityLog||[]).filter((e)=>e.action==='buy'&&Date.now()-e.timestamp<7*24*60*60*1000);
  const recentScalperListings=(scalperState.activityLog||[]).filter((e)=>e.action==='list'&&Date.now()-e.timestamp<7*24*60*60*1000);
  return {
    avgStock,
    stockTotal,
    scalperBuys:recentScalperBuys.reduce((sum,e)=>sum+(e.qty||0),0),
    scalperListings:recentScalperListings.length,
    storeCount:inventories.length,
  };
}

function pickFloppsExecutive(corp, release){
  const dominant=[
    ['allocationTightness','allocation'],
    ['retailerStress','allocation'],
    ['laborStress','labor'],
    ['lobbyingHeat','lobbying'],
    ['hypeIndex','hype'],
    ['extractionIndex','margin'],
    ['releasePace','cadence'],
  ].sort((a,b)=>(corp[b[0]]||0)-(corp[a[0]]||0))[0]?.[1]||'portfolio';
  const phaseDomain=release?.phase?.id==='launch'?'hype':release?.phase?.id==='licensing'?'portfolio':dominant;
  return FLOPPS_EXECUTIVES.find((exec)=>exec.domain===phaseDomain)||FLOPPS_EXECUTIVES[0];
}

function advanceFloppsCorporationState(state, set, market, day){
  ensureFloppsReleaseCalendar(state,set,day);
  ensureFloppsTrendDesk(state,day);
  const corp=state.corporation||floppsDefaultCorporation();
  const eco=getFloppsEcosystemSnapshot(market?.setKey||`${set?.code}-${set?.year}`);
  const release=getFloppsReleaseWindow(state, day);
  const hot=isSetHot(market?.setKey||`${set?.code}-${set?.year}`);
  const demand=getDemandFactor(market?.setKey||`${set?.code}-${set?.year}`);
  const sentiment=market?.sentiment||1;

  corp.hypeIndex=clamp01(0.28+Math.max(0,demand-1)*0.38+(hot?0.12:0)+(release.phase.id==='launch'?0.12:0));
  corp.scarcityIndex=clamp01(
    0.28
    +(eco.avgStock<8?0.18:eco.avgStock<14?0.1:0)
    +Math.min(0.22,eco.scalperBuys/160)
    +(release.phase.id==='sellthrough'?0.08:0)
  );
  corp.extractionIndex=clamp01(0.32+corp.scarcityIndex*0.24+corp.hypeIndex*0.18+(release.phase.id==='launch'?0.06:0));
  corp.collectorStress=clamp01(0.22+corp.hypeIndex*0.25+corp.scarcityIndex*0.2+corp.releasePace*0.14);
  corp.retailerStress=clamp01(
    0.18
    +(eco.avgStock<8?0.22:eco.avgStock<14?0.12:0)
    +corp.allocationTightness*0.22
    +Math.min(0.18,eco.scalperBuys/220)
  );
  corp.laborStress=clamp01(0.2+corp.releasePace*0.18+corp.extractionIndex*0.14+(release.phase.id==='launch'?0.1:0));
  corp.lobbyingHeat=clamp01(0.18+Math.max(0,sentiment-1)*0.15+(corp.extractionIndex*0.12));
  corp.trustMask=clamp01(0.52-corp.extractionIndex*0.18+(release.phase.id==='launch'?0.08:0));
  corp.allocationTightness=clamp01(0.35+corp.scarcityIndex*0.4+corp.retailerStress*0.18);
  corp.releasePace=clamp01(0.55+(release.phase.id==='prelaunch'?0.08:0)+(release.phase.id==='launch'?0.12:0)+(corp.hypeIndex*0.08));
  corp.partnerHeat=clamp01(0.28+(release.phase.id==='licensing'?0.18:0)+(release.next?0.06:0));
  corp.activePhase=release.phase.id;
  corp.executiveFocus=pickFloppsExecutive(corp, release).domain;
  corp.guidance=
    corp.extractionIndex>0.72?'premiumizing the collector funnel while defending disciplined scarcity':
    corp.hypeIndex>0.7?'leaning into engagement velocity across the release calendar':
    corp.retailerStress>0.65?'rebalancing partner allocation with operational clarity':
    'maintaining disciplined growth through steady release sequencing';
  state.corporation=corp;
  const snapshot={
    day,
    phase:release.phase.id,
    title:release.current?.title||null,
    scarcityIndex:corp.scarcityIndex,
    hypeIndex:corp.hypeIndex,
    extractionIndex:corp.extractionIndex,
    collectorStress:corp.collectorStress,
    retailerStress:corp.retailerStress,
    laborStress:corp.laborStress,
    executiveFocus:corp.executiveFocus,
  };
  const existingIdx=state.dayHistory.findIndex((entry)=>entry.day===day);
  if(existingIdx>=0) state.dayHistory[existingIdx]=snapshot;
  else state.dayHistory.push(snapshot);
  if(state.dayHistory.length>180) state.dayHistory=state.dayHistory.slice(-180);
  return {corp, eco, release, executive:pickFloppsExecutive(corp, release)};
}

function getFloppsSimulationContext(set, market, stateOverride){
  const macro=getMacroState();
  const state=ensureFloppsStateShape(stateOverride||loadFloppsState());
  const sentiment=market?.sentiment||1;
  const changePct=market?.setAggregates?.totalChangePct||0;
  const activeEvents=(market?.events||[]).filter(e=>market.tick-e.tick<(e.duration||14));
  const bullish=activeEvents.filter(e=>isBullishMarketEvent(e.type)).length;
  const bearish=activeEvents.filter(e=>isBearishMarketEvent(e.type)).length;
  const hypeBoost=Math.max(-0.12,Math.min(0.12,(sentiment-1)*0.18 + changePct*0.0025));
  const macroTilt=Math.max(-0.08,Math.min(0.08,(macro.signal||0)*0.08));
  const eventTilt=Math.max(-0.12,Math.min(0.12,(bullish-bearish)*0.02));
  const setHeat=Math.max(-0.06,Math.min(0.06,((set?.cards?.length||0)/150-1)*0.015));
  const day=getSimulationDay(market);
  const corpState=advanceFloppsCorporationState(state,set,market,day);
  const corp=corpState.corp;
  return {
    macro,sentiment,changePct,activeEvents,bullish,bearish,hypeBoost,macroTilt,eventTilt,setHeat,
    corporation:corp,
    release:corpState.release,
    executive:corpState.executive,
    ecosystem:corpState.eco,
  };
}

function pickFloppsBulletin(state, ctx, day){
  const pool=[...FLOPPS_BULLETINS];
  if(ctx.sentiment>1.08||ctx.hypeBoost>0.02){
    pool.sort((a,b)=>b.stockDelta-a.stockDelta);
  } else if(ctx.sentiment<0.95||ctx.changePct<0){
    pool.sort((a,b)=>a.stockDelta-b.stockDelta);
  } else {
    pool.sort(() => Math.random() - 0.5);
  }
  const weighted=pool.map((item, idx) => ({item, w:Math.max(0.2, item.weight * (idx < 8 ? 1.3 : 1))}));
  const total=weighted.reduce((sum, entry)=>sum+entry.w,0);
  let roll=Math.random()*total;
  for(const entry of weighted){
    roll-=entry.w;
    if(roll<=0) return entry.item;
  }
  return weighted[0].item;
}

function pickFloppsBulletinByCategory(ctx, category){
  const pool=FLOPPS_BULLETINS.filter((item)=>item.category===category);
  if(!pool.length) return pickFloppsBulletin(null,ctx,0);
  const weighted=pool.map((item)=>({item,w:Math.max(0.2,item.weight||1)}));
  const total=weighted.reduce((sum,entry)=>sum+entry.w,0);
  let roll=Math.random()*total;
  for(const entry of weighted){
    roll-=entry.w;
    if(roll<=0) return entry.item;
  }
  return weighted[0].item;
}

function buildAnnouncementFromBulletin(bulletin, ctx, day, kindOverride){
  const executiveByCategory={
    labor:{name:'Dana Sloane',role:'Chief People Officer'},
    allocation:{name:'Marcus Reed',role:'VP of Allocation'},
    pricing:{name:'Lillian Mercer',role:'CFO'},
    investor:{name:'Mira North',role:'Investor Relations'},
    lobbying:{name:'Reed Harlan',role:'Head of Government Affairs'},
    licensing:{name:'Grant Bell',role:'President of Product'},
    community:{name:'Elena Cross',role:'Chief Marketing Officer'},
    marketplace:{name:'Lillian Mercer',role:'CFO'},
    operations:{name:'Marcus Reed',role:'VP of Allocation'},
    cadence:{name:'Grant Bell',role:'President of Product'},
  };
  const exec=executiveByCategory[bulletin.category]||{name:ctx.executive?.name||'Management',role:ctx.executive?.role||'Executive Office'};
  return {
    kind:kindOverride||bulletin.category||'corporate',
    id:`${bulletin.id}-${day}`,
    title:bulletin.title,
    summary:bulletin.summary,
    paraphrase:bulletin.paraphrase,
    executive:exec.name,
    executiveRole:exec.role,
    stockDelta:bulletin.stockDelta,
  };
}

function updateFloppsStockPrice(state, ctx, bulletin, day){
  const prev=state.stock?.price||100;
  const corp=ctx.corporation||floppsDefaultCorporation();
  const currentPrice=Math.max(12, Math.min(2000,
    prev * (1 + ctx.macroTilt + ctx.hypeBoost + ctx.eventTilt + ctx.setHeat + (corp.extractionIndex-0.5)*0.03 + (corp.hypeIndex-0.5)*0.025 + (bulletin?.stockDelta || 0))
  ));
  state.stock=state.stock||{price:100, history:[]};
  state.stock.price=Math.round(currentPrice*100)/100;
  state.stock.history=Array.isArray(state.stock.history)?state.stock.history:[];
  const point={
    day,
    price:state.stock.price,
    macro:ctx.macro?.signal||0,
    sentiment:ctx.sentiment,
    phase:ctx.release?.phase?.id||null,
    bulletin:bulletin?.id||null,
  };
  const last=state.stock.history[state.stock.history.length-1];
  if(last&&last.day===day) state.stock.history[state.stock.history.length-1]=point;
  else state.stock.history.push(point);
  if(state.stock.history.length>120) state.stock.history=state.stock.history.slice(-120);
}

function formatFloppsNewsBlast(bulletin, state, ctx){
  const price=state.stock?.price||100;
  const mood=ctx.sentiment>1.05?'upbeat':ctx.sentiment<0.95?'tense':'measured';
  const execName=bulletin.executive||ctx.executive?.name||'Management';
  const phase=ctx.release?.phase?.label||'Operating Window';
  const lines=[
    `📰 Flopps desk note: ${bulletin.title}`,
    `The company says ${bulletin.summary}`,
    `Translation: ${bulletin.paraphrase}`,
    `${execName} is carrying this one for ${phase}.`,
    `FLPS now trades at ${fm$(price)} in the fake market, which management is describing as "${mood}".`,
    `Check the corporate blog if you want the official version.`,
  ];
  if(bulletin.marketImpact) lines.splice(4,0,`Market effect: ${bulletin.marketImpact}`);
  if(bulletin.collectorImpact) lines.splice(5,0,`Collector effect: ${bulletin.collectorImpact}`);
  return lines.join('\n');
}

function getFloppsOverlayLines(set, market, {compact=false}={}){
  if(!set||!market) return [];
  const state=loadFloppsState();
  const ctx=getFloppsSimulationContext(set,market,state);
  const latest=state.latestNews||state.newsHistory?.slice(-1)[0]||null;
  const price=state.stock?.price||100;
  const day=getSimulationDay(market);
  const dayLabel=Number.isFinite(day)?day:(state.lastSeenDay>=0?state.lastSeenDay:'n/a');
  const lines=[
    `FLPS ${fm$(price)} | simulation day ${dayLabel}`,
  ];
  lines.push(`  Phase: ${ctx.release?.phase?.label||'Unknown'} | Exec focus: ${ctx.executive?.name||'Management'}`);
  if(state.trendDesk?.watchlist?.[0]){
    lines.push(`  Trend desk: ${state.trendDesk.watchlist[0].name} (${Math.round(state.trendDesk.watchlist[0].marketability*100)}% marketability)`);
  }
  if(latest){
    lines.push(`  Latest bulletin: ${latest.title}`);
    if(!compact){
      lines.push(`  ${latest.summary}`);
      lines.push(`  Translation: ${latest.paraphrase}`);
      lines.push(`  Corporate stress: collectors ${(ctx.corporation?.collectorStress*100||0).toFixed(0)}% | retailers ${(ctx.corporation?.retailerStress*100||0).toFixed(0)}% | labor ${(ctx.corporation?.laborStress*100||0).toFixed(0)}%`);
    }
  } else {
    lines.push(`  Latest bulletin: none recorded yet`);
  }
  return lines;
}

function daysSinceLastFloppsAnnouncement(state, kindFilter=null){
  const items=(state.announcementHistory||[]).filter((item)=>!kindFilter || item.kind===kindFilter);
  if(!items.length) return Infinity;
  return (state.lastSeenDay>=0?state.lastSeenDay:items[items.length-1].day)-items[items.length-1].day;
}

function buildQuarterlyFloppsAnnouncement(state, ctx, day){
  const quarter=Math.floor(day/90)+1;
  const corp=ctx.corporation||floppsDefaultCorporation();
  const guidance=corp.guidance;
  return {
    kind:'quarterly',
    id:`quarterly-${quarter}`,
    title:`Quarter ${quarter} Collector Shareholder Update`,
    summary:`Flopps reaffirmed ${guidance} while highlighting disciplined allocation, premium demand, and durable collector engagement.`,
    paraphrase:`They are doing quarterly earnings theater and translating pressure into polished investor language.`,
    executive:ctx.executive?.name||'Mira North',
    executiveRole:'Investor Relations',
  };
}

function buildScheduledFloppsAnnouncement(state, ctx, day){
  const focusRelease=(ctx.release?.phase?.id==='prelaunch'||ctx.release?.phase?.id==='licensing')?(ctx.release?.next||ctx.release?.current):ctx.release?.current;
  if(!focusRelease) return null;
  const offset=day-(focusRelease.day??day);
  const licenseLabel=focusRelease.licenseName||focusRelease.title;
  if(offset===-21){
    return {
      kind:'licensing',
      id:`licensing-${focusRelease.code||focusRelease.day}`,
      title:`Flopps Signs ${licenseLabel} for a Future Release Window`,
      summary:`Flopps quietly locked a ${licenseLabel} product window after internal marketability testing tied to search interest, release timing, and crossover spend potential.`,
      paraphrase:`They used trend data and release timing to decide what fandom to monetize next.`,
      executive:'Grant Bell',
      executiveRole:'President of Product',
    };
  }
  if(offset===-7){
    return {
      kind:'consumer-blog',
      id:`teaser-${focusRelease.code||focusRelease.day}`,
      title:`Coming Next: ${licenseLabel}`,
      summary:`Flopps published a controlled teaser for ${licenseLabel}, positioning the set as a cultural moment rather than another entry in the calendar.`,
      paraphrase:`They started the prelaunch hype cycle one week out.`,
      executive:'Elena Cross',
      executiveRole:'Chief Marketing Officer',
    };
  }
  if(offset===0){
    return {
      kind:'launch',
      id:`launch-${focusRelease.code||focusRelease.day}`,
      title:`${licenseLabel} Launches Across Priority Channels`,
      summary:`Flopps announced the release of ${licenseLabel} with premium language around allocations, chase depth, and collector excitement.`,
      paraphrase:`Launch day. They are opening the buying funnel as hard as possible.`,
      executive:'Marcus Reed',
      executiveRole:'VP of Allocation',
    };
  }
  if(offset===14){
    return {
      kind:'sellthrough',
      id:`sellthrough-${focusRelease.code||focusRelease.day}`,
      title:`${licenseLabel} Sell-Through Update`,
      summary:`Flopps says ${licenseLabel} outperformed internal demand expectations and validated its premium release discipline.`,
      paraphrase:`Two weeks after launch, they are using sell-through numbers to justify the next squeeze.`,
      executive:'Lillian Mercer',
      executiveRole:'CFO',
    };
  }
  return null;
}

function buildExceptionalFloppsAnnouncement(state, ctx, day){
  const corp=ctx.corporation||floppsDefaultCorporation();
  const daysSinceLast=Math.min(
    daysSinceLastFloppsAnnouncement(state),
    state.announcementHistory.length?day-state.announcementHistory[state.announcementHistory.length-1].day:Infinity
  );
  if(daysSinceLast<10) return null;
  if(corp.retailerStress>0.72){
    return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx,'allocation'),ctx,day,'operations');
  }
  if(corp.laborStress>0.68){
    return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx,'labor'),ctx,day,'corporate');
  }
  if(corp.extractionIndex>0.72 && Math.random()<0.25){
    return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx,'pricing'),ctx,day,'pricing');
  }
  if(corp.lobbyingHeat>0.58 && Math.random()<0.2){
    return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx,'lobbying'),ctx,day,'policy');
  }
  if(corp.hypeIndex>0.66 && Math.random()<0.2){
    return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx,'community'),ctx,day,'consumer-blog');
  }
  const wildcard=maybeGenerateFloppsWildcardBulletin(state,ctx,day,{daysSinceLast});
  if(wildcard) return wildcard;
  return null;
}

function getFloppsWildcardChance(state, ctx, daysSinceLast){
  if(daysSinceLast<18) return 0;
  const corp=ctx.corporation||floppsDefaultCorporation();
  let chance=0.006;
  if(['prelaunch','launch','sellthrough'].includes(ctx.release?.phase?.id)) chance+=0.012;
  chance+=Math.max(0,corp.hypeIndex-0.66)*0.06;
  chance+=Math.max(0,corp.extractionIndex-0.7)*0.05;
  chance+=Math.max(0,corp.collectorStress-0.68)*0.04;
  const trendTop=state.trendDesk?.watchlist?.[0];
  if((trendTop?.marketability||0)>0.84) chance+=0.01;
  return Math.max(0,Math.min(0.07,chance));
}

function normalizeFloppsWildcardEvent(raw, ctx, day){
  const title=String(raw?.title||'Flopps Wildcard Corporate Update').slice(0,100);
  const id=raw?.id||`wildcard-${day}-${slugifyFloppsText(title)}`;
  return {
    kind:'wildcard',
    id,
    title,
    summary:String(raw?.summary||'Flopps published a surprise corporate update with immediate market implications.').slice(0,320),
    paraphrase:String(raw?.paraphrase||'Something strange just hit the collector funnel and nobody was ready for it.').slice(0,320),
    executive:String(raw?.executive||ctx.executive?.name||'Management').slice(0,80),
    executiveRole:String(raw?.executiveRole||ctx.executive?.role||'Executive Office').slice(0,80),
    stockDelta:Math.max(-0.08,Math.min(0.08,Number(raw?.stockDelta||0))),
    marketImpact:String(raw?.marketImpact||'The secondary market is repricing the news in real time.').slice(0,220),
    collectorImpact:String(raw?.collectorImpact||'Collectors, stores, and flippers are all trying to decode the implication.').slice(0,220),
    source:'openrouter:kimi-k2.5',
  };
}

function saveFloppsWildcardArtifact(bulletin, day, ctx){
  const filename=`day-${String(day).padStart(4,'0')}-${slugifyFloppsText(bulletin.title)}.json`;
  wJ(path.join(FLOPPS_WILDCARD_DIR,filename),{
    day,
    createdAt:new Date().toISOString(),
    bulletin,
    releasePhase:ctx.release?.phase?.id||null,
    currentRelease:ctx.release?.current?.title||null,
    nextRelease:ctx.release?.next?.title||null,
    stockPrice:ctx.stockPrice||null,
  });
}

function maybeGenerateFloppsWildcardBulletin(state, ctx, day, {daysSinceLast=null,force=false}={}){
  const since=daysSinceLast==null?daysSinceLastFloppsAnnouncement(state):daysSinceLast;
  const chance=getFloppsWildcardChance(state,ctx,since);
  if(!force && (chance<=0 || Math.random()>=chance)) return null;
  const trendTop=state.trendDesk?.watchlist?.[0]||null;
  const outputFile=path.join(FLOPPS_WILDCARD_DIR,`tmp-${process.pid}-${Date.now()}.json`);
  const context={
    day,
    stockPrice:state.stock?.price||100,
    executive:ctx.executive||null,
    trendDeskTop:trendTop?{name:trendTop.name,marketability:trendTop.marketability}:null,
    release:{
      phase:ctx.release?.phase?.id||null,
      phaseLabel:ctx.release?.phase?.label||null,
      currentTitle:ctx.release?.current?.title||null,
      nextTitle:ctx.release?.next?.title||null,
    },
    corporation:ctx.corporation||null,
  };
  try{
    const raw=execFileSync(
      process.execPath,
      [
        path.join(__dirname,'ai-set-generator.js'),
        '--flopps',
        '--flopps-mode','wildcard-event',
        '--flopps-model','moonshotai/kimi-k2.5',
        '--wildcard-context',JSON.stringify(context),
        '--wildcard-output-file',outputFile,
      ],
      {cwd:DATA_DIR,encoding:'utf8',stdio:['ignore','pipe','pipe']}
    );
    if(!fs.existsSync(outputFile)) return null;
    const parsed=JSON.parse(fs.readFileSync(outputFile,'utf8'));
    try{fs.unlinkSync(outputFile)}catch{}
    const bulletin=normalizeFloppsWildcardEvent(parsed,ctx,day);
    saveFloppsWildcardArtifact(bulletin,day,{...ctx,stockPrice:context.stockPrice});
    return bulletin;
  } catch{
    try{if(fs.existsSync(outputFile)) fs.unlinkSync(outputFile)}catch{}
    return null;
  }
}

function recordFloppsBulletin(state, ctx, bulletin, currentDay, commandName){
  updateFloppsStockPrice(state, ctx, bulletin, currentDay);
  state.lastNewsDay=Math.max(state.lastNewsDay,currentDay);
  state.latestNews={
    day:currentDay,
    command:commandName||null,
    id:bulletin.id,
    title:bulletin.title,
    summary:bulletin.summary,
    paraphrase:bulletin.paraphrase,
    executive:bulletin.executive||ctx.executive?.name||null,
    executiveRole:bulletin.executiveRole||ctx.executive?.role||null,
    phase:ctx.release?.phase?.id||null,
    releaseTitle:ctx.release?.current?.title||null,
    kind:bulletin.kind||'bulletin',
    stock:state.stock.price,
    marketImpact:bulletin.marketImpact||null,
    collectorImpact:bulletin.collectorImpact||null,
    source:bulletin.source||'simulation',
    createdAt:new Date().toISOString(),
  };
  if(bulletin.quarter!=null) state.latestNews.quarter=bulletin.quarter;
  state.newsHistory.push(state.latestNews);
  state.announcementHistory.push({
    day:currentDay,
    kind:bulletin.kind||'bulletin',
    quarter:bulletin.quarter,
    id:bulletin.id,
    title:bulletin.title,
  });
  if(state.newsHistory.length>60) state.newsHistory=state.newsHistory.slice(-60);
  if(state.announcementHistory.length>120) state.announcementHistory=state.announcementHistory.slice(-120);
  saveFloppsState(state);
}

function maybeAnnounceFloppsNews(set, market, commandName){
  if(!set||!market) return;
  const state=loadFloppsState();
  const day=getSimulationDay(market);
  const currentDay=Number.isFinite(day)?day:0;
  ensureFloppsReleaseCalendar(state,set,currentDay);
  const ctx=getFloppsSimulationContext(set, market, state);
  const dayChanged=currentDay>state.lastSeenDay;

  if(dayChanged){
    state.lastSeenDay=currentDay;
    state.lastStockDay=currentDay;
    updateFloppsStockPrice(state, ctx, null, currentDay);
  }

  if(currentDay<=state.lastNewsDay){
    saveFloppsState(state);
    return;
  }
  let bulletin=null;
  const quarter=Math.floor(currentDay/90);
  const hasQuarterlyThisQuarter=(state.announcementHistory||[]).some((item)=>item.kind==='quarterly'&&item.quarter===quarter);
  if(currentDay>0 && currentDay%90===0 && !hasQuarterlyThisQuarter){
    bulletin=buildQuarterlyFloppsAnnouncement(state,ctx,currentDay);
    bulletin.quarter=quarter;
  } else {
    bulletin=buildScheduledFloppsAnnouncement(state,ctx,currentDay) || buildExceptionalFloppsAnnouncement(state,ctx,currentDay);
  }
  if(!bulletin){
    saveFloppsState(state);
    return;
  }

  recordFloppsBulletin(state,ctx,bulletin,currentDay,commandName);
  console.log(`\n${formatFloppsNewsBlast(bulletin,state,ctx)}\n`);
}

function getSpeculationWeight(starTier){
  if(starTier==='Legendary') return 1;
  if(starTier==='Superstar') return 0.85;
  if(starTier==='Star') return 0.65;
  if(starTier==='Uncommon') return 0.45;
  return 0.3;
}

function initMarket(set){
  // Refresh the macro overlay before any price-sensitive market use.
  // The helper is cached for up to 48h, so this stays cheap when fresh.
  getMacroState();
  const key=set.code+'-'+set.year;
  let m=loadMarket(key);
  if(m) {
    // Backfill setAggregates for markets that predate the field
    if(!m.setAggregates) {
      computeSetAggregates(m);
      saveMarket(key,m);
    }
    normalizeMarketEvents(m);
    if(!m.lastTickAt){
      m.lastTickAt=m.lastPackOpened||m.createdAt||Date.now();
      saveMarket(key,m);
    }
    if(!m.cardList) m.cardList=Object.values(m.cards);
    saveMarket(key,m);
    return m;
  }
  const now=Date.now();
  m={setKey:key, tick:0, lastPackOpened:now, createdAt:now,
    lastTickAt:now,
    sentiment:1.0, events:[], eventLog:[], history:{},
    cardList:[],
    cards:{}};
  for(const c of set.cards){
    const mc={num:c.num, name:c.name, starTier:c.starTier,
      basePrice:c.basePrice, popScore:assignChaseScore(c),
      totalPulled:0, supplyInMarket:0, currentPrice:c.basePrice,
      floorPrice:c.basePrice, peakPrice:c.basePrice,
      demandScore:0.5, trendVelocity:0,
      sales24h:0, avgSold7d:c.basePrice, salesHistory:[]};
    m.cards[c.num]=mc;
    m.cardList.push(mc);
  }
  saveMarket(key,m);
  return m;
}

function assignChaseScore(card){
  let s=0.2;
  if(card.num==="001") s=0.75;
  if(card.starTier==="Legendary") s=Math.max(s,0.7);
  else if(card.starTier==="Superstar") s=Math.max(s,0.55);
  else if(card.starTier==="Star") s=Math.max(s,0.4);
  const st=card.stats;
  if(st){const avg=(st.power+st.speed+st.technique+st.endurance+(st.charisma||0))/(st.charisma?5:4);
    if(avg>85)s=Math.max(s,0.6);else if(avg>75)s=Math.max(s,0.45);}
  if(Math.random()<0.08) s=0.4+Math.random()*0.25;
  return Math.min(1,s);
}

function weightedPick(items){
  const total=items.reduce((s,i)=>s+i.w,0);
  let r=Math.random()*total;
  for(const i of items){r-=i.w;if(r<=0)return i.t}
  return items[0].t;
}

const MARKET_EVENT_PROFILES={
  break_flood:{
    label:'Large case break floods the market',
    duration:[7,13],
    magnitude:[0.05,0.15],
    demandMult:0.95,
    sentimentDelta:0,
    icon:'📦',
    effect:'supply surge',
  },
  retailer_surge:{
    label:'Retailer restock wave hits the market',
    duration:[6,12],
    magnitude:[0.04,0.10],
    demandMult:0.97,
    sentimentDelta:0.01,
    icon:'🏬',
    effect:'fresh supply',
  },
  hobby_boom:{
    label:'Collector hype sends premium cards flying',
    duration:[18,40],
    magnitude:[0.18,0.42],
    demandMult:1.06,
    sentimentDelta:0.20,
    icon:'📈',
    effect:'bullish demand',
  },
  correction:{
    label:'Market correction as buyers step back',
    duration:[18,42],
    magnitude:[0.14,0.28],
    demandMult:0.92,
    sentimentDelta:-0.20,
    icon:'📉',
    effect:'bearish demand',
  },
  nostalgia_wave:{
    label:'Nostalgia wave brings old collectors back',
    duration:[30,72],
    magnitude:[0.50,1.00],
    demandMult:1.10,
    sentimentDelta:0.06,
    icon:'🕐',
    effect:'nostalgic revival',
  },
  rookie_chase:{
    label:'Rookie chase sparks a sudden run',
    duration:[10,22],
    magnitude:[0.10,0.24],
    demandMult:1.04,
    sentimentDelta:0.08,
    icon:'⭐',
    effect:'rookie chase',
  },
  injury_report:{
    label:'Injury report cools player demand',
    duration:[4,10],
    magnitude:[0.06,0.14],
    demandMult:0.94,
    sentimentDelta:-0.03,
    icon:'🏥',
    effect:'player uncertainty',
  },
  hot_streak:{
    label:'Hot streak news lifts the room',
    duration:[5,14],
    magnitude:[0.08,0.18],
    demandMult:1.05,
    sentimentDelta:0.04,
    icon:'🔥',
    effect:'hot streak',
  },
  scandal:{
    label:'Off-field scandal rattles buyers',
    duration:[8,18],
    magnitude:[0.10,0.22],
    demandMult:0.91,
    sentimentDelta:-0.07,
    icon:'⚠️',
    effect:'reputation shock',
  },
  award_buzz:{
    label:'Award buzz pushes demand higher',
    duration:[8,18],
    magnitude:[0.08,0.18],
    demandMult:1.05,
    sentimentDelta:0.05,
    icon:'🏆',
    effect:'award buzz',
  },
  livestream_hype:{
    label:'Livestream breaker hype spikes short-term demand',
    duration:[4,12],
    magnitude:[0.06,0.14],
    demandMult:1.03,
    sentimentDelta:0.03,
    icon:'🎥',
    effect:'live break hype',
  },
  grading_rush:{
    label:'Grading backlog tightens supply',
    duration:[14,30],
    magnitude:[0.08,0.16],
    demandMult:1.02,
    sentimentDelta:0.02,
    icon:'🧾',
    effect:'grading choke',
  },
  auction_comp:{
    label:'Auction competition pushes comps upward',
    duration:[10,24],
    magnitude:[0.08,0.18],
    demandMult:1.04,
    sentimentDelta:0.02,
    icon:'🔨',
    effect:'auction pressure',
  },
  stream_dump:{
    label:'Stream dump puts fresh copies into circulation',
    duration:[5,10],
    magnitude:[0.06,0.14],
    demandMult:0.96,
    sentimentDelta:-0.01,
    icon:'📉',
    effect:'supply dump',
  },
  championship: {
    label:'Championship chatter drives a premium surge',
    duration:[18,36],
    magnitude:[0.14,0.30],
    demandMult:1.06,
    sentimentDelta:0.09,
    icon:'🥇',
    effect:'title buzz',
  },
  media_spotlight:{
    label:'Media spotlight drags new eyes into the market',
    duration:[12,24],
    magnitude:[0.10,0.20],
    demandMult:1.03,
    sentimentDelta:0.05,
    icon:'📣',
    effect:'media attention',
  },
  supply_chain:{
    label:'Supply chain friction slows restocks',
    duration:[14,28],
    magnitude:[0.06,0.16],
    demandMult:1.02,
    sentimentDelta:-0.02,
    icon:'🚚',
    effect:'tight supply',
  },
  grading_pop:{
    label:'Grading pop report surprises collectors',
    duration:[10,20],
    magnitude:[0.06,0.12],
    demandMult:1.01,
    sentimentDelta:0.02,
    icon:'🔍',
    effect:'pop report',
  },
  meme_spike:{
    label:'Meme spike drags a niche card into the spotlight',
    duration:[3,9],
    magnitude:[0.05,0.12],
    demandMult:1.02,
    sentimentDelta:0.01,
    icon:'😂',
    effect:'viral meme',
  },
  drought:{
    label:'A quiet market drought reduces trading volume',
    duration:[12,26],
    magnitude:[0.06,0.14],
    demandMult:0.97,
    sentimentDelta:-0.03,
    icon:'🌫️',
    effect:'quiet market',
  },
};

const MARKET_EVENT_TYPES=Object.keys(MARKET_EVENT_PROFILES);

function formatMarketEventDesc(profile, stackCount = 1){
  const count=Math.max(1, stackCount|0);
  if(count===1) return profile.label;
  const copy={
    2:`${profile.label} intensifies`,
    3:`${profile.label} compounds`,
    4:`${profile.label} overwhelms the market`,
  };
  return copy[count]||`${profile.label} x${count}`;
}

function pickMarketEventType(excludeTypes = []){
  const blocked = new Set(excludeTypes.map((t) => String(t || '')));
  const pool = MARKET_EVENT_TYPES.filter((type) => !blocked.has(type));
  const source = pool.length ? pool : MARKET_EVENT_TYPES;
  const weighted = source.map(type => {
    const profile = MARKET_EVENT_PROFILES[type];
    const weight =
      type === 'break_flood' ? 5 :
      type === 'retailer_surge' ? 3 :
      type === 'hobby_boom' ? 2 :
      type === 'correction' ? 2 :
      type === 'nostalgia_wave' ? 1.5 :
      type === 'hot_streak' ? 1.6 :
      type === 'rookie_chase' ? 1.4 :
      type === 'injury_report' ? 1.2 :
      type === 'livestream_hype' ? 1.3 :
      type === 'grading_rush' ? 1.1 :
      type === 'auction_comp' ? 1.1 :
      type === 'award_buzz' ? 1.0 :
      type === 'media_spotlight' ? 1.0 :
      type === 'supply_chain' ? 0.9 :
      type === 'grading_pop' ? 0.9 :
      type === 'meme_spike' ? 0.8 :
      type === 'stream_dump' ? 0.8 :
      type === 'championship' ? 1.0 :
      type === 'scandal' ? 0.9 :
      type === 'drought' ? 0.8 : 1;
    return { t: type, w: weight * (profile?.weight || 1) };
  });
  return weightedPick(weighted);
}

function getMarketEventProfile(type){
  return MARKET_EVENT_PROFILES[type] || MARKET_EVENT_PROFILES.break_flood;
}

function buildMarketEvent(type, tick, stackCount = 1){
  const profile = getMarketEventProfile(type);
  const stack = Math.max(1, stackCount|0);
  return {
    type,
    tick,
    duration: ri(null, profile.duration[0], profile.duration[1]),
    magnitude: Math.round((profile.magnitude[0] + Math.random() * (profile.magnitude[1] - profile.magnitude[0])) * 1000) / 1000 * stack,
    label: profile.label,
    icon: profile.icon,
    effect: profile.effect,
    stackCount: stack,
    baseDesc: profile.label,
    desc: formatMarketEventDesc(profile, stack),
  };
}

function applyMarketEvent(market, type, tick){
  const profile = getMarketEventProfile(type);
  const event = buildMarketEvent(type, tick, 1);
  const applied = addMarketEvent(market, event);
  market.sentiment = Math.max(0.5, Math.min(1.5, (market.sentiment || 1) + (profile.sentimentDelta || 0)));
  return applied;
}

function marketEventDemandMultiplier(type){
  return getMarketEventProfile(type).demandMult || 1;
}

const MARKET_TICK_MS=12*60*60*1000; // 1 market tick = 12 real hours
const MAX_MARKET_CATCHUP_TICKS=365; // Beyond this, rebuild the market snapshot instead of replaying every tick.

// Calculate how many market ticks should run based on time since the last tick.
function calcPendingTicks(market){
  const anchor=market?.lastTickAt||market?.lastPackOpened||market?.createdAt||0;
  if(!anchor) return 0;
  const ms=Date.now()-anchor;
  const ticks=Math.floor(ms/MARKET_TICK_MS);
  return Math.max(0, ticks);
}

function resimulateMarketSnapshot(set, market, col, pending){
  const cards=market.cardList||Object.values(market.cards||{});
  const macro=getMacroState();
  const tick=market.tick+pending;
  market.tick=tick;
  market.sentiment=Math.max(0.5,Math.min(1.5,(market.sentiment||1)+((Math.random()-0.5)*0.25*Math.min(1,pending/12))));
  market.events=(market.events||[]).filter(e=>tick-e.tick<(e.duration||14));

  const pullChance={Common:0.6,Uncommon:0.5,Star:0.35,Superstar:0.2,Legendary:0.1};
  const tierDemand={Common:0.05,Uncommon:0.15,Star:0.40,Superstar:0.70,Legendary:0.90};
  const meanPop={Common:0.12,Uncommon:0.25,Star:0.45,Superstar:0.6,Legendary:0.7};
  const tierVol={Common:0.3,Uncommon:0.5,Star:0.7,Superstar:1.0,Legendary:1.2};

  for(const mc of cards){
    const basePrice=mc.basePrice||0;
    const starTier=mc.starTier||'Common';
    const currentPrice=mc.currentPrice||basePrice;
    const popScore=typeof mc.popScore==='number'?mc.popScore:0.2;
    let demand=tierDemand[starTier]||0.1;
    const ageMonths=tick/30;
    demand*=Math.max(0.4,1-ageMonths*0.003);
    demand*=(0.6+popScore*0.4);
    demand*=0.85+market.sentiment*0.15;
    if(ageMonths>12) demand*=Math.min(1.2,1+(ageMonths-12)*0.01);
    for(const e of market.events){
      demand*=marketEventDemandMultiplier(e.type);
    }
    demand=Math.min(1,Math.max(0.03,demand));
    mc.demandScore=demand;

    mc.popScore+=(meanPop[starTier]-popScore)*Math.min(0.2,pending*0.005);
    mc.popScore=Math.min(1,Math.max(0.05,mc.popScore));

    const intrinsic=basePrice*(0.8+demand*0.4);
    const momentum=mc.avgSold7d>0?1+(mc.avgSold7d-currentPrice)/Math.max(currentPrice,0.01)*0.08:1;
    const macroMove=(macro.signal||0)*0.025*getSpeculationWeight(starTier);
    const fairValue=intrinsic*momentum*(1+macroMove);
    const vol=0.008*(tierVol[starTier]||1);
    const noise=(Math.random()-0.5)*2*vol;
    const target=Math.max(basePrice*0.3, fairValue+noise);

    mc.trendVelocity=target-currentPrice;
    mc.currentPrice=target;
    mc.floorPrice=Math.min(mc.floorPrice||target,mc.currentPrice);
    mc.peakPrice=Math.max(mc.peakPrice||target,mc.currentPrice);
    mc.sales24h=Math.floor(Math.random()*3*demand);
    if(mc.sales24h>0){
      const salePrice=mc.currentPrice*(0.95+Math.random()*0.1);
      mc.salesHistory.push({tick, price:salePrice, parallel:'Base'});
      if(mc.salesHistory.length>20) mc.salesHistory=mc.salesHistory.slice(-20);
      const recent=mc.salesHistory.slice(-7);
      mc.avgSold7d=recent.reduce((s,x)=>s+x.price,0)/recent.length;
    }

    if(tick%7===0){
      if(!market.history[mc.num]) market.history[mc.num]=[];
      market.history[mc.num].push({tick, price:mc.currentPrice});
      if(market.history[mc.num].length>52) market.history[mc.num]=market.history[mc.num].slice(-52);
    }
  }

  if(Math.random()<0.08){
    applyMarketEvent(market, pickMarketEventType(), tick);
  }
  if(Math.random()<0.03){
    const firstType = market.events[market.events.length - 1]?.type;
    applyMarketEvent(market, pickMarketEventType(firstType ? [firstType] : []), tick);
  }

  market.events=market.events.filter(e=>tick-e.tick<e.duration);
  market.eventLog=(market.eventLog||[]).slice(-100);
  market.eventLog.push({tick, type:'resimulate', desc:`Market resimulated after ${pending} elapsed ticks`});

  computeSetAggregates(market);
  if(market.setAggregates?.priceIndex){
    market.setAggregates.priceIndex=market.setAggregates.priceIndex.slice(-365);
  }
  if(col) syncMarketToCollection(market,col);
}

function catchUpMarketToNow(set, market, col){
  const pending=calcPendingTicks(market);
  if(pending>MAX_MARKET_CATCHUP_TICKS){
    resimulateMarketSnapshot(set, market, col, pending);
  } else if(pending>0){
    runMarketTicks(set,market,col,pending);
  } else if(col){
    syncMarketToCollection(market,col);
  }
  market.lastTickAt=Date.now();
  return pending;
}

function activeMarketEvents(market){
  return (market?.events||[]).filter(e=>market.tick-e.tick<(e.duration||14));
}

function isBullishMarketEvent(type){
  const profile=getMarketEventProfile(type);
  return (profile.demandMult||1)>1 || (profile.sentimentDelta||0)>0;
}

function isBearishMarketEvent(type){
  const profile=getMarketEventProfile(type);
  return (profile.demandMult||1)<1 || (profile.sentimentDelta||0)<0;
}

function addMarketEvent(market, event){
  market.events=market.events||[];
  const active=market.events.find(e=>e.type===event.type&&market.tick-e.tick<(e.duration||14));
  if(active){
    active.stackCount=(active.stackCount||1)+1;
    active.baseDesc=active.baseDesc||active.desc||event.desc;
    active.magnitude=Math.round((active.magnitude+event.magnitude)*1000)/1000;
    active.duration=Math.max(active.duration||0,event.duration||0);
    active.desc=formatMarketEventDesc(getMarketEventProfile(active.type), active.stackCount);
    active.lastStackTick=event.tick;
    return active;
  }

  const next={...event, stackCount:1, baseDesc:event.desc};
  market.events.push(next);
  market.eventLog=market.eventLog||[];
  market.eventLog.push({tick:event.tick, type:event.type, desc:event.desc});
  return next;
}

// Stable simulation day for display purposes.
// Inventory-driven market ticks do not advance this calendar.
function getSimulationDay(market){
  if(!market) return 0;
  const createdAt=market.createdAt||market.lastPackOpened||0;
  if(!createdAt) return market.tick||0;
  return Math.max(0, Math.floor((Date.now()-createdAt)/(1000*60*60*24)));
}

// Run N market ticks at once.
// nTicks = elapsed 12-hour ticks since the last simulation update.
// Compute or update set-level market aggregates for programmatic access.
// Called on every tick and on initMarket for backfill.
function computeSetAggregates(market){
  if(!market.setAggregates) market.setAggregates={};
  const agg=market.setAggregates;
  agg.tick=market.tick;
  agg.sentiment=market.sentiment;
  const allCards=market.cardList||Object.values(market.cards);
  let baseSum=0;
  let mktSum=0;
  const tierBuckets={
    Legendary:{count:0,bookValue:0,marketValue:0,velSum:0},
    Superstar:{count:0,bookValue:0,marketValue:0,velSum:0},
    Star:{count:0,bookValue:0,marketValue:0,velSum:0},
    Uncommon:{count:0,bookValue:0,marketValue:0,velSum:0},
    Common:{count:0,bookValue:0,marketValue:0,velSum:0},
  };
  for(const mc of allCards){
    baseSum+=mc.basePrice;
    mktSum+=mc.currentPrice;
    const bucket=tierBuckets[mc.starTier];
    if(bucket){
      bucket.count++;
      bucket.bookValue+=mc.basePrice;
      bucket.marketValue+=mc.currentPrice;
      bucket.velSum+=(mc.trendVelocity||0);
    }
  }
  agg.totalBaseValue=Math.round(baseSum*100)/100;
  agg.totalMarketValue=Math.round(mktSum*100)/100;
  agg.totalChangePct=agg.totalBaseValue>0?Math.round((agg.totalMarketValue-agg.totalBaseValue)/agg.totalBaseValue*10000)/100:0;
  agg.totalCards=allCards.length;
  // Per-tier aggregates
  agg.tiers={};
  for(const tier of['Legendary','Superstar','Star','Uncommon','Common']){
    const bucket=tierBuckets[tier];
    const book=bucket.bookValue;
    const mkt=bucket.marketValue;
    const change=book>0?Math.round((mkt-book)/book*10000)/100:0;
    const avgVel=bucket.count>0?Math.round(bucket.velSum/bucket.count*10000)/10000:0;
    agg.tiers[tier]={count:bucket.count,bookValue:Math.round(book*100)/100,marketValue:Math.round(mkt*100)/100,changePct:change,avgTrendVelocity:avgVel};
  }
  // Active events
  agg.activeEvents=activeMarketEvents(market).map(e=>({
    type:e.type, desc:e.desc, magnitude:e.magnitude, remaining:e.duration-(market.tick-e.tick)
  }));
  // Price index (only append on actual tick advancement, not on backfill)
  if(!agg.priceIndex) agg.priceIndex=[];
  const sampleCards=allCards.slice(0,50);
  let idxVal=0;
  for(const mc of sampleCards) idxVal+=mc.currentPrice;
  // Only add a new point if tick advanced (check against last entry)
  const lastTick=agg.priceIndex.length>0?agg.priceIndex[agg.priceIndex.length-1].tick:-1;
  if(market.tick!==lastTick){
    agg.priceIndex.push({tick:market.tick,value:Math.round(idxVal*100)/100});
  }
  if(agg.priceIndex.length>365) agg.priceIndex=agg.priceIndex.slice(-365);
}

function runMarketTicks(set,market,col,nTicks){
  const cards=market.cardList||Object.values(market.cards);
  const pullChance={Common:0.6,Uncommon:0.5,Star:0.35,Superstar:0.2,Legendary:0.1};
  const tierDemand={Common:0.05,Uncommon:0.15,Star:0.40,Superstar:0.70,Legendary:0.90};
  const meanPop={Common:0.12,Uncommon:0.25,Star:0.45,Superstar:0.6,Legendary:0.7};
  const tierVol={Common:0.3,Uncommon:0.5,Star:0.7,Superstar:1.0,Legendary:1.2};
  const macro=getMacroState();
  for(let t=0;t<nTicks;t++){
    market.tick++;
    const tick=market.tick;

    // Sentiment: slow random walk
    market.sentiment+=(Math.random()-0.48)*0.04;
    market.sentiment=Math.max(0.5,Math.min(1.5,market.sentiment));

    for(let idx=0; idx<cards.length; idx++){
      const mc=cards[idx];
      if(Math.random()<(pullChance[mc.starTier]||0.5)){
        mc.totalPulled++;
        mc.supplyInMarket++;
      }
      if(mc.supplyInMarket>0&&Math.random()<0.008) mc.supplyInMarket--;

      // ── Demand calculation ──
      let demand=tierDemand[mc.starTier]||0.1;

      // Age decay (gentle — 0.3% per month)
      const ageMonths=tick/30;
      demand*=Math.max(0.4, 1-ageMonths*0.003);

      // Popularity factor
      demand*=(0.6+mc.popScore*0.4);

      // Market sentiment
      demand*=0.85+market.sentiment*0.15;

      // Nostalgia (after 12 months)
      if(ageMonths>12) demand*=Math.min(1.2, 1+(ageMonths-12)*0.01);

      // Active event multipliers
      for(const e of market.events){
        demand*=marketEventDemandMultiplier(e.type);
      }

      demand=Math.min(1,Math.max(0.03,demand));
      mc.demandScore=demand;

      // ── Popularity update (5% event chance per tick) ──
      if(Math.random()<0.05){
        const ev=weightedPick([{t:'hot',w:3},{t:'viral',w:1},{t:'injury',w:1},{t:'milestone',w:0.5}]);
        if(ev==='hot') mc.popScore=Math.min(1,mc.popScore+0.03+Math.random()*0.06);
        else if(ev==='viral') mc.popScore=Math.min(1,mc.popScore+0.1+Math.random()*0.1);
        else if(ev==='injury') mc.popScore=Math.max(0.05,mc.popScore-0.05-Math.random()*0.05);
        else mc.popScore=Math.min(1,mc.popScore+0.05);
      }
      mc.popScore+=(meanPop[mc.starTier]-mc.popScore)*0.01;

      // ── Fair value ──
      const intrinsic=mc.basePrice*(0.8+mc.demandScore*0.4);
      const momentum=mc.avgSold7d>0?1+(mc.avgSold7d-mc.currentPrice)/mc.currentPrice*0.08:1;
      const macroMove=(macro.signal||0)*0.025*getSpeculationWeight(mc.starTier);
      const fairValue=intrinsic*momentum*(1+macroMove);

      // ── Volatility ──
      const vol=0.008*(tierVol[mc.starTier]||1);
      const noise=(Math.random()-0.5)*2*vol;

      const target=Math.max(mc.basePrice*0.3, fairValue+noise);
      mc.trendVelocity=(target-mc.currentPrice)*0.08;
      mc.currentPrice=Math.max(mc.basePrice*0.3, mc.currentPrice+mc.trendVelocity);
      mc.floorPrice=Math.min(mc.floorPrice,mc.currentPrice);
      mc.peakPrice=Math.max(mc.peakPrice,mc.currentPrice);

      // Simulate sales
      mc.sales24h=Math.floor(Math.random()*3*mc.demandScore);
      if(mc.sales24h>0){
        const salePrice=mc.currentPrice*(0.95+Math.random()*0.1);
        mc.salesHistory.push({tick, price:salePrice, parallel:'Base'});
        if(mc.salesHistory.length>20) mc.salesHistory=mc.salesHistory.slice(-20);
        const recent=mc.salesHistory.slice(-7);
        mc.avgSold7d=recent.reduce((s,x)=>s+x.price,0)/recent.length;
      }

      // History snapshot every 7 ticks for charting
      if(tick%7===0){
        if(!market.history[mc.num]) market.history[mc.num]=[];
        market.history[mc.num].push({tick, price:mc.currentPrice});
        if(market.history[mc.num].length>52) market.history[mc.num]=market.history[mc.num].slice(-52);
      }
    }

    // ── Market events (random) ──
    if(Math.random()<0.08){
      applyMarketEvent(market, pickMarketEventType(), tick);
    }
    if(Math.random()<0.03){
      const firstType = market.events[market.events.length - 1]?.type;
      applyMarketEvent(market, pickMarketEventType(firstType ? [firstType] : []), tick);
    }

    // Expire old events
    market.events=market.events.filter(e=>tick-e.tick<e.duration);
  }

  // Build set-level aggregates for programmatic access
  computeSetAggregates(market);

  // Update the simulation clock to the current operation time.
  market.lastTickAt=Date.now();

  // Sync market prices into collection
  if(col) syncMarketToCollection(market,col);

  saveMarket(market.setKey,market);
  return market;
}

// Sync current market prices into every collection card's marketPrice field.
// book price (c.price) is NEVER modified — it stays as the original pull price.
// After any price update, ensure higher-tier parallels of the same card number
// are never cheaper than lower-tier ones.  Grade bumps a card above its tier
// floor, so we only intervene when the ordering is violated.
function enforceTierOrdering(col, priceField){
  const tierMap=Object.fromEntries(PARALLELS.map(p=>[p.name,p.tier||0]));
  const byNum={};
  for(const c of col.cards){
    (byNum[c.cardNum]||(byNum[c.cardNum]=[])).push(c);
  }
  for(const cards of Object.values(byNum)){
    cards.sort((a,b)=>{
      const tA=tierMap[a.parallel]||0;
      const tB=tierMap[b.parallel]||0;
      return tA-tB;
    });
    let floor=0;
    for(const c of cards){
      const p=c[priceField]||0;
      if(p<floor) c[priceField]=Math.round(floor*100)/100;
      floor=Math.max(floor, p);
    }
  }
}

function syncMarketToCollection(market,col){
  const cfg=loadCfg();
  const parMap=Object.fromEntries(PARALLELS.map(p=>[p.name,p]));
  for(const c of col.cards){
    const mc=market.cards[c.cardNum];
    if(!mc)continue;
    const par=parMap[c.parallel]||PARALLELS[0];
    const gradeMult=c.grade?(GRADES.find(g=>g.grade===c.grade)?.mult||1):1;
    c.marketPrice=Math.round(mc.currentPrice*par.pm*gradeMult*100)/100;
  }
  enforceTierOrdering(col,'marketPrice');
  enforceTierOrdering(col,'price');
  col.stats.value=col.cards.reduce((s,c)=>s+(c.marketPrice||c.price),0);
  col.wallet=cfg.wallet;
}

// Run 1 market tick when inventory changes (sell, add, remove).
// Sold cards enter the secondary market as new supply and record as completed sales.
// Does NOT reset lastPackOpened — that remains informational, while lastTickAt drives the simulation clock.
function tickMarketOnChange(set, col, soldCards) {
  const market = initMarket(set);
  // First catch up any elapsed time so the sale lands on the current market day.
  catchUpMarketToNow(set, market, col);

  // Sold cards increase supply on the secondary market
  if (soldCards && soldCards.length > 0) {
    for (const sc of soldCards) {
      const mc = market.cards[sc.cardNum];
      if (!mc) continue;
      mc.supplyInMarket++;
      mc.sales24h++;
      const salePrice = sc.price || mc.currentPrice;
      mc.salesHistory.push({
        tick: market.tick,
        price: salePrice,
        parallel: sc.parallel || 'Base'
      });
      if (mc.salesHistory.length > 20) mc.salesHistory = mc.salesHistory.slice(-20);
      const recent = mc.salesHistory.slice(-7);
      mc.avgSold7d = recent.reduce((s, x) => s + x.price, 0) / recent.length;
    }
  }

  // Run 1 tick (demand, sentiment, events, price simulation)
  runMarketTicks(set, market, col, 1);
  saveMarket(market.setKey, market);

  return market;
}

// ── Market commands (read-only) ──

function cmdMarket(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();if(!set){console.log('No set found.');return}
  const m=initMarket(set);

  // Sync market prices into collection (no ticking)
  if(col&&col.cards.length>0) syncMarketToCollection(m,col);

  const query=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='market');
  if(query) return cmdMarketCard(m,set,col,query);

  // Dashboard (read-only snapshot)
  const cards=getMarketCardList(m);
  const sorted=[...cards].sort((a,b)=>b.currentPrice-a.currentPrice);
  const gainers=[...cards].sort((a,b)=>b.trendVelocity-a.trendVelocity).slice(0,5);
  const losers=[...cards].sort((a,b)=>a.trendVelocity-b.trendVelocity).slice(0,5);
  const colMarketValue=col?col.cards.reduce((s,c)=>s+(c.marketPrice||c.price),0):0;
  const colBookValue=col?col.cards.reduce((s,c)=>s+c.price,0):0;
  const pl=colMarketValue-colBookValue;
  const ageDays=getSimulationDay(m);
  const ageStr=ageDays===0?'new':ageDays<30?`${ageDays}d`:ageDays<365?`${(ageDays/30).toFixed(1)}mo`:`${(ageDays/365).toFixed(1)}yr`;
  const lastOpen=m.lastPackOpened?`Last pack: ${new Date(m.lastPackOpened).toISOString().split('T')[0]}`:'No packs opened yet';

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📈 SECONDARY MARKET — ${set.name} (${set.code})`);
  console.log(`  Simulation Day ${ageDays} (${ageStr}) | Sentiment: ${m.sentiment>1.1?'📈 Bullish':m.sentiment<0.9?'📉 Bearish':'➡️ Neutral'} (${m.sentiment.toFixed(2)})`);
  const macro=getMacroState();
  const macroSignal=macro.signal||0;
  const macroLabel=macroSignal>0.35?'📈 Risk-on':macroSignal<-0.35?'📉 Risk-off':'➡️ Mixed';
  const macroPct=(macro.compositePct||0).toFixed(2);
  const macroAgeHours=macro.lastFetch?((Date.now()-macro.lastFetch)/36e5).toFixed(1):'unknown';
  console.log(`  Macro: ${macroLabel} (${macro.compositePct>=0?'+':''}${macroPct}% SP500 composite, 20d/5d blend; updated ${macroAgeHours}h ago)`);
  console.log(`  ${lastOpen}`);
  const floppsLines=getFloppsOverlayLines(set,m,{compact:true});
  if(floppsLines.length){
    console.log(`  🏛️ FLOPPS WATCH: ${floppsLines[0]}`);
    for(const line of floppsLines.slice(1)) console.log(line);
  }
  console.log(`${'═'.repeat(52)}`);

  if(col){
    console.log(`\n  💰 Collection (book):   ${fm$(colBookValue)}`);
    console.log(`  💰 Collection (market): ${fm$(colMarketValue)}`);
    if(Math.abs(pl)>0.01) console.log(`  📊 Unrealized P/L: ${pl>=0?'+':''}${fm$(pl)} (${pl>=0?'📈':'📉'})`);
  }

  console.log(`\n  🔥 TOP MARKET VALUE:`);
  for(const c of sorted.slice(0,5)){
    const te=TIER_EMOJI[c.starTier]||'';
    const change=c.trendVelocity>0.001?'▲':c.trendVelocity<-0.001?'▼':'▸';
    const pctChange=(c.trendVelocity/c.currentPrice*100).toFixed(1);
    console.log(`  ${te} ${c.num} ${pR(c.name,28)} ${fm$(c.currentPrice).padStart(8)} ${change}${pctChange}%`);
  }

  console.log(`\n  📈 BIGGEST GAINERS:`);
  for(const c of gainers){
    if(c.trendVelocity<0.001){console.log('  (no significant gains)');break}
    const pct=(c.trendVelocity/c.currentPrice*100).toFixed(1);
    console.log(`  +${pct}% ${c.num} ${pR(c.name,30)} ${fm$(c.currentPrice)}`);
  }

  console.log(`\n  📉 BIGGEST LOSERS:`);
  for(const c of losers){
    if(c.trendVelocity>-0.001){console.log('  (no significant losses)');break}
    const pct=(c.trendVelocity/c.currentPrice*100).toFixed(1);
    console.log(`  ${pct}% ${c.num} ${pR(c.name,30)} ${fm$(c.currentPrice)}`);
  }

  if(m.events.length>0){
    console.log(`\n  ⚡ ACTIVE MARKET EVENTS:`);
    for(const e of m.events){
      const ico=getMarketEventProfile(e.type)?.icon||'📦';
      console.log(`  ${ico} ${e.desc} (${e.duration-(m.tick-e.tick)} days left)`);
    }
  }

  const popular=[...cards].sort((a,b)=>b.popScore-a.popScore).slice(0,3);
  console.log(`\n  🔥 TRENDING CARDS:`);
  for(const c of popular){
    const bar='█'.repeat(Math.round(c.popScore*10))+'░'.repeat(10-Math.round(c.popScore*10));
    console.log(`  ${c.num} ${pR(c.name,25)} ${bar} ${(c.popScore*100).toFixed(0)}%`);
  }

  // Event log (last 5)
  if(m.eventLog&&m.eventLog.length>0){
    console.log(`\n  📜 MARKET HISTORY (last 5 events):`);
    for(const e of m.eventLog.slice(-5)){
      console.log(`  Day ${e.tick} — ${e.desc}`);
    }
  }

  console.log(`\n  📅 Market advances automatically when you open real packs.`);
  console.log(`  📄 Data: data/sets/${m.setKey}/market.json`);
  console.log(`  Use "market <card-num>" for individual card detail`);
  console.log(`  Use "revalue" to recalculate collection from current market`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdMarketCard(market,set,col,query){
  const mc=market.cards[query];
  if(!mc){console.log(`\n  ❌ Card #${query} not in set.\n`);return}
  const te=TIER_EMOJI[mc.starTier]||'';
  const change=mc.trendVelocity>0.001?'▲':mc.trendVelocity<-0.001?'▼':'▸';
  const pctChange=mc.currentPrice>0?(mc.trendVelocity/mc.currentPrice*100).toFixed(1):'0.0';
  const fromBase=mc.basePrice>0?((mc.currentPrice-mc.basePrice)/mc.basePrice*100).toFixed(1):'0.0';

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📈 ${te}${set.code}-${mc.num} ${mc.name}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Tier:       ${mc.starTier}`);
  console.log(`  Base Price: ${fm$(mc.basePrice)}`);
  console.log(`  Market:     ${fm$(mc.currentPrice)} ${change}${pctChange}%`);
  console.log(`  From Base:  ${fromBase>=0?'+':''}${fromBase}%`);
  console.log(`  ATH:        ${fm$(mc.peakPrice)} | ATL: ${fm$(mc.floorPrice)}`);
  console.log(`  Supply:     ${mc.supplyInMarket} in market | Pulled: ${mc.totalPulled}`);
  console.log(`  Popularity: ${mc.popScore.toFixed(2)} ${'█'.repeat(Math.round(mc.popScore*10))}${'░'.repeat(10-Math.round(mc.popScore*10))}`);
  console.log(`  Demand:     ${mc.demandScore.toFixed(2)}`);

  // Price chart
  const hist=market.history[mc.num]||[];
  if(hist.length>1){
    const prices=hist.map(h=>h.price);
    const maxP=Math.max(...prices);
    const minP=Math.min(...prices);
    const range=maxP-minP||0.01;
    const chartH=8;
    console.log(`\n  Price Chart (last ${hist.length*7} days):`);
    for(let row=chartH;row>=0;row--){
      const val=maxP-range*(row/chartH);
      const label=`$${val.toFixed(2)}`.padStart(7);
      let line='';
      for(const h of hist){
        const filled=(h.price-minP)/range>=1-row/chartH;
        line+=filled?'█':' ';
      }
      console.log(`  ${label}┤${line}`);
    }
    console.log(`  ${''.padStart(7)}└${'─'.repeat(hist.length)}→`);
  }

  // Your copies (book vs market)
  const owned=col?col.cards.filter(c=>c.cardNum===query):[];
  if(owned.length>0){
    console.log(`\n  📦 YOUR COPIES (${owned.length}):`);
    for(const c of owned){
      const pe=PAR_EMOJI[c.parallel]||'';
      const gTag=c.graded?`G${c.grade} `:'';
      const hint=typeof c.quality==='object'?c.quality.hints[0]:(c.quality||'');
      const mp=c.marketPrice||c.price;
      const diff=mp-c.price;
      const diffPct=c.price>0?(diff/c.price*100).toFixed(1):'—';
      console.log(`  ${pe} ${gTag}${c.parallel}${c.serStr?' '+c.serStr:''} │ ${hint}`);
      console.log(`     Book: ${fm$(c.price)} | Market: ${fm$(mp)} │ ${diff>=0?'+':''}${diffPct}% (${diff>=0?'📈':'📉'})`);
    }
  } else {
    console.log(`\n  📦 You don't own this card.`);
  }

  // Recent sales
  if(mc.salesHistory.length>0){
    console.log(`\n  📋 RECENT SALES:`);
    for(const s of mc.salesHistory.slice(-5)){
      const daysAgo=market.tick-s.tick;
      console.log(`  Day -${daysAgo} — ${fm$(s.price)} ${s.parallel}`);
    }
  }

  const floppsLines=getFloppsOverlayLines(set,market,{compact:true});
  if(floppsLines.length){
    console.log(`\n  🏛️ FLOPPS WATCH: ${floppsLines[0]}`);
    for(const line of floppsLines.slice(1,2)) console.log(line);
  }

  console.log(`${'═'.repeat(52)}\n`);
}

// Revalue: recalculate all collection cards from current market prices.
// Shows book vs market comparison. Saves updated collection.
function cmdRevalue(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();if(!set){console.log('No set found.');return}
  if(!col||col.cards.length===0){console.log('Collection is empty.');return}
  const m=initMarket(set);

  const oldBookValue=col.cards.reduce((s,c)=>s+c.price,0);

  syncMarketToCollection(m,col);

  const newMarketValue=col.cards.reduce((s,c)=>s+(c.marketPrice||c.price),0);
  const diff=newMarketValue-oldBookValue;

  rebuildPulls(col);saveCol(col);

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🔄 REVALUE — ${set.name} (${set.code})`);
  console.log(`  Simulation Day ${getSimulationDay(m)}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Book Value:   ${fm$(oldBookValue)}`);
  console.log(`  Market Value: ${fm$(newMarketValue)}`);
  console.log(`  Difference:   ${diff>=0?'+':''}${fm$(diff)} (${diff>=0?'📈':'📉'})`);
  console.log(`${'─'.repeat(52)}`);

  // Biggest divergences
  const divergences=col.cards.map(c=>{
    const mp=c.marketPrice||c.price;
    const d=mp-c.price;
    return{num:c.cardNum,name:c.name,book:c.price,market:mp,diff:d,
      pct:c.price>0?(d/c.price*100):0};
  }).sort((a,b)=>b.pct-a.pct);

  console.log(`\n  📈 ABOVE BOOK (market premium):`);
  const above=divergences.filter(d=>d.diff>0.01).slice(0,5);
  if(above.length) above.forEach(d=>console.log(`  +${d.pct.toFixed(1)}% ${d.num} ${pR(d.name,28)} ${fm$(d.book)} → ${fm$(d.market)}`));
  else console.log('  (none)');

  console.log(`\n  📉 BELOW BOOK (market discount):`);
  const below=divergences.filter(d=>d.diff<-0.01).slice(0,5);
  if(below.length) below.forEach(d=>console.log(`  ${d.pct.toFixed(1)}% ${d.num} ${pR(d.name,28)} ${fm$(d.book)} → ${fm$(d.market)}`));
  else console.log('  (none)');

  console.log(`\n  💰 Wallet: ${fm$(cfg.wallet)} | Collection: ${fm$(newMarketValue)}`);
  console.log(`  📊 Net Worth: ${fm$(cfg.wallet+newMarketValue)}`);
  console.log(`${'═'.repeat(52)}\n`);
}

// ─── FLAG: Price fluctuation visualizer ─────────────────────────────
// Usage:
//   flag                  — per-set dashboard: sentiment, top movers, market-wide chart
//   flag <card-num>       — per-card detail with sparkline chart
//   flag owned            — only cards you own
//   flag movers           — top 10 movers by absolute % change
//   flag gainers          — top 10 gainers
//   flag losers           — top 10 losers

function cmdFlag(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=loadMarket(cfg.activeSet);
  if(!set){console.log('No set found.');return}
  if(!market){console.log('No market data yet. Open a real pack to initialize.');return}

  const subcmd=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='flag');

  if(subcmd&&subcmd.match(/^\d+$/)){
    cmdFlagCard(market,set,col,subcmd);
  } else if(subcmd==='owned'){
    cmdFlagOwned(market,set,col);
  } else if(subcmd==='movers'){
    cmdFlagMovers(market,set,col,'abs');
  } else if(subcmd==='gainers'){
    cmdFlagMovers(market,set,col,'up');
  } else if(subcmd==='losers'){
    cmdFlagMovers(market,set,col,'down');
  } else {
    cmdFlagSet(market,set,col);
  }
}

function sparkline(prices, height=4, width=40){
  if(prices.length<2) return prices.length===1?` ${fm$(prices[0])}`:' no data';
  const max=Math.max(...prices), min=Math.min(...prices);
  const range=max-min||0.01;
  const bars=['▁','▂','▃','▄','▅','▆','▇','█'];
  let line='';
  for(const p of prices){
    const idx=Math.min(bars.length-1, Math.floor((p-min)/range*(bars.length-1)));
    line+=bars[idx];
  }
  // Add price labels
  return ` ${fm$(min)} ${' '.repeat(Math.max(0,width-prices.length))} ${fm$(max)}\n     ${line}`;
}

function trendTag(mc){
  const v=mc.trendVelocity||0;
  const pct=mc.currentPrice>0?(v/mc.currentPrice*100):0;
  if(pct>0.1) return `🔺 +${pct.toFixed(1)}%`;
  if(pct<-0.1) return `🔻 ${pct.toFixed(1)}%`;
  return `▸  ${pct.toFixed(1)}%`;
}

function cmdFlagSet(market,set,col){
  const cards=getMarketCardList(market);
  const aggregates=market.setAggregates||null;
  const sentiment=market.sentiment||1;
  const sentLabel=sentiment>1.15?'🐂 Bullish':sentiment>1.05?'📈 Leaning Bull':sentiment<0.85?'🐻 Bearish':sentiment<0.95?'📉 Leaning Bear':'😐 Neutral';
  const activeEvents=market.events?.filter(e=>{
    const age=market.tick-e.tick;
    return age<(e.duration||14);
  })||[];
  const totalBaseVal=aggregates?.totalBaseValue||set.cards.reduce((s,c)=>s+c.basePrice,0);
  const totalMktVal=aggregates?.totalMarketValue||cards.reduce((s,mc)=>s+mc.currentPrice,0);
  const setChange=totalBaseVal>0?((totalMktVal-totalBaseVal)/totalBaseVal*100):0;

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏁 FLAG — ${set.name} (${set.code}) Market Overview`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Simulation Day ${getSimulationDay(market)} | ${sentLabel} (${sentiment.toFixed(3)})`);
  console.log(`  Set Book Value:   ${fm$(totalBaseVal)}`);
  console.log(`  Set Market Value: ${fm$(totalMktVal)} (${setChange>=0?'+':''}${setChange.toFixed(1)}%)`);
  console.log(`  Active Events:    ${activeEvents.length}`);

  if(activeEvents.length>0){
    console.log(`\n  📢 EVENTS:`);
    for(const e of activeEvents.slice(0,5)){
      const age=market.tick-e.tick;
      const rem=e.duration-age;
      console.log(`     Day -${age}  ${e.desc} (${rem}d left, mag ${(e.magnitude*100).toFixed(0)}%)`);
    }
  }

  // Per-tier aggregate
  console.log(`\n  📊 BY TIER:`);
  for(const tier of['Legendary','Superstar','Star','Uncommon','Common']){
    const tierAgg=aggregates?.tiers?.[tier];
    const tierCards=tierAgg ? [] : cards.filter(mc=>mc.starTier===tier);
    if(!tierAgg && !tierCards.length) continue;
    const te=TIER_EMOJI[tier]||'';
    const totalBook=tierAgg?.bookValue ?? tierCards.reduce((s,mc)=>s+mc.basePrice,0);
    const totalMkt=tierAgg?.marketValue ?? tierCards.reduce((s,mc)=>s+mc.currentPrice,0);
    const change=totalBook>0?((totalMkt-totalBook)/totalBook*100):0;
    // Average trend velocity
    const avgVel=tierAgg?.avgTrendVelocity ?? (tierCards.reduce((s,mc)=>s+(mc.trendVelocity||0),0)/tierCards.length);
    const refPrice=tierAgg?.count ? (totalMkt/tierAgg.count) : (tierCards[0]?.currentPrice||1);
    const avgPct=refPrice>0?(avgVel/refPrice*100):0;
    const icon=avgPct>0.1?'🔺':avgPct<-0.1?'🔻':'▸';
    console.log(`  ${te} ${tier.padEnd(12)} Book: ${fm$(totalBook).padStart(8)} → Mkt: ${fm$(totalMkt).padStart(8)}  ${icon} ${avgPct>=0?'+':''}${avgPct.toFixed(2)}%`);
  }

  // Top 5 movers
  const movers=cards
    .map(mc=>({...mc, fromBase:mc.basePrice>0?((mc.currentPrice-mc.basePrice)/mc.basePrice*100):0}))
    .sort((a,b)=>Math.abs(b.fromBase)-Math.abs(a.fromBase))
    .slice(0,5);

  console.log(`\n  🔥 TOP MOVERS:`);
  for(const mc of movers){
    const te=TIER_EMOJI[mc.starTier]||'';
    const icon=mc.fromBase>0?'🔺':mc.fromBase<0?'🔻':'▸';
    const owned=col?.cards?.some(c=>c.cardNum===mc.num)?'📦':'  ';
    console.log(`  ${owned} ${te}${mc.num} ${pR(mc.name,30)} ${fm$(mc.basePrice)} → ${fm$(mc.currentPrice)}  ${icon} ${mc.fromBase>=0?'+':''}${mc.fromBase.toFixed(1)}%`);
  }

  // Set-wide price index sparkline (market cap over history ticks)
  // Build synthetic index from history snapshots
  const idxHistory=[];
  const sampleNums=Object.keys(market.history).slice(0,50);
  if(sampleNums.length>0){
    const maxTicks=Math.max(...sampleNums.map(n=>(market.history[n]||[]).length));
    for(let i=0;i<maxTicks;i++){
      let val=0;
      for(const num of sampleNums){
        const h=market.history[num];
        if(h&&h[i]) val+=h[i].price;
      }
      if(val>0) idxHistory.push(val);
    }
  }
  if(idxHistory.length>2){
    console.log(`\n  📈 SET PRICE INDEX (sample ${sampleNums.length} cards):`);
    console.log(sparkline(idxHistory));
  }

  const floppsLines=getFloppsOverlayLines(set,market,{compact:false});
  if(floppsLines.length){
    console.log(`\n  🏛️ FLOPPS WATCH: ${floppsLines[0]}`);
    for(const line of floppsLines.slice(1)) console.log(line);
  }

  // Event log (recent)
  if(market.eventLog&&market.eventLog.length>0){
    console.log(`\n  📜 EVENT LOG (last ${Math.min(5,market.eventLog.length)}):`);
    for(const e of market.eventLog.slice(-5).reverse()){
      const age=market.tick-e.tick;
      console.log(`  Day -${age} — ${e.desc}`);
    }
  }

  console.log(`${'═'.repeat(56)}\n`);
}

function cmdFlagCard(market,set,col,num){
  const mc=market.cards[num];
  if(!mc){console.log(`\n  ❌ Card #${num} not found in market.\n`);return}

  const hist=market.history[num]||[];
  const fromBase=mc.basePrice>0?((mc.currentPrice-mc.basePrice)/mc.basePrice*100):0;
  const owned=col?.cards?.filter(c=>c.cardNum===num)||[];

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏁 ${TIER_EMOJI[mc.starTier]||''} ${set.code}-${mc.num} ${mc.name}`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Base Price:     ${fm$(mc.basePrice)}`);
  console.log(`  Market Price:   ${fm$(mc.currentPrice)} ${trendTag(mc)}`);
  console.log(`  From Base:      ${fromBase>=0?'+':''}${fromBase.toFixed(1)}%`);
  console.log(`  ATH:            ${fm$(mc.peakPrice)} | ATL: ${fm$(mc.floorPrice)}`);
  console.log(`  Supply:         ${mc.supplyInMarket} listed | ${mc.totalPulled} pulled total`);
  console.log(`  Popularity:     ${mc.popScore.toFixed(2)} ${'█'.repeat(Math.round(mc.popScore*10))}${'░'.repeat(10-Math.round(mc.popScore*10))}`);
  console.log(`  Demand:         ${mc.demandScore.toFixed(3)}`);
  console.log(`  Sales (24h):    ${mc.sales24h}`);
  console.log(`  Avg Sold (7d):  ${fm$(mc.avgSold7d)}`);

  // Sparkline
  if(hist.length>1){
    const prices=hist.map(h=>h.price);
    console.log(`\n  📈 PRICE CHART (${hist.length} data points, last ${hist.length*7} days):`);
    console.log(sparkline(prices));
  }

  // Sales history
  if(mc.salesHistory&&mc.salesHistory.length>0){
    console.log(`\n  📋 RECENT SALES:`);
    for(const s of mc.salesHistory.slice(-8)){
      const age=market.tick-s.tick;
      const sp=fm$(s.price);
      console.log(`  Day -${String(age).padStart(3)} │ ${sp.padStart(7)} │ ${s.parallel}`);
    }
  }

  // Your copies
  if(owned.length>0){
    console.log(`\n  📦 YOUR COPIES (${owned.length}):`);
    for(const c of owned){
      const pe=PAR_EMOJI[c.parallel]||'';
      const mp=c.marketPrice||c.price;
      const diff=mp-c.price;
      const pct=c.price>0?(diff/c.price*100).toFixed(1):'—';
      const icon=diff>=0?'📈':'📉';
      console.log(`  ${pe} ${c.parallel}${c.serStr?' '+c.serStr:''} │ Book: ${fm$(c.price)} → Mkt: ${fm$(mp)} ${icon} ${diff>=0?'+':''}${pct}%`);
    }
  } else {
    console.log(`\n  📦 You don't own this card.`);
  }

  console.log(`${'═'.repeat(56)}\n`);
}

function cmdFlagOwned(market,set,col){
  if(!col||col.cards.length===0){console.log('\n  Collection is empty.\n');return}
  const ownedNums=new Set(col.cards.map(c=>c.cardNum));
  const cards=getMarketCardList(market).filter(mc=>ownedNums.has(mc.num));
  if(!cards.length){console.log('\n  No market data for owned cards.\n');return}

  // Sort by absolute change from base
  cards.sort((a,b)=>Math.abs((b.currentPrice-b.basePrice)/b.basePrice)-Math.abs((a.currentPrice-a.basePrice)/a.basePrice));

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏁 FLAG — Owned Cards Market Tracker (${cards.length} unique)`);
  console.log(`${'═'.repeat(56)}`);

  // Summary
  const totalBook=cards.reduce((s,mc)=>s+mc.basePrice,0);
  const totalMkt=cards.reduce((s,mc)=>s+mc.currentPrice,0);
  const change=totalBook>0?((totalMkt-totalBook)/totalBook*100):0;
  console.log(`  Portfolio Book: ${fm$(totalBook)} → Market: ${fm$(totalMkt)} (${change>=0?'+':''}${change.toFixed(1)}%)\n`);

  console.log(`  ${'#'.padEnd(4)} ${'Name'.padEnd(32)} ${'Base'.padStart(7)} ${'Mkt'.padStart(7)}  ${'Trend'}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(32)} ${'─'.repeat(7)} ${'─'.repeat(7)}  ${'─'.repeat(12)}`);
  for(const mc of cards){
    const te=TIER_EMOJI[mc.starTier]||'';
    const name=te+mc.num+' '+mc.name;
    const pct=mc.basePrice>0?((mc.currentPrice-mc.basePrice)/mc.basePrice*100):0;
    const icon=pct>0.5?'🔺':pct<-0.5?'🔻':'▸';
    const copies=col.cards.filter(c=>c.cardNum===mc.num).length;
    const dupTag=copies>1?` ×${copies}`:'';
    console.log(`  ${mc.num.padEnd(4)} ${pR(mc.name,30)} ${fm$(mc.basePrice).padStart(7)} ${fm$(mc.currentPrice).padStart(7)}  ${icon} ${pct>=0?'+':''}${pct.toFixed(1)}%${dupTag}`);
  }

  // Sparkline for owned portfolio value
  const ownedHistory={};
  for(const num of ownedNums){
    const h=market.history[num];
    if(h) ownedHistory[num]=h;
  }
  const sampleNums=Object.keys(ownedHistory);
  if(sampleNums.length>1){
    const maxPts=Math.max(...sampleNums.map(n=>ownedHistory[n].length));
    const portfolioHistory=[];
    for(let i=0;i<maxPts;i++){
      let val=0;
      for(const num of sampleNums){
        const h=ownedHistory[num];
        if(h&&h[i]) val+=h[i].price;
      }
      if(val>0) portfolioHistory.push(val);
    }
    if(portfolioHistory.length>2){
      console.log(`\n  📈 YOUR PORTFOLIO TREND:`);
      console.log(sparkline(portfolioHistory));
    }
  }

  const floppsLines=getFloppsOverlayLines(set,market,{compact:true});
  if(floppsLines.length){
    console.log(`\n  🏛️ FLOPPS WATCH: ${floppsLines[0]}`);
    if(floppsLines[1]) console.log(floppsLines[1]);
  }

  console.log(`${'═'.repeat(56)}\n`);
}

function cmdFlagMovers(market,set,col,direction){
  let cards=getMarketCardList(market)
    .map(mc=>({...mc, pct:mc.basePrice>0?((mc.currentPrice-mc.basePrice)/mc.basePrice*100):0}));

  if(direction==='up') cards.sort((a,b)=>b.pct-a.pct);
  else if(direction==='down') cards.sort((a,b)=>a.pct-b.pct);
  else cards.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));

  const label=direction==='up'?'TOP GAINERS':direction==='down'?'TOP LOSERS':'TOP MOVERS';
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏁 FLAG — ${label} (all ${set.cards.length} cards)`);
  console.log(`${'═'.repeat(56)}\n`);

  console.log(`  ${'#'.padEnd(4)} ${'Name'.padEnd(32)} ${'Tier'.padEnd(12)} ${'Base'.padStart(7)} ${'Mkt'.padStart(7)}  Change`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(32)} ${'─'.repeat(12)} ${'─'.repeat(7)} ${'─'.repeat(7)}  ${'─'.repeat(12)}`);

  for(const mc of cards.slice(0,10)){
    const te=TIER_EMOJI[mc.starTier]||'';
    const icon=mc.pct>0.5?'🔺':mc.pct<-0.5?'🔻':'▸';
    const owned=col?.cards?.some(c=>c.cardNum===mc.num)?'📦':'  ';
    console.log(`  ${owned} ${mc.num.padEnd(4)} ${pR(mc.name,30)} ${te}${mc.starTier.padEnd(10)} ${fm$(mc.basePrice).padStart(7)} ${fm$(mc.currentPrice).padStart(7)}  ${icon} ${mc.pct>=0?'+':''}${mc.pct.toFixed(1)}%`);
  }

  const floppsLines=getFloppsOverlayLines(set,market,{compact:true});
  if(floppsLines.length){
    console.log(`\n  🏛️ FLOPPS WATCH: ${floppsLines[0]}`);
    if(floppsLines[1]) console.log(floppsLines[1]);
  }
  console.log(`${'═'.repeat(56)}\n`);
}

// ─── CHECKLIST ─────────────────────────────────────────────────────
function updateChecklist(set,col){
  // build markdown checklist for a set
  const market=loadMarket(set.code+'-'+set.year);
  if(market){
    normalizeMarketEvents(market);
    saveMarket(set.code+'-'+set.year,market);
  }
  // Group owned cards by card number (all copies, all parallels/variants)
  const ownedByNum={};
  if(col){
    for(const c of col.cards){
      if(!ownedByNum[c.cardNum]) ownedByNum[c.cardNum]=[];
      ownedByNum[c.cardNum].push(c);
    }
  }
  const ownedNums=new Set(Object.keys(ownedByNum));
  const checklistDir=path.join(DATA_DIR,'checklists');
  if(!fs.existsSync(checklistDir))fs.mkdirSync(checklistDir,{recursive:true});
  let md=`# ${set.name} — Checklist\n\n`;
  md+=`> ${set.category} | ${set.cards.length} cards | ${set.code}\n\n`;
  // summary
  const ownedCount=ownedNums.size;
  const pct=set.cards.length>0?(ownedCount/set.cards.length*100).toFixed(1):'0.0';
  const bar='█'.repeat(Math.round(ownedCount/set.cards.length*20))+'░'.repeat(20-Math.round(ownedCount/set.cards.length*20));
  md+=`Progress: ${bar} ${ownedCount}/${set.cards.length} (${pct}%)\n\n`;
  md+=`| # | Owned | Name | Tier | Subset | Parallel | Quality | Base $ | Mkt $ | Trend |\n`;
  md+=`|---|-------|------|------|--------|----------|---------|--------|-------|-------|\n`;
  for(const c of set.cards){
    const own=ownedNums.has(c.num);
    const chk=own?'✅':'⬜';
    const te=TIER_EMOJI[c.starTier]||'';
    const basePrice=fm$(c.basePrice);
    // Market data for this card number
    const mc=market?.cards?.[c.num];
    const mktPrice=mc?fm$(mc.currentPrice):'—';
    let trend='—';
    if(mc){
      const v=mc.trendVelocity||0;
      const pctChg=mc.currentPrice>0?(v/mc.currentPrice*100):0;
      if(pctChg>0.05) trend=`🔺 +${pctChg.toFixed(1)}%`;
      else if(pctChg<-0.05) trend=`🔻 ${pctChg.toFixed(1)}%`;
      else trend=`▸  ${pctChg.toFixed(1)}%`;
    }
    if(!own){
      // Unowned: single row, no prices
      md+=`| ${c.num} | ${chk} | **${c.name}** | ${te}${c.starTier} | ${c.subset} | — | — | — | — | — |\n`;
    } else {
      // Owned: one row per parallel/variant, sorted by value descending
      const copies=(ownedByNum[c.num]||[]).sort((a,b)=>b.price-a.price);
      copies.forEach((bp,i)=>{
        const pe=PAR_EMOJI[bp.parallel]||'';
        const parText=`${pe} ${bp.parallel}${bp.serStr?' '+bp.serStr:''}`;
        let qualityText='—';
        const aq=bp.quality;
        if(typeof aq==='object'&&aq.hints) qualityText=aq.hints.slice(0,2).join(', ');
        else if(typeof aq==='string') qualityText=aq;
        const gradeTag=(bp?.graded)?` **G${bp.grade}**`:'';
        // Per-copy market price (parallel multiplier applied)
        const par=PARALLELS.find(p=>p.name===bp.parallel)||PARALLELS[0];
        const gradeMult=bp.grade?(GRADES.find(g=>g.grade===bp.grade)?.mult||1):1;
        const copyMktPrice=mc?fm$(Math.round(mc.currentPrice*par.pm*gradeMult*100)/100):'—';
        const bookPrice=fm$(bp.price);
        // Per-copy P/L vs book price
        let copyTrend='—';
        if(mc&&bp.price>0){
          const mp=Math.round(mc.currentPrice*par.pm*gradeMult*100)/100;
          const diff=mp-bp.price;
          const pctChg=diff/bp.price*100;
          if(pctChg>0.5) copyTrend=`🔺 +${pctChg.toFixed(1)}%`;
          else if(pctChg<-0.5) copyTrend=`🔻 ${pctChg.toFixed(1)}%`;
          else copyTrend=`▸  ${pctChg.toFixed(1)}%`;
        }
        if(i===0){
          // First row: card info + prices
          md+=`| ${c.num} | ${chk} | **${c.name}** | ${te}${c.starTier} | ${c.subset} | ${parText} | ${qualityText}${gradeTag} | ${basePrice} | ${copyMktPrice} | ${copyTrend} |\n`;
        } else {
          // Extra parallel rows: indented, blank card info columns
          md+=`|   |   | | | | ${parText} | ${qualityText}${gradeTag} | | ${copyMktPrice} | ${copyTrend} |\n`;
        }
      });
    }
  }
  // Portfolio totals footer (sum of all owned copies)
  let totalBase=0, totalMkt=0;
  if(col){
    for(const c of col.cards){
      const par=PARALLELS.find(p=>p.name===c.parallel)||PARALLELS[0];
      const gradeMult=c.grade?(GRADES.find(g=>g.grade===c.grade)?.mult||1):1;
      const mc=market?.cards?.[c.cardNum];
      if(mc){
        totalBase+=c.price;
        totalMkt+=Math.round(mc.currentPrice*par.pm*gradeMult*100)/100;
      }
    }
  }
  const delta=totalMkt-totalBase;
  const deltaPct=totalBase>0?(delta/totalBase*100):0;
  const deltaIcon=delta>0.01?'🔺':delta<-0.01?'🔻':'▸';
  md+=`\n---\n`;
  md+=`**Portfolio:** Book ${fm$(totalBase)} → Market ${fm$(totalMkt)} (${deltaIcon} ${delta>=0?'+':''}${fm$(delta)}, ${deltaPct>=0?'+':''}${deltaPct.toFixed(1)}%)\n`;
  // Market summary footer
  if(market){
    const sentiment=market.sentiment||1;
    const sentLabel=sentiment>1.1?'🐂 Bullish':sentiment<0.9?'🐻 Bearish':'😐 Neutral';
    const activeEvents=(market.events||[]).filter(e=>{
      const age=market.tick-e.tick;
      return age<(e.duration||14);
    });
    const eventNames=activeEvents.map(e=>String(e.desc||e.type||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const eventSuffix=eventNames.length?` (${eventNames.join(', ')})`:'';
    md+=`**Market:** ${sentLabel} (sentiment ${sentiment.toFixed(2)}) | Simulation Day ${getSimulationDay(market)} | ${activeEvents.length} active event${activeEvents.length!==1?'s':''}${eventSuffix}\n`;
  }
  md+=`*Updated: ${new Date().toISOString().split('T')[0]}*\n`;
  const fp=path.join(checklistDir,set.code+'-'+set.year+'.md');
  fs.writeFileSync(fp,md,'utf8');
  return fp;
}

function cmdChecklist(){
  const cfg=loadCfg();
  const filterArg=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='checklist');
  const colDir=path.join(DATA_DIR,'collections');
  const setDir=path.join(DATA_DIR,'sets');
  const sets=fs.readdirSync(setDir).filter(f=>f.endsWith('.json')).map(f=>rJ(path.join(setDir,f))).filter(Boolean);
  let shown=0;
  for(const set of sets){
    if(filterArg&&!(set.code.toLowerCase().includes(filterArg.toLowerCase())||set.name.toLowerCase().includes(filterArg.toLowerCase())))continue;
    // load collection for this set
    const colPath=path.join(colDir,set.code+'-'+set.year+'.json');
    const col=fs.existsSync(colPath)?rJ(colPath):null;
    const ownedByNum={};
    if(col){
      for(const c of col.cards){
        if(!ownedByNum[c.cardNum]) ownedByNum[c.cardNum]=[];
        ownedByNum[c.cardNum].push(c);
      }
    }
    const ownedNums=new Set(Object.keys(ownedByNum));
    // update markdown
    const fp=updateChecklist(set,col);
    // console summary
    shown++;
    const owned=ownedNums;
    const count=owned.size;
    const pct=set.cards.length>0?(count/set.cards.length*100).toFixed(1):'0.0';
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  📋 CHECKLIST — ${set.name} (${set.code})`);
    console.log(`  ${count}/${set.cards.length} (${pct}%)`);
    console.log(`${'═'.repeat(52)}`);
    // group by tier
    for(const tierName of['Legendary','Superstar','Star','Uncommon','Common']){
      const tierCards=set.cards.filter(c=>c.starTier===tierName).sort((a,b)=>a.num.localeCompare(b.num,'en',{numeric:true}));
      if(!tierCards.length)continue;
      const te=TIER_EMOJI[tierName]||'';
      const ownedInTier=tierCards.filter(c=>owned.has(c.num)).length;
      console.log(`\n  ${te} ${tierName.toUpperCase()} (${ownedInTier}/${tierCards.length}):`);
      for(const c of tierCards){
        const own=owned.has(c.num);
        const chk=own?'✅':'⬜';
        const bp=col?(ownedByNum[c.num]||[]).slice().sort((a,b)=>b.price-a.price)[0]:null;
        const pe=bp?(PAR_EMOJI[bp.parallel]||'')+' '+bp.parallel:'';
        const ser=bp?.serStr?' '+bp.serStr:'';
        const stats=c.stats?`⚔${c.stats.power} ${c.stats.speed} ${c.stats.technique} ${c.stats.endurance} ${c.stats.charisma}`:'';
        const aq=bp?.quality;
        const hint=typeof aq==='object'&&aq.hints?aq.hints.slice(0,1).join('; '):(typeof aq==='string'?aq:'');
        const gTag=bp?.graded?`G${bp.grade} `:'';
        const catLine = CAT.fmtCardCategoryLine(c, set.setCategory);
        console.log(`  ${chk} ${c.num} ${pR(c.name,35)} ${stats||''}`);
        if(catLine) console.log(`     ${catLine}`);
        if(bp)console.log(`     └ ${pe}${ser} │ ${gTag}${hint} │ ${fm$(bp.price)}`);
      }
    }
    console.log(`\n  📄 Markdown: ${fp}`);
    console.log(`${'─'.repeat(52)}`);
  }
  if(!shown){console.log(`\n  ❌ No sets found${filterArg?' matching "'+filterArg+'"':''}.\n`);return}
  console.log();
}

function cmdSell(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||col.cards.length===0){console.log('Collection is empty.');return}
  const args=process.argv.slice(2);
  const sellBest=args.includes('--best');
  const rawQuery=args.find(a=>!a.startsWith('-')&&a!=='sell');
  const packScope=args.includes('--pack')||rawQuery==='pack-dups'||rawQuery==='pack-duplicates';
  const query=(rawQuery==='pack-dups'||rawQuery==='pack-duplicates')?'dups':rawQuery;
  const copiesByNum={};
  for(let i=0;i<col.cards.length;i++){
    const c=col.cards[i];
    (copiesByNum[c.cardNum]||(copiesByNum[c.cardNum]=[])).push({...c,idx:i});
  }
  if(packScope){
    const batch=getLatestAcquisitionBatch(col);
    if(!batch?.id){
      console.log(`\n  ✅ No acquisition batch recorded for the latest pack.\n`);
      return;
    }
    const targets=col.cards.map((c,idx)=>({...c,idx})).filter(c=>c.acquiredBatchId===batch.id&&c.acquiredIsDuplicate);
    if(!targets.length){
      console.log(`\n  ✅ No duplicates in the latest pack.\n`);
      return;
    }
    let totalSold=0,totalCards=0;
    const sold=[];
    const removals=[];
    for(const c of targets){
      sold.push({num:c.cardNum,cardNum:c.cardNum,name:c.name,parallel:c.parallel,hint:(c.quality?.hints?.[0]||c.condition||''),grade:c.grade,graded:c.graded,price:c.marketPrice||c.price});
      totalSold+=c.marketPrice||c.price;totalCards++;
      removals.push(c);
    }
    removals.sort((a,b)=>b.idx-a.idx);
    for(const c of removals){
      col.cards.splice(c.idx,1);
      col.stats.total--;
      col.stats.value-=(c.marketPrice||c.price);
    }
    cfg.wallet+=totalSold;saveCfg(cfg);col.wallet=cfg.wallet;rebuildPulls(col);
    const set=loadSet();
    if(set) tickMarketOnChange(set,col,sold);
    saveCol(col);
    if(set)updateChecklist(set,col);
    logHistory('sell-dups-pack',`${totalCards} cards (${fm$(totalSold)})`,cfg.wallet-totalSold,cfg.wallet,{batchId:batch.id});
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  💸 SOLD ${totalCards} DUPLICATES FROM LATEST PACK`);
    console.log(`${'═'.repeat(52)}`);
    for(const s of sold){
      const gTag=s.graded?` G${s.grade}`:'';
      console.log(`  ${s.num} ${s.name} — ${s.parallel}${gTag} ${fm$(s.price)}`);
    }
    console.log(`${'─'.repeat(52)}`);
    console.log(`  Total raised: ${fm$(totalSold)} | Wallet: ${fm$(cfg.wallet)}`);
    console.log(`  Collection: ${col.cards.length} cards (${Object.keys(col.pulls).length} unique)`);
    console.log(`${'═'.repeat(52)}\n`);
    return;
  }
  if(!query||query==='dups'||query==='duplicates'){
    // bulk sell: for every card number with count > 1, sell cheapest copies (keep 1 best)
    const dupNums=Object.entries(col.pulls).filter(([,v])=>v>1);
    if(!dupNums.length){console.log(`\n  ✅ No duplicates to sell.\n`);return}
    let totalSold=0,totalCards=0;const sold=[];
    const removals=[];
    for(const[cn,count]of dupNums){
      const copies=(copiesByNum[cn]||[]).slice().sort((a,b)=>a.price-b.price);
      // keep the best (last in asc sort), sell the rest
      const toSell=sellBest?copies.slice(0,-1).reverse():copies.slice(0,-1);
      for(const c of toSell){
        sold.push({num:cn,cardNum:cn,name:c.name,parallel:c.parallel,hint:(c.quality?.hints?.[0]||c.condition||''),grade:c.grade,graded:c.graded,price:c.marketPrice||c.price});
        totalSold+=c.marketPrice||c.price;totalCards++;
        removals.push(c);
      }
      col.pulls[cn]=1;
    }
    removals.sort((a,b)=>b.idx-a.idx);
    for(const c of removals){
      col.cards.splice(c.idx,1);
      col.stats.total--;
      col.stats.value-=(c.marketPrice||c.price);
    }
    const sellBefore=cfg.wallet-totalSold;
    cfg.wallet+=totalSold;saveCfg(cfg);col.wallet=cfg.wallet;rebuildPulls(col);
    // Market tick: selling cards adds supply to the secondary market
    const set=loadSet();
    if(set) tickMarketOnChange(set,col,sold);
    saveCol(col);
    if(set)updateChecklist(set,col);
    logHistory('sell-dups',`${totalCards} cards (${fm$(totalSold)})`,sellBefore,cfg.wallet);
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  💸 SOLD ${totalCards} DUPLICATES`);
    console.log(`${'═'.repeat(52)}`);
    for(const s of sold){
      const gTag=s.graded?` G${s.grade}`:'';
      console.log(`  ${s.num} ${s.name} — ${s.parallel}${gTag} ${fm$(s.price)}`);
    }
    console.log(`${'─'.repeat(52)}`);
    console.log(`  Total raised: ${fm$(totalSold)} | Wallet: ${fm$(cfg.wallet)}`);
    console.log(`  Collection: ${col.cards.length} cards (${Object.keys(col.pulls).length} unique)`);
    console.log(`${'═'.repeat(52)}\n`);
    return;
  }
  // single card sell
  const matches=(copiesByNum[query]||[]).slice();
  if(!matches.length){console.log(`\n  ❌ Card #${query} not in collection.\n`);return}
  // default: sell cheapest. --best: sell most expensive
  const sorted=matches.sort((a,b)=>a.price-b.price);
  const card=sellBest?sorted[sorted.length-1]:sorted[0];
  const pullCount=(col.pulls[query]||0);
  const allCopies=sorted.map(c=>{
    const aq=c.quality;
    const hint=typeof aq==='string'?aq:(aq?.hints?.slice(0,1).join('; ')||'');
    const gTag=c.graded?`G${c.grade} `:'';
    const sellPrice=card.marketPrice||card.price;
    return `  ${PAR_EMOJI[c.parallel]||''} ${pR(gTag+c.parallel+' '+hint,30)} ${fm$(sellPrice).padStart(8)}`;
  });
  const modeLabel=sellBest?'💎 BEST COPY':'🔻 CHEAPEST COPY';
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  💸 SELLING: ${card.name} (#${query}) — ${modeLabel}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Your copies of this card:`);
  allCopies.forEach((line,i)=>{
    const marker=(i===(sellBest?sorted.length-1:0))?'  ← SELLING':'';
    console.log(line+marker);
  });
  console.log(`${'─'.repeat(52)}`);
  const finalPrice=card.marketPrice||card.price;
  console.log(`  Sale price: ${fm$(finalPrice)} | Remaining: ${pullCount-1} cop${pullCount-1!==1?'ies':'y'}`);
  col.cards.splice(card.idx,1);
  col.stats.total--;col.stats.value-=finalPrice;
  if(pullCount<=1){delete col.pulls[query]}
  else{col.pulls[query]=pullCount-1}
  const sellBefore=cfg.wallet-finalPrice;
  cfg.wallet+=finalPrice;saveCfg(cfg);col.wallet=cfg.wallet;rebuildPulls(col);
  // Market tick: selling a card adds supply to the secondary market
  const set=loadSet();
  if(set) tickMarketOnChange(set,col,[{cardNum:query,parallel:card.parallel,price:finalPrice}]);
  saveCol(col);
  if(set)updateChecklist(set,col);
  logHistory('sell',`#${query} ${card.name} (${fm$(finalPrice)})`,sellBefore,cfg.wallet);
  console.log(`  Wallet: ${fm$(cfg.wallet)}`);
  console.log(`  Collection: ${col.cards.length} cards (${Object.keys(col.pulls).length} unique), ${fm$(col.stats.value)} value`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdGradeCard(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||!col.cards.length){console.log('Collection is empty.');return}
  const set=loadSet();
  const args=process.argv.slice(2);
  const gradeAll=args.includes('--all');
  const gradeDups=args.includes('--dups');
  const query=args.find(a=>!a.startsWith('-')&&a!=='grade-card');
  const cardEntries=col.cards.map((c,i)=>({...c,idx:i}));

  let targets=[];
  if(gradeAll){
    targets=cardEntries.filter(c=>!c.graded);
    if(!targets.length){console.log(`\n  ✅ All cards already graded.\n`);return}
  } else if(gradeDups){
    const dupNums=new Set(Object.entries(col.pulls).filter(([,v])=>v>1).map(([n])=>n));
    targets=cardEntries.filter(c=>dupNums.has(c.cardNum)&&!c.graded);
    if(!targets.length){console.log(`\n  ✅ No ungraded duplicates.\n`);return}
  } else {
    if(!query){console.log('Usage: card-engine grade-card <card-num>');console.log('       card-engine grade-card --all  (all ungraded)');console.log('       card-engine grade-card --dups (ungraded dups only)');return}
    targets=cardEntries.filter(c=>c.cardNum===query&&!c.graded);
    if(!targets.length){
      // check if already graded
      const existing=cardEntries.filter(c=>c.cardNum===query&&c.graded);
      if(existing.length){console.log(`\n  ℹ️  Card #${query} already graded: ${(GRADES.find(x=>x.grade===existing[0].grade)||GRADES[2]).name}\n`);return}
      console.log(`\n  ❌ Card #${query} not in collection.\n`);return
    }
  }

  // Calculate per-card cost based on PSA declared value tiers
  const costBreakdown=targets.map(mc=>{
    const c=col.cards[mc.idx];
    const declaredValue=c.price||10;
    const tier=psaTierForValue(declaredValue);
    return {idx:mc.idx,cardNum:c.cardNum,parallel:c.parallel,declaredValue,tier,tierFee:tier.fee};
  });
  const totalCost=costBreakdown.reduce((s,b)=>s+b.tierFee,0);

  const label=gradeAll?'ALL UNGRADED':gradeDups?'ALL UNGRADED DUPS':`#${query}`;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🔬 PSA GRADING — ${label} (${targets.length} cards)`);
  console.log(`${'═'.repeat(56)}`);

  // Show cost breakdown for bulk submissions
  if(targets.length>1){
    console.log(`  Cost breakdown (PSA value tiers):\n`);
    // Group by tier for summary
    const byTier={};
    for(const b of costBreakdown){
      const k=b.tier.name;
      if(!byTier[k]) byTier[k]={fee:b.tierFee,count:0};
      byTier[k].count++;
    }
    for(const[t,d]of Object.entries(byTier)){
      console.log(`    ${t.padEnd(16)} $${d.fee}/card × ${d.count} = $${d.fee*d.count}`);
    }
    console.log(`\n  ${'─'.repeat(52)}`);
    console.log(`  Total cost: ${fm$(totalCost)}  |  Wallet: ${fm$(cfg.wallet)}`);
    console.log(`${'═'.repeat(56)}\n`);
  } else {
    const b=costBreakdown[0];
    console.log(`  Declared value: ${fm$(b.declaredValue)} → ${b.tier.name} tier ($${b.tier.fee}/card)`);
    console.log(`  Wallet: ${fm$(cfg.wallet)}\n`);
  }

  // Check wallet balance
  if(cfg.wallet<totalCost){
    console.log(`  ❌ Insufficient funds. Need ${fm$(totalCost)}, have ${fm$(cfg.wallet)}.\n`);
    if(targets.length>1) console.log(`  Tip: Try grading fewer cards or selling some to raise funds.\n`);
    return;
  }

  const beforeWallet=cfg.wallet;
  cfg.wallet-=totalCost;saveCfg(cfg);

  let gradeValueBoost=0;
  for(const b of costBreakdown){
    const c=col.cards[b.idx];
    const oldQuality=c.quality;
    c.graded=true;
    const g=rollGrade();

    console.log(`  📋 ${PAR_EMOJI[c.parallel]||''} ${c.parallel}${c.serStr?' '+c.serStr:''} — ${b.tier.name} ($${b.tierFee})`);
    if(typeof oldQuality==='object'&&oldQuality.hints){
      console.log(`     Hints:`);
      oldQuality.hints.forEach(h=>console.log(`       • ${h}`));
    }
    console.log(`  ${'─'.repeat(48)}`);
    console.log(`  🏷️  GRADE: ${g.name}`);
    c.grade=g.grade;

    // Recalculate price with grade multiplier
    if(set){
      const baseCard=set.cards.find(s=>s.num===c.cardNum);
      const par=PARALLELS.find(p=>p.name===c.parallel)||PARALLELS[0];
      const sp=SPECIALS.find(s=>s.name===c.special)||{mult:1};
      const newPrice=calcPrice(baseCard||{basePrice:c.price},par,sp,{mult:g.mult,grade:g.grade},c.sn);
      if(Math.abs(newPrice-c.price)>0.01){
        const diff=newPrice-c.price;
        gradeValueBoost+=diff;
        c.price=newPrice;
        console.log(`  📈 Recalculated: ${fm$(newPrice)} (${diff>=0?'+':''}${diff.toFixed(2)} from grade)`);
      }
    }
    console.log();
  }
  col.stats.value+=gradeValueBoost;
  col.wallet=cfg.wallet;
  rebuildPulls(col);saveCol(col);
  if(set)updateChecklist(set,col);
  console.log(`${'─'.repeat(56)}`);
  console.log(`  Grading fee: -${fm$(totalCost)} | Wallet: ${fm$(cfg.wallet)}`);
  if(gradeValueBoost!==0) console.log(`  Portfolio value change: ${gradeValueBoost>=0?'+':''}${fm$(gradeValueBoost)}`);
  logHistory('grade-card',`${targets.length} cards (${fm$(totalCost)})`,beforeWallet,cfg.wallet);
  console.log(`${'═'.repeat(56)}\n`);
}

// ─── HISTORY LOG ────────────────────────────────────────────────────
const HISTORY_FILE=path.join(DATA_DIR,'history.jsonl');
function logHistory(action, details, walletBefore, walletAfter, extra){
  const entry={timestamp:new Date().toISOString(), action, details, walletBefore, walletAfter,...(extra||{})};
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry)+'\n');
}
function readHistory(count){
  if(!fs.existsSync(HISTORY_FILE)) return [];
  const lines=fs.readFileSync(HISTORY_FILE,'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-count).map(l=>JSON.parse(l));
}

function cmdUndo(n){
  if(!fs.existsSync(HISTORY_FILE)){console.log('\n  No history to undo.\n');return}
  n=Math.min(Math.max(parseInt(n)||1,1),5)
  const lines=fs.readFileSync(HISTORY_FILE,'utf8').trim().split('\n').filter(Boolean)
  const entries=lines.map(l=>JSON.parse(l))
  // find last N open-pack/open-box entries from the end
  const undoable=[];const indices=[]
  for(let i=entries.length-1;i>=0&&undoable.length<n;i--){
    const e=entries[i]
    if(e.action==='open-pack'||e.action==='open-box'){undoable.unshift(e);indices.unshift(i)}
  }
  if(!undoable.length){console.log('\n  No pack/box openings to undo.\n');return}
  // group by set
  const bySet={}
  for(const e of undoable){
    const sk=e.setCode;if(!bySet[sk])bySet[sk]=[]
    bySet[sk].push(e)
  }
  console.log(`\n${'═'.repeat(52)}`)
  console.log(`  ↩️  UNDO — ${undoable.length} opening${undoable.length>1?'s':''}`)
  console.log(`${'═'.repeat(52)}`)
  // process each set
  for(const[sk,ents] of Object.entries(bySet)){
    const col=loadCol(sk);if(!col){console.log(`  ⚠ Collection not found: ${sk}`);continue}
    const set=rJ(path.join(DATA_DIR,'sets',sk+'.json'));if(!set){console.log(`  ⚠ Set not found: ${sk}`);continue}
    const cfg=loadCfg()
    let totalCards=0,totalSpent=0,totalPacks=0,totalBoxes=0
    for(const e of ents){
      const ca=e.cardsAdded||0;totalCards+=ca
      totalSpent+=(e.walletBefore-e.walletAfter)||0
      if(e.action==='open-pack')totalPacks++
      if(e.action==='open-box'){totalBoxes++;totalPacks+=(e.packsInBox||PACKS[e.packType]?.packs||1)}
      // restore wallet
      cfg.wallet=e.walletBefore
    }
    // remove last totalCards from collection
    const removed=col.cards.splice(-totalCards,totalCards)
    // recalc hits, value, ones, bestPull, parallelCounts, pulls
    col.stats.total=col.cards.length
    col.stats.value=col.cards.reduce((s,c)=>s+(c.marketPrice||c.price),0)
    col.stats.packs=Math.max(0,col.stats.packs-totalPacks)
    col.stats.boxes=Math.max(0,col.stats.boxes-totalBoxes)
    col.stats.spent=Math.max(0,col.stats.spent-totalSpent)
    col.stats.hits=col.cards.filter(c=>c.isHit).length
    col.stats.oneOfOnes=col.cards.filter(c=>c.sn===1&&(c.ser||1)===1).length
    col.parallelCounts={}
    for(const c of col.cards)col.parallelCounts[c.parallel]=(col.parallelCounts[c.parallel]||0)+1
    rebuildPulls(col)
    col.bestPull=col.cards.length?col.cards.reduce((a,b)=>b.price>a.price?b:a,col.cards[0]):null
    col.wallet=cfg.wallet
    saveCfg(cfg);saveCol(col)
    updateChecklist(set,col)
    const roi=totalSpent>0?((removed.reduce((s,c)=>s+c.price,0)-totalSpent)/totalSpent*100):0
    console.log(`  📦 ${ents.length} opening(s) undone — ${set.name} ${set.year}`)
    console.log(`  Cards removed: ${removed.length} | Wallet restored: ${fm$(cfg.wallet)}`)
    console.log(`  Packs: -${totalPacks} | Boxes: -${totalBoxes} | Spent: -${fm$(totalSpent)}`)
    console.log(`  Removed value: ${fm$(removed.reduce((s,c)=>s+c.price,0))} (ROI: ${roi>=0?'+':''}${roi.toFixed(1)}%)`)
  }
  // remove history entries
  const remaining=lines.filter((_,i)=>!indices.includes(i))
  fs.writeFileSync(HISTORY_FILE,remaining.join('\n')+'\n')
  console.log(`${'═'.repeat(52)}\n`)
}

function cmdRemoveMoney(){
  const sub=args.find(a=>!a.startsWith('-')&&a!=='remove-money');
  const cfg=loadCfg();
  const amt=parseFloat(sub);
  if(isNaN(amt)||amt<=0){console.log(`\n  Usage: card-engine remove-money <amount>\n`);return;}
  if(cfg.wallet<amt){console.log(`\n  ❌ Need ${fm$(amt)}, have ${fm$(cfg.wallet)}\n`);return;}
  const before=cfg.wallet;
  cfg.wallet=Math.round((cfg.wallet-amt)*100)/100;
  saveCfg(cfg);
  const col=cfg.activeSet?loadCol():null;
  if(col){col.wallet=cfg.wallet;saveCol(col);}
  logHistory('remove-money',`-$${amt.toFixed(2)}`,before,cfg.wallet);
  console.log(`\n  💸 -${fm$(amt)} removed from wallet`);
  console.log(`  New balance: ${fm$(cfg.wallet)}\n`);
}

function cmdAddMoney(){
  const sub=args.find(a=>!a.startsWith('-')&&a!=='add-money');
  const cfg=loadCfg();
  const amt=sub?parseFloat(sub):(cfg.pocketMoney||5);
  if(isNaN(amt)||amt<=0){console.log(`\n  Usage: card-engine add-money [amount]\n  Default: $${cfg.pocketMoney||5} (pocketMoney in config)\n`);return;}
  const before=cfg.wallet;
  cfg.wallet=Math.round((cfg.wallet+amt)*100)/100;
  saveCfg(cfg);
  const col=cfg.activeSet?loadCol():null;
  if(col){col.wallet=cfg.wallet;saveCol(col);}
  logHistory('add-money',`+$${amt.toFixed(2)}`,before,cfg.wallet);
  console.log(`\n  💰 +${fm$(amt)} added to wallet`);
  console.log(`  New balance: ${fm$(cfg.wallet)}\n`);
}

function cmdSetMoney(){
  const sub=args.find(a=>!a.startsWith('-')&&a!=='set-money');
  if(!sub){console.log(`\n  Usage: card-engine set-money <amount>\n`);return;}
  const amt=parseFloat(sub);
  if(isNaN(amt)){console.log(`\n  ❌ Invalid amount: ${sub}\n`);return;}
  const cfg=loadCfg();
  const before=cfg.wallet;
  cfg.wallet=Math.round(amt*100)/100;
  saveCfg(cfg);
  const col=cfg.activeSet?loadCol():null;
  if(col){col.wallet=cfg.wallet;saveCol(col);}
  logHistory('set-money',`${fm$(before)} → ${fm$(cfg.wallet)}`,before,cfg.wallet);
  console.log(`\n  💰 Wallet set to ${fm$(cfg.wallet)} (was ${fm$(before)})\n`);
}

function cmdDuplicates(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||col.cards.length===0){console.log('Collection is empty.');return}
  const set=loadSet();
  // group by cardNum+parallel
  const groups={};
  for(const c of col.cards){
    const k=c.cardNum+'|'+c.parallel;
    if(!groups[k])groups[k]={cardNum:c.cardNum,name:c.name,parallel:c.parallel,copies:[],price:c.price};
    groups[k].copies.push(c);
  }
  const dups=Object.values(groups).filter(g=>g.copies.length>1).sort((a,b)=>b.copies.length-a.copies.length);
  if(!dups.length){console.log(`\n  ✅ No duplicates found.\n`);return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🔢 DUPLICATES (${dups.length} groups, ${dups.reduce((s,g)=>s+g.copies.length,0)} cards)`);
  console.log(`${'═'.repeat(52)}`);
  for(const g of dups){
    const best=g.copies.sort((a,b)=>b.price-a.price)[0];
    const totalVal=g.copies.reduce((s,c)=>s+(c.marketPrice||c.price),0);
    const pe=PAR_EMOJI[g.parallel]||'';
    console.log(`  ${g.cardNum} ${pR(g.name,25)} ${pe}${pR(g.parallel,18)} x${g.copies.length} ${fm$(best.price).padStart(7)} ea  total: ${fm$(totalVal)}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTopCards(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||col.cards.length===0){console.log('Collection is empty.');return}
  const set=loadSet();
  const byGrade=args.includes('--grade');
  const sorted=[...col.cards].sort((a,b)=>byGrade?(b.grade||0)-(a.grade||0):(b.marketPrice||b.price)-(a.marketPrice||a.price)).slice(0,20);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🏆 TOP ${byGrade?'GRADE':'VALUE'} CARDS`);
  console.log(`${'═'.repeat(52)}`);
  for(let i=0;i<sorted.length;i++){
    const c=sorted[i];const pe=PAR_EMOJI[c.parallel]||'';const te=TIER_EMOJI[c.starTier]||'';
    const val=fm$(c.marketPrice||c.price);
    const gStr=c.grade?`G${c.grade}`:'—';
    const qty=col.cards.filter(x=>x.cardNum===c.cardNum&&x.parallel===c.parallel).length;
    const dupTag=qty>1?` ×${qty}`:'';
    console.log(`  ${String(i+1).padStart(2)}. ${te}${c.cardNum} ${pR(c.name,25)} ${pe}${pR(c.parallel,16)} ${pR(gStr,4)} ${val.padStart(8)}${dupTag}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdPackStats(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col){console.log('No collection.');return}
  const s=col.stats;
  const hitRatePack=s.packs>0?(s.hits/s.packs).toFixed(2):'—';
  const hitRateBox=s.boxes>0?(s.hits/s.boxes).toFixed(1):'—';
  const avgSpend=s.packs>0?(s.spent/s.packs).toFixed(2):'—';
  const bestPar=col.bestPull?col.bestPull.parallel:'—';
  const bestVal=col.bestPull?fm$(col.bestPull.price):'—';
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 PACK STATS`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Packs opened:    ${s.packs}`);
  console.log(`  Boxes opened:    ${s.boxes}`);
  console.log(`  Total cards:     ${s.total}`);
  console.log(`  Hits:            ${s.hits} (${hitRatePack}/pack, ${hitRateBox}/box)`);
  console.log(`  1/1s pulled:     ${s.oneOfOnes}`);
  console.log(`  Best parallel:   ${bestPar} (${bestVal})`);
  console.log(`  Total spent:     ${fm$(s.spent)}`);
  console.log(`  Avg spend/pack:  ${fm$(parseFloat(avgSpend))}`);
  if(col.parallelCounts&&Object.keys(col.parallelCounts).length){
    console.log(`\n  PARALLEL DISTRIBUTION:`);
    const sorted=Object.entries(col.parallelCounts).sort((a,b)=>b[1]-a[1]);
    for(const[par,count]of sorted){
      const pe=PAR_EMOJI[par]||'';
      const bar='█'.repeat(Math.min(count,30));
      console.log(`  ${pe} ${pR(par,18)} ${String(count).padStart(4)} ${bar}`);
    }
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdHistory(){
  const allFlag=args.includes('--all');
  const countIdx=args.indexOf('--count');
  const count=allFlag?999999:(countIdx>=0?parseInt(args[countIdx+1])||20:20);
  const entries=readHistory(count);
  if(!entries.length){console.log(`\n  📜 No transaction history yet.\n`);return}
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  📜 TRANSACTION HISTORY (last ${entries.length})`);
  console.log(`${'═'.repeat(60)}`);
  for(const e of entries){
    const ts=e.timestamp.split('T')[0]+' '+e.timestamp.split('T')[1]?.slice(0,8);
    const diff=e.walletAfter-e.walletBefore;
    const sign=diff>=0?'+':'';
    console.log(`  ${ts} │ ${pR(e.action,14)} ${pR(e.details,25)} │ ${sign}${fm$(diff).padStart(9)} → ${fm$(e.walletAfter)}`);
  }
  console.log(`${'═'.repeat(60)}\n`);
}

function cmdWallet(){
  const cfg=loadCfg();
  const col=cfg.activeSet?loadCol():null;
  const assets=col?col.stats.value:0;
  const sealedValue=col?getSealedInventoryValue(col):0;
  const netWorth=cfg.wallet+assets+sealedValue;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  💰 WALLET & NET WORTH`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Cash:          ${fm$(cfg.wallet)}`);
  console.log(`  Collection:    ${fm$(assets)} (${col?col.stats.total:0} cards)`);
  console.log(`  Sealed stock:   ${fm$(sealedValue)}`);
  if(col&&sealedValue>0) console.log(`  Inventory:      ${formatSealedInventorySummary(col)}`);
  console.log(`  Net Worth:     ${fm$(netWorth)}`);
  console.log(`  P/L:           ${col?(((col.stats.value+sealedValue)-col.stats.spent>=0?'+':'')+fm$((col.stats.value+sealedValue)-col.stats.spent)):'$0.00'}`);
  console.log(`${'═'.repeat(50)}\n`);
}

function cmdResetCollection(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  if(!args.includes('--confirm')){
    console.log(`\n  ⚠️  This will WIPE all cards, stats, and reset wallet for: ${cfg.activeSet}`);
    console.log(`  Use: card-engine reset-collection --confirm\n`);return;
  }
  const col=loadCol();if(!col){console.log('No collection.');return}
  const before=cfg.wallet;
  col.cards=[];col.pulls={};col.parallelCounts={};col.stats={total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0};col.bestPull=null;col.sealedInventory={};
  cfg.wallet=50;col.wallet=50;saveCfg(cfg);saveCol(col);
  logHistory('reset-collection',cfg.activeSet,before,cfg.wallet);
  const set=loadSet();if(set)updateChecklist(set,col);
  console.log(`\n  🔄 Collection reset. Wallet: ${fm$(cfg.wallet)}\n`);
}

function cmdListSets(){
  const cfg=loadCfg();const ar=cfg.archivedSets||[];
  console.log(`\n${'═'.repeat(50)}`);console.log(`  📁 SETS HISTORY`);console.log(`${'═'.repeat(50)}`);
  if(cfg.activeSet){const col=loadCol();const set=loadSet();
    if(set&&col)console.log(`  ⭐ ${set.name} (${set.code}) — ${col.stats.total} cards, ${fm$(col.stats.value)} [ACTIVE]`)}
  for(const a of ar){const s=rJ(path.join(DATA_DIR,'sets',a.setKey+'.json'));
    console.log(`  📁 ${a.setKey} — ${a.totalCards||'?'} cards, ${fm$(a.stats?.value||0)} [${a.archivedAt?.split('T')[0]}]`)}
  console.log(`${'═'.repeat(50)}\n`);
}

// ─── STORE SYSTEM ──────────────────────────────────────────────────
const STORES_DIR=path.join(DATA_DIR,'stores');
const SCALPERS_DIR=path.join(DATA_DIR,'scalpers');

function loadDefaultStores(){return rJ(path.join(STORES_DIR,'default-stores.json'))||[]}
function loadStoreState(){
  const s=rJ(path.join(STORES_DIR,'state.json'));
  if(s) return s;
  // Initialize
  const defaults=loadDefaultStores();
  const now=Date.now();
  const state={lastSimulation:now, stores:{}, relationships:{}, purchaseHistory:[]};
  for(const d of defaults){
    state.stores[d.id]={lastRestock:now, inventory:{}, lastVisited:0};
    state.relationships[d.id]={totalSpent:0, purchaseCount:0, tier:0};
  }
  wJ(path.join(STORES_DIR,'state.json'),state);
  return state;
}
function saveStoreState(s){wJ(path.join(STORES_DIR,'state.json'),s)}

function loadDefaultScalpers(){return rJ(path.join(SCALPERS_DIR,'default-scalpers.json'))||[]}
function loadScalperState(){
  const s=rJ(path.join(SCALPERS_DIR,'state.json'));
  if(s){
    s.scalpers=s.scalpers||{};
    s.activityLog=Array.isArray(s.activityLog)?s.activityLog:[];
    for(const d of loadDefaultScalpers()){
      const scalper=s.scalpers[d.id]||{};
      s.scalpers[d.id]={
        ...d,
        ...scalper,
        cash:Number.isFinite(scalper.cash)?scalper.cash:d.cash,
        inventory:Array.isArray(scalper.inventory)?scalper.inventory:[],
        listings:Array.isArray(scalper.listings)?scalper.listings:[],
        lastAction:Number.isFinite(scalper.lastAction)?scalper.lastAction:Date.now(),
      };
    }
    return s;
  }
  const defaults=loadDefaultScalpers();
  const now=Date.now();
  const state={lastSimulation:now, scalpers:{}, activityLog:[]};
  for(const d of defaults){
    state.scalpers[d.id]={...d, cash:d.cash, inventory:[], listings:[], lastAction:now};
  }
  wJ(path.join(SCALPERS_DIR,'state.json'),state);
  return state;
}
function saveScalperState(s){wJ(path.join(SCALPERS_DIR,'state.json'),s)}

function getRelationshipTier(store, rel){
  const thresholds=store.relationshipThresholds||[100,500,2000,5000,15000];
  let tier=0;
  for(let i=0;i<thresholds.length;i++){if(rel.totalSpent>=thresholds[i])tier=i+1}
  return tier;
}
function getRelationshipDiscount(store, rel){
  const tier=getRelationshipTier(store, rel);
  // Tiers 0-4 get 0%, 2%, 5%, 8%, 12% discount
  const discounts=[0, 0.02, 0.05, 0.08, 0.12];
  return discounts[tier]||0;
}

function getRecentScalperBuyQty(storeId, days=7){
  const scalperState=loadScalperState()
  const cutoff=Date.now()-days*24*60*60*1000
  let qty=0
  for(const e of scalperState.activityLog||[]){
    if(e.storeId===storeId&&e.action==='buy'&&e.timestamp>=cutoff) qty+=(e.qty||1)
  }
  return qty
}

function getStoreInventoryProfile(store, setKey){
  const market=loadMarket(setKey)
  const hot=isSetHot(setKey)
  const flopps=loadFloppsState()
  const currentDay=market?getSimulationDay(market):(flopps.lastSeenDay>=0?flopps.lastSeenDay:0)
  const release=getFloppsReleaseWindow(flopps, currentDay)
  const corp=flopps.corporation||floppsDefaultCorporation()
  const recentScalperQty=getRecentScalperBuyQty(store.id)
  const scalperPressure=Math.min(1.5, recentScalperQty/12)
  const sentiment=market?.sentiment||1
  const typeBase=store.type==='bigbox'?1.35:store.type==='online'?0.9:1.0
  const typeProductScale={
    hobby:store.type==='bigbox'?0.8:store.type==='online'?1.05:1.1,
    blaster:store.type==='bigbox'?1.2:store.type==='online'?0.9:1.0,
    retail:store.type==='bigbox'?1.35:store.type==='online'?0.65:0.95,
    jumbo:store.type==='bigbox'?1.1:store.type==='online'?0.85:1.0,
  }
  const hotPenalty=hot?{
    hobby:0.55,
    blaster:0.72,
    retail:0.82,
    jumbo:0.76,
  }:{hobby:1,blaster:1,retail:1,jumbo:1}
  const scalperPenalty=Math.max(0.58,1-scalperPressure*0.18)
  const sentimentBias=Math.max(0.85,Math.min(1.15,0.9+sentiment*0.1))
  const allocationMultiplier=Math.max(0.48,1-corp.allocationTightness*0.22-(release.phase.id==='launch'?0.14:0)-(release.phase.id==='sellthrough'?0.08:0))
  const distributorLagRisk=clamp01(0.05+corp.retailerStress*0.28+(release.phase.id==='launch'?0.14:0)+(scalperPressure*0.08))
  const releasePhase=release.phase.id
  return {hot, recentScalperQty, scalperPressure, typeBase, typeProductScale, hotPenalty, scalperPenalty, sentimentBias, allocationMultiplier, distributorLagRisk, releasePhase, corporation:corp}
}

function calcStoreInventoryQty(store, setKey, type, rng, range){
  const profile=getStoreInventoryProfile(store, setKey)
  const base=ri(rng, range[0], range[1])
  const scale=profile.typeBase
    *(profile.typeProductScale[type]||1)
    *(profile.hotPenalty[type]||1)
    *profile.scalperPenalty
    *profile.sentimentBias
    *profile.allocationMultiplier
  return Math.max(1, Math.round(base*scale))
}

function ensureStoreInventory(state, store, setKey){
  const inv=state.stores[store.id].inventory;
  if(!inv[setKey]){
    // Initialize stock for this set
    const range=store.stockRange||[5,10];
    const rng=mulberry32(Date.now()+store.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0));
    inv[setKey]={};
    for(const[type, pt] of Object.entries(PACKS)){
      // Big box stores don't carry hobby
      if(store.sellsHobby===false&&type==='hobby') continue;
      // Online doesn't carry retail/blaster as prominently
      if(store.type==='online'&&type==='retail') continue;
      const qty=calcStoreInventoryQty(store, setKey, type, rng, range);
      inv[setKey][type]=qty;
    }
  }
}

function cmdMarketMacro(){
  const macro=getMacroState();
  const signal=macro.signal||0;
  const label=signal>0.35?'📈 Risk-on':signal<-0.35?'📉 Risk-off':'➡️ Mixed';
  const ageHours=macro.lastFetch?((Date.now()-macro.lastFetch)/36e5).toFixed(1):'unknown';
  const updatedAt=macro.updatedAt?new Date(macro.updatedAt).toLocaleString():'unknown';
  const latest=macro.latest?.value!=null?fm$(macro.latest.value):'n/a';
  const weekPct=Number.isFinite(macro.weekPct)?macro.weekPct.toFixed(2):'0.00';
  const monthPct=Number.isFinite(macro.monthPct)?macro.monthPct.toFixed(2):'0.00';
  const compositePct=Number.isFinite(macro.compositePct)?macro.compositePct.toFixed(2):'0.00';

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🌐 MARKET MACRO`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Source:      ${macro.source||'FRED SP500'}`);
  console.log(`  Label:       ${label}`);
  console.log(`  Composite:   ${macro.compositePct>=0?'+':''}${compositePct}%`);
  console.log(`  Week change: ${macro.weekPct>=0?'+':''}${weekPct}%`);
  console.log(`  Month change:${macro.monthPct>=0?'+':''}${monthPct}%`);
  console.log(`  Latest SP500:${latest}${macro.latest?.date?` (${macro.latest.date})`:''}`);
  console.log(`  Updated:     ${updatedAt} (${ageHours}h ago)`);
  console.log(`  Cache rule:  refreshed at most once every 48h`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdFloppsStatus(){
  const state=loadFloppsState();
  const cfg=loadCfg();
  const set=cfg.activeSet?loadSet():null;
  const market=set?loadMarket(cfg.activeSet):null;
  if(set&&market){
    getFloppsSimulationContext(set,market,state);
    saveFloppsState(state);
  }
  const stock=state.stock||{price:100, history:[]};
  const latest=state.latestNews;
  const history=(stock.history||[]).slice(-5).reverse();
  const corp=state.corporation||floppsDefaultCorporation();
  const release=getFloppsReleaseWindow(state, state.lastSeenDay>=0?state.lastSeenDay:0);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏛️ FLOPPS PUBLIC COMPANY`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Ticker:      FLPS`);
  console.log(`  Share price: ${fm$(stock.price||100)}`);
  console.log(`  Last day:    ${state.lastSeenDay>=0?state.lastSeenDay:'n/a'}`);
  console.log(`  Last press:  ${latest?`${latest.title} (day ${latest.day})`:'none yet'}`);
  console.log(`  News count:  ${state.newsHistory?.length||0}`);
  console.log(`  Phase:       ${release.phase.label}`);
  if(release.current) console.log(`  Current set: ${release.current.title}`);
  if(release.next) console.log(`  Next launch: day ${release.next.day} — ${release.next.title}`);
  console.log(`  Exec focus:  ${pickFloppsExecutive(corp, release).name}`);
  if(state.trendDesk?.watchlist?.[0]) console.log(`  Trend pick:  ${state.trendDesk.watchlist[0].name} (${Math.round(state.trendDesk.watchlist[0].marketability*100)}%)`);
  if(latest){
    console.log(`\n  Latest bulletin:`);
    console.log(`  ${latest.summary}`);
    console.log(`  Translation: ${latest.paraphrase}`);
    if(latest.executiveRole) console.log(`  Spokesperson: ${latest.executiveRole} ${latest.executive}`);
    if(latest.kind) console.log(`  Type: ${latest.kind}`);
    if(latest.marketImpact) console.log(`  Market: ${latest.marketImpact}`);
    if(latest.collectorImpact) console.log(`  Collector effect: ${latest.collectorImpact}`);
    if(latest.source) console.log(`  Source: ${latest.source}`);
  }
  console.log(`\n  Corporate pressures:`);
  console.log(`  Scarcity ${Math.round(corp.scarcityIndex*100)}% │ Hype ${Math.round(corp.hypeIndex*100)}% │ Extraction ${Math.round(corp.extractionIndex*100)}%`);
  console.log(`  Collectors ${Math.round(corp.collectorStress*100)}% │ Retailers ${Math.round(corp.retailerStress*100)}% │ Labor ${Math.round(corp.laborStress*100)}%`);
  if(history.length){
    console.log(`\n  Recent FLPS prices:`);
    for(const point of history){
      console.log(`  Day ${point.day}: ${fm$(point.price)}${point.bulletin?` (${point.bulletin})`:''}${point.phase?` [${point.phase}]`:''}`);
    }
  }
  console.log(`${'═'.repeat(56)}\n`);
}

function getFloppsPriceForDay(state, day){
  const history=state?.stock?.history||[];
  if(!history.length) return state?.stock?.price||100;
  const exact=history.find((p)=>p.day===day);
  if(exact) return exact.price;
  const prior=[...history].filter((p)=>p.day<=day).sort((a,b)=>b.day-a.day)[0];
  if(prior) return prior.price;
  return history[0].price;
}

function cmdFloppsDay(dayArg){
  const state=loadFloppsState();
  const cfg=loadCfg();
  const set=cfg.activeSet?loadSet():null;
  const market=set?loadMarket(cfg.activeSet):null;
  if(set&&market){
    getFloppsSimulationContext(set,market,state);
    saveFloppsState(state);
  }
  const currentDay=market?getSimulationDay(market):state.lastSeenDay>=0?state.lastSeenDay:0;
  const requested=typeof dayArg==='string'?dayArg.trim().toLowerCase():'';
  const day=dayArg!=null && dayArg!=='' && requested!=='today' ? parseInt(dayArg,10) : currentDay;
  if(!Number.isFinite(day)){
    console.log('\n  Usage: card-engine flopps-day <day|today>\n');
    return;
  }
  const bulletin=(state.newsHistory||[]).filter((n)=>n.day===day).slice(-10);
  const price=getFloppsPriceForDay(state, day);
  const release=getFloppsReleaseWindow(state, day);
  const daySnapshot=(state.dayHistory||[]).find((entry)=>entry.day===day);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📰 FLOPPS DAY ${day}`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Ticker:      FLPS`);
  console.log(`  Price:       ${fm$(price)}`);
  console.log(`  Phase:       ${release.phase.label}`);
  if(release.current) console.log(`  Release:     ${release.current.title}`);
  console.log(`  News items:  ${bulletin.length}`);
  if(daySnapshot){
    console.log(`  Pressures:   collectors ${Math.round(daySnapshot.collectorStress*100)}% │ retailers ${Math.round(daySnapshot.retailerStress*100)}% │ labor ${Math.round(daySnapshot.laborStress*100)}%`);
    console.log(`  Executive:   ${daySnapshot.executiveFocus}`);
  }
  if(state.trendDesk?.watchlist?.[0]) console.log(`  Trend desk:  ${state.trendDesk.watchlist[0].name} (${Math.round(state.trendDesk.watchlist[0].marketability*100)}%)`);
  if(bulletin.length){
    for(const item of bulletin){
      console.log(`\n  ${item.title}`);
      console.log(`  ${item.summary}`);
      console.log(`  Translation: ${item.paraphrase}`);
      if(item.executiveRole) console.log(`  Spokesperson: ${item.executiveRole} ${item.executive}`);
      if(item.kind) console.log(`  Type: ${item.kind}`);
      if(item.marketImpact) console.log(`  Market: ${item.marketImpact}`);
      if(item.collectorImpact) console.log(`  Collector effect: ${item.collectorImpact}`);
      if(item.command) console.log(`  Triggered by: ${item.command}`);
    }
  } else {
    console.log(`\n  No Flopps bulletin was recorded for this day.`);
  }
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdFloppsToday(){
  const cfg=loadCfg();
  const set=cfg.activeSet?loadSet():null;
  const market=set?loadMarket(cfg.activeSet):null;
  const state=loadFloppsState();
  const day=market?getSimulationDay(market):(state.lastSeenDay>=0?state.lastSeenDay:0);
  cmdFloppsDay(day);
}

function cmdFloppsWildcard(){
  const state=loadFloppsState();
  const cfg=loadCfg();
  const set=cfg.activeSet?loadSet():null;
  const market=set?loadMarket(cfg.activeSet):null;
  if(!set||!market){
    console.log('\n  No active set/market for Flopps wildcard generation.\n');
    return;
  }
  const day=getSimulationDay(market);
  const currentDay=Number.isFinite(day)?day:(state.lastSeenDay>=0?state.lastSeenDay:0);
  ensureFloppsReleaseCalendar(state,set,currentDay);
  const ctx=getFloppsSimulationContext(set,market,state);
  const bulletin=maybeGenerateFloppsWildcardBulletin(state,ctx,currentDay,{force:true});
  if(!bulletin){
    console.log('\n  Flopps wildcard generation failed. Check OPENROUTER_API_KEY or network access.\n');
    return;
  }
  recordFloppsBulletin(state,ctx,bulletin,currentDay,'flopps-wildcard');
  console.log(`\n${formatFloppsNewsBlast(bulletin,state,ctx)}\n`);
}

function restockIfNeeded(state, store, setKey){
  const storeState=state.stores[store.id];
  const now=Date.now();
  const daysSinceRestock=(now-storeState.lastRestock)/(1000*60*60*24);
  if(daysSinceRestock>=store.restockDays){
    const inv=storeState.inventory[setKey];
    if(!inv) return;
    const range=store.stockRange||[5,10];
    const profile=getStoreInventoryProfile(store, setKey)
    for(const[type] of Object.entries(PACKS)){
      if(store.sellsHobby===false&&type==='hobby') continue;
      if(store.type==='online'&&type==='retail') continue;
      let restockQty=calcStoreInventoryQty(store, setKey, type, null, range);
      if(Math.random()<profile.distributorLagRisk){
        restockQty=Math.max(0,Math.round(restockQty*(0.35+Math.random()*0.4)));
      }
      inv[type]=(inv[type]||0)+restockQty;
    }
    storeState.lastRestock=now;
  }
}

function isSetHot(setKey){
  const cfg=loadCfg();
  if(!cfg.activeSet) return false;
  const market=loadMarket(setKey);
  if(!market) return false;
  // If sentiment > 1.15 and there's a bullish market event, set is hot.
  const hasBullishEvent=market.events?.some(e=>isBullishMarketEvent(e.type));
  return market.sentiment>1.15 || hasBullishEvent;
}

function getDemandFactor(setKey){
  const market=loadMarket(setKey);
  if(!market) return 1.0;
  // Average demand of superstar+legendary cards
  const cards=getMarketCardList(market);
  const hotCards=cards.filter(c=>c.starTier==='Superstar'||c.starTier==='Legendary');
  const avgDemand=hotCards.length>0?hotCards.reduce((s,c)=>s+c.demandScore,0)/hotCards.length:0;
  const macro=getMacroState();
  const macroTilt=Math.max(-0.03,Math.min(0.03,(macro.signal||0)*0.03));
  return 1.0 + avgDemand * 0.5 + macroTilt; // mostly market demand, tiny macro tilt
}

function calcStorePrice(store, packType, setKey, rel){
  const pt=PACKS[packType];
  if(!pt) return 0;
  const base=pt.price;
  const hot=isSetHot(setKey);
  const profile=getStoreInventoryProfile(store,setKey);
  const markup=hot ? (store.markupHot||0.2) : (store.markupBase||0.15);
  const demandFactor=getDemandFactor(setKey);
  const discount=getRelationshipDiscount(store, rel);
  const corpPremium=1+(profile.corporation.extractionIndex-0.5)*0.18+(profile.releasePhase==='launch'?0.06:0);
  return Math.max(1, Math.round(base * (1 + markup) * demandFactor * corpPremium * (1 - discount) * 100) / 100);
}

function cmdStore(){
  const sub=args[1];
  if(!sub||sub==='list') return cmdStoreList();
  if(sub==='visit') return cmdStoreVisit();
  if(sub==='buy') return cmdStoreBuy();
  if(sub==='stock') return cmdStoreStock();
  if(sub==='pressure') return cmdStorePressure();
  if(sub==='restock') return cmdStoreRestock();
  if(sub==='trade') return cmdStoreTrade();
  if(sub==='reputation') return cmdStoreReputation();
  console.log(`\n  Usage: card-engine store <list|visit|buy|stock|pressure|restock|trade|reputation>\n`);
}

function cmdStoreList(){
  const defaults=loadDefaultStores();
  const state=loadStoreState();
  const cfg=loadCfg();
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏪 STORES`);
  console.log(`${'═'.repeat(56)}`);
  for(const store of defaults){
    const rel=state.relationships[store.id]||{totalSpent:0,purchaseCount:0,tier:0};
    const tier=getRelationshipTier(store, rel);
    const benefit=store.relationshipBenefits[tier]||'No benefits yet';
    const tierLabel=tier>0?`Tier ${tier}`:'Stranger';
    const emoji=store.emoji||'🏪';
    const typeLabel=store.type==='lcs'?'Local Shop':store.type==='bigbox'?'Big Box':'Online';
    console.log(`\n  ${emoji} ${store.name} [${store.id}]`);
    console.log(`     ${typeLabel} │ ${store.description}`);
    console.log(`     Relationship: ${tierLabel} │ ${benefit}`);
    console.log(`     Spent: ${fm$(rel.totalSpent)} │ Purchases: ${rel.purchaseCount}`);
    // Show stock for active set
    if(cfg.activeSet){
      const inv=state.stores[store.id]?.inventory?.[cfg.activeSet];
      if(inv){
        const stockStr=Object.entries(PACKS).filter(([t])=>!(store.sellsHobby===false&&t==='hobby')&&!(store.type==='online'&&t==='retail'))
          .map(([t,pt])=>`${pt.name}: ${inv[t]||0}`).join(' │ ');
        console.log(`     Stock (${cfg.activeSet}): ${stockStr}`);
      }
    }
  }
  console.log(`\n  💰 Wallet: ${fm$(cfg.wallet)}`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdStoreVisit(){
  const storeId=args[2];
  if(!storeId){console.log(`\n  Usage: card-engine store visit <store-id>\n`);return}
  const defaults=loadDefaultStores();
  const store=defaults.find(s=>s.id===storeId);
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  const cfg=loadCfg();
  if(!cfg.activeSet){console.log(`\n  ❌ No active set. Generate one first.\n`);return}
  const setKey=cfg.activeSet;
  const set=loadSet();
  const state=loadStoreState();

  // Run scalper simulation first (they may have bought stock)
  simulateScalpersEnhanced(setKey);

  // Generate store sales
  const sales=generateStoreSales(setKey);
  const newSalesToAnnounce=sales.active.filter(s=>!s.announced);
  for(const s of newSalesToAnnounce) s.announced=true;
  if(newSalesToAnnounce.length) saveStoreSales(sales);

  // Ensure inventory and check restock
  ensureStoreInventory(state, store, setKey);
  restockIfNeeded(state, store, setKey);
  state.stores[store.id].lastVisited=Date.now();
  saveStoreState(state);

  // Reload to get fresh state
  const freshState=loadStoreState();
  const rel=freshState.relationships[store.id]||{totalSpent:0,purchaseCount:0,tier:0};
  const tier=getRelationshipTier(store, rel);
  const benefit=store.relationshipBenefits[tier]||'No benefits yet';
  const discount=getRelationshipDiscount(store, rel);
  const inv=freshState.stores[store.id].inventory[setKey];
  const {discount:saleDiscount, sale:activeSale, sales:activeSales}=getStoreSaleDiscount(storeId);

  console.log(`\n${'═'.repeat(56)}`);
  const restockProfile=getStoreInventoryProfile(store, setKey);
  console.log(`  Restock profile: ${store.type==='bigbox'?'Big box wholesale':store.type==='online'?'Online warehouse':'Local shop ordering'} | Scalper pressure: ${restockProfile.scalperPressure.toFixed(2)} | Hot set: ${restockProfile.hot?'yes':'no'}`);
  console.log(`  Flopps allocation: ${restockProfile.allocationMultiplier.toFixed(2)}x | Lag risk: ${Math.round(restockProfile.distributorLagRisk*100)}% | Phase: ${restockProfile.releasePhase}`);
  console.log(`  ${store.emoji||'🏪'} ${store.name.toUpperCase()}`);
  console.log(`  ${set.name} (${set.code})`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  ${store.description}`);
  console.log(`  Your tier: Tier ${tier} — ${benefit}`);
  if(discount>0) console.log(`  Loyalty discount: ${(discount*100).toFixed(0)}%`);
  console.log(`  Purchase limit: ${store.purchaseLimit} per product`);
  console.log(`${'─'.repeat(56)}`);

  const hot=isSetHot(setKey);
  if(hot) console.log(`  🔥 This set is HOT — limited restock!`);

  // Show active sales
  if(activeSale){
    const remaining=Math.max(0, Math.ceil(activeSale.durationHrs-Math.floor((Date.now()-activeSale.startedAt)/(60*60*1000))));
    const saleNames=activeSales.map(s=>s.name).join(' + ');
    console.log(`  ${saleNames} — ${saleDiscount>0?`Total -${Math.round(saleDiscount*100)}%!`:'Buy 2 Get 1 Free!'} (${remaining}h remaining)`);
  }

  const allowedTypes=Object.entries(PACKS).filter(([t])=>
    !(store.sellsHobby===false&&t==='hobby')&&!(store.type==='online'&&t==='retail'));

  for(const[type, pt] of allowedTypes){
    const stock=inv?.[type]||0;
    let price=calcStorePrice(store, type, setKey, rel);
    // Apply sale discount
    if(saleDiscount>0) price=Math.round(price*(1-saleDiscount)*100)/100;
    // B2G1: show effective price (3 for price of 2)
    const b2g1=activeSale&&activeSale.type==='b2g1';
    const effectivePrice=b2g1?Math.round(price*2/3*100)/100:price;
    const saleTag=saleDiscount>0?` 🔖SALE`:(b2g1?' 🎁B2G1':'');
    const msrp=pt.price;
    const diff=effectivePrice-msrp;
    const diffTag=diff>0?`+${fm$(diff)}`:diff<0?`-${fm$(Math.abs(diff))}`:'MSRP';
    const stockWarn=stock<=2?` ⚠️ LOW STOCK`:'';

    console.log(`\n  📦 ${pt.name} │ ${fm$(effectivePrice)} (${diffTag}) │ Stock: ${stock}${stockWarn}${saleTag}`);
    console.log(`     ${pt.packs} packs × ${pt.cpp} cards │ Hit rate: ${(pt.hitRate*100).toFixed(0)}%`);
    if(type==='hobby') console.log(`     Per pack: ${fm$(effectivePrice/pt.packs)}`);
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  💰 Wallet: ${fm$(cfg.wallet)}`);
  console.log(`  Use: card-engine store buy ${store.id} <hobby|blaster|retail|jumbo> [qty]`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdStoreBuy(){
  const storeId=args[2];
  const product=args[3];
  const qty=Math.min(parseInt(args[4])||1, 10);
  if(!storeId||!product){console.log(`\n  Usage: card-engine store buy <store-id> <hobby|blaster|retail|jumbo> [qty]\n`);return}
  if(!PACKS[product]){console.log(`\n  ❌ Unknown product: ${product}. Use hobby, blaster, retail, or jumbo.\n`);return}
  const defaults=loadDefaultStores();
  const store=defaults.find(s=>s.id===storeId);
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  if(store.sellsHobby===false&&product==='hobby'){console.log(`\n  ❌ ${store.name} doesn't carry hobby boxes.\n`);return}
  if(store.type==='online'&&product==='retail'){console.log(`\n  ❌ ${store.name} doesn't sell single retail packs.\n`);return}
  const cfg=loadCfg();
  if(!cfg.activeSet){console.log(`\n  ❌ No active set.\n`);return}
  const setKey=cfg.activeSet;
  const set=loadSet();
  const state=loadStoreState();
  ensureStoreInventory(state, store, setKey);
  const inv=state.stores[store.id].inventory[setKey]?.[product]||0;
  const rel=state.relationships[store.id]||{totalSpent:0,purchaseCount:0,tier:0};
  let price=calcStorePrice(store, product, setKey, rel);
  // Apply active sale discount
  const {discount:saleDiscount, sale:activeSale, sales:activeSales}=getStoreSaleDiscount(storeId);
  if(saleDiscount>0) price=Math.round(price*(1-saleDiscount)*100)/100;
  // B2G1: if buying 3, charge for 2
  const isB2G1=activeSale&&activeSale.type==='b2g1';
  const actualQty=isB2G1&&qty>=3?qty-1:qty;
  const totalCost=price*actualQty;

  if(inv<qty){
    // Check scalper competition
    const scalperState=loadScalperState();
    const botActivity=scalperState.activityLog.filter(a=>a.storeId===storeId&&a.action==='buy'&&Date.now()-a.timestamp<7*24*60*60*1000);
    let warning='';
    if(botActivity.length>0) warning=`\n  👾 Scalpers have been buying here recently!`;
    console.log(`\n  ❌ Not enough stock. ${store.name} has ${inv} ${PACKS[product].name}${qty>1?'s':''} available.${warning}\n`);
    return;
  }

  if(cfg.wallet<totalCost){
    console.log(`\n  ❌ Need ${fm$(totalCost)}, have ${fm$(cfg.wallet)}.\n`);return;
  }

  if(activeSale){
    const saleNames=activeSales.map(s=>s.name).join(' + ');
    console.log(`\n  🏷️  Active sale: ${saleNames} — total discount ${saleDiscount>0?Math.round(saleDiscount*100):0}%`);
  }

  // Check purchase limit
  const recentPurchases=(state.purchaseHistory||[]).filter(p=>
    p.storeId===storeId&&p.product===product&&Date.now()-p.timestamp<7*24*60*60*1000).reduce((s,p)=>s+p.qty,0);
  if(recentPurchases+qty>store.purchaseLimit){
    console.log(`\n  ❌ Purchase limit: ${store.purchaseLimit} per week. You've bought ${recentPurchases} recently.\n`);return;
  }

  // Buy into owned sealed inventory instead of opening immediately.
  const beforeWallet=cfg.wallet;
  cfg.wallet-=totalCost;saveCfg(cfg);
  state.stores[store.id].inventory[setKey][product]-=qty;
  rel.totalSpent+=totalCost;
  rel.purchaseCount+=qty;
  state.purchaseHistory=state.purchaseHistory||[];
  state.purchaseHistory.push({storeId, product, qty, cost:totalCost, timestamp:Date.now()});
  saveStoreState(state);

  const col=loadCol();
  if(col){
    col.wallet=cfg.wallet;
    addSealedProduct(col, product, qty, {source:'store-buy', storeId, storeName:store.name, spent:totalCost});
    col.stats.spent+=totalCost;
    saveCol(col);
  }
  logHistory('store-buy',`${qty}× ${PACKS[product].name} from ${store.name} (held sealed)`,beforeWallet,cfg.wallet,{setCode:set.code,product,qty,source:'inventory'});

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🛒 ${store.emoji||'🏪'} Bought ${qty}× ${PACKS[product].name} from ${store.name}`);
  console.log(`  ${set.name} (${set.code}) │ Cost: ${fm$(totalCost)}`);
  console.log(`  Held sealed: ${qty}× ${PACKS[product].name}`);
  if(col){
    const invValue=getSealedInventoryValue(col);
    console.log(`  Sealed inventory value: ${fm$(invValue)}`);
    console.log(`  Open later with open-pack/open-box; owned stock is used first.`);
  }
  console.log(`  💰 Wallet: ${fm$(cfg.wallet)}`);
  const newTier=getRelationshipTier(store, rel);
  const oldTier=getRelationshipTier(store, {totalSpent:rel.totalSpent-totalCost,purchaseCount:rel.purchaseCount-qty});
  if(newTier>oldTier) console.log(`  🎉 Relationship upgraded to Tier ${newTier} — ${store.relationshipBenefits[newTier]}`);
  console.log(`${'═'.repeat(56)}\n`);
}

// ─── STORE SUPPLIES DATA ───────────────────────────────────────────
const SUPPLIES=[
  {id:'sleeves-pack', name:'Card Sleeves (100ct)', basePrice:8, category:'supplies'},
  {id:'toploaders', name:'Top Loaders (25ct)', basePrice:12, category:'supplies'},
  {id:'card-box', name:'Card Storage Box', basePrice:5, category:'supplies'},
  {id:'magnetic-case', name:'Magnetic One-Touch (10ct)', basePrice:25, category:'supplies'},
  {id:'grading-holder', name:'Grading Card Holder', basePrice:3, category:'supplies'},
  {id:'team-bag', name:'Team Bag (500ct)', basePrice:20, category:'supplies'},
]

// ─── STORE SALE EVENTS ─────────────────────────────────────────────

const SALE_TYPES=[
  {id:'flash', name:'⚡ Flash Sale', desc:'Limited time flash sale — everything discounted!', discount:0.15, durationHrs:2},
  {id:'clearance', name:'🏷️ Clearance Event', desc:'Store is clearing old inventory — deep discounts!', discount:0.25, durationHrs:12},
  {id:'b2g1', name:'🎁 Buy 2 Get 1 Free', desc:'Buy any 2 products, get 1 free (lowest value).', discount:0, durationHrs:24, type:'b2g1'},
  {id:'loyalty', name:'🌟 Loyalty Bonus Day', desc:'Extra loyalty discount for regular customers!', discount:0.08, durationHrs:48},
  {id:'restock', name:'📦 Fresh Restock Sale', desc:'New stock just arrived — celebratory pricing!', discount:0.10, durationHrs:6},
]

function loadStoreSales(){
  return rJ(path.join(STORES_DIR,'sales.json'))||{active:[], history:[]}
}
function saveStoreSales(s){wJ(path.join(STORES_DIR,'sales.json'),s)}

function generateStoreSales(setKey){
  const sales=loadStoreSales()
  const now=Date.now()
  // Expire old sales
  sales.active=sales.active.filter(s=>now-s.startedAt<s.durationHrs*60*60*1000)
  // 15% chance to spawn a new sale
  if(Math.random()<0.15&&sales.active.length<2){
    const template=SALE_TYPES[Math.floor(Math.random()*SALE_TYPES.length)]
    const sale={...template, setKey, startedAt:now, announced:false}
    sales.active.push(sale)
    // Announce in market events
    const cfg=loadCfg()
    if(cfg.activeSet){
      const market=loadMarket(cfg.activeSet)
      if(market){
        market.eventLog=market.eventLog||[]
        market.eventLog.push({tick:market.tick, type:'store_sale', desc:`${sale.name} at all stores — ${sale.desc}`})
        saveMarket(market.setKey,market)
      }
    }
  }
  saveStoreSales(sales)
  return sales
}

function getStoreSaleDiscount(storeId){
  const sales=loadStoreSales()
  const now=Date.now()
  let totalDiscount=0
  let activeSale=null
  const activeSales=[]
  for(const s of sales.active){
    if(now-s.startedAt<s.durationHrs*60*60*1000){
      totalDiscount+=s.discount
      activeSales.push(s)
      if(!activeSale) activeSale=s
    }
  }
  return {discount:totalDiscount, sale:activeSale, sales:activeSales}
}

// ─── ENHANCED STORE INVENTORY ─────────────────────────────────────

function ensureFullInventory(state, store, setKey){
  ensureStoreInventory(state, store, setKey)
  const inv=state.stores[store.id].inventory
  if(!inv[setKey]) inv[setKey]={}
  const si=inv[setKey]
  // Add supplies if not present
  if(!si.supplies){
    const rng=mulberry32(Date.now()+store.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0)+999)
    si.supplies={}
    const supplyCount=store.type==='lcs'?6:store.type==='bigbox'?4:3
    for(let i=0;i<supplyCount;i++){
      const sup=SUPPLIES[Math.floor(Math.random()*SUPPLIES.length)]
      si.supplies[sup.id]={...sup, qty:ri(rng,2,8)}
    }
  }
  // Add single cards if not present (LCS and hobby stores only)
  if(!si.singles&&(store.type==='lcs'||store.type==='online')){
    const cfg=loadCfg()
    const set=loadSet()
    const market=set?loadMarket(setKey):null
    if(set){
      const rng=mulberry32(Date.now()+store.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0)+777)
      si.singles=[]
      const count=ri(rng,3,12)
      const cards=[...set.cards].sort(()=>Math.random()-0.5).slice(0,count)
      for(const c of cards){
        const mc=market?.cards?.[c.num]
        const price=mc?mc.currentPrice*(1+(store.markupBase||0.15)):c.basePrice*1.3
        si.singles.push({num:c.num, name:c.name, starTier:c.starTier, price:Math.round(price*100)/100, qty:ri(rng,1,3)})
      }
    }
  }
  // Add sealed boxes
  if(!si.sealed){
    si.sealed={
      hobby_box:{name:'Hobby Box', price:PACKS.hobby.price*2, qty:ri(null,1,3)},
      jumbo_box:{name:'Jumbo Box', price:PACKS.jumbo.price*2, qty:ri(null,1,3)},
    }
    if(store.type!=='bigbox'&&store.sellsHobby!==false){
      si.sealed.hobby_case={name:'Hobby Case (12 boxes)', price:PACKS.hobby.price*2*10, qty:ri(null,0,1)}
    }
  }
}

function cmdStoreStock(){
  const storeId=args[2]
  if(!storeId){console.log(`\n  Usage: card-engine store stock <store-id>\n`);return}
  const defaults=loadDefaultStores()
  const store=defaults.find(s=>s.id===storeId)
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  const cfg=loadCfg()
  if(!cfg.activeSet){console.log(`\n  ❌ No active set.\n`);return}
  const setKey=cfg.activeSet
  const state=loadStoreState()
  ensureFullInventory(state, store, setKey)
  restockIfNeeded(state, store, setKey)
  saveStoreState(state)
  const inv=state.stores[store.id].inventory[setKey]
  const {discount:saleDisc, sale:activeSale, sales:activeSales}=getStoreSaleDiscount(storeId)

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  ${store.emoji||'🏪'} ${store.name.toUpperCase()} — INVENTORY`)
  console.log(`  Set: ${setKey}`)
  if(activeSale){
    const remaining=Math.max(0, activeSale.durationHrs-Math.floor((Date.now()-activeSale.startedAt)/(60*60*1000)))
    console.log(`  🏷️  ${activeSale.name} — ${activeSale.discount>0?`-${Math.round(activeSale.discount*100)}%`:activeSale.type==='b2g1'?'Buy 2 Get 1 Free':''} (${remaining}h left)`)
  }
  console.log(`${'═'.repeat(56)}`)
  const restockProfile=getStoreInventoryProfile(store, setKey)
  console.log(`  Restock profile: ${store.type==='bigbox'?'Big box wholesale':store.type==='online'?'Online warehouse':'Local shop ordering'} | Scalper pressure: ${restockProfile.scalperPressure.toFixed(2)} | Hot set: ${restockProfile.hot?'yes':'no'}`)
  console.log(`  Flopps allocation: ${restockProfile.allocationMultiplier.toFixed(2)}x | Lag risk: ${Math.round(restockProfile.distributorLagRisk*100)}% | Phase: ${restockProfile.releasePhase}`)
  if(activeSale){
    const remaining=Math.max(0, activeSale.durationHrs-Math.floor((Date.now()-activeSale.startedAt)/(60*60*1000)))
    const saleNames=activeSales.map(s=>s.name).join(' + ')
    console.log(`  🏷️  ${saleNames} — ${saleDisc>0?`Total -${Math.round(saleDisc*100)}%!`:activeSale.type==='b2g1'?'Buy 2 Get 1 Free!':''} (${remaining}h left)`)
  }

  // Sealed product
  console.log(`\n  📦 SEALED PRODUCT:`)
  const allowedTypes=Object.entries(PACKS).filter(([t])=>
    !(store.sellsHobby===false&&t==='hobby')&&!(store.type==='online'&&t==='retail'))
  for(const[type, pt] of allowedTypes){
    const stock=inv?.[type]||0
    const warn=stock<=2?' ⚠️ LOW':''
    console.log(`  ${stock>0?'✅':'❌'} ${pR(pt.name,25)} Stock: ${String(stock).padStart(3)}${warn}`)
  }

  // Sealed boxes
  if(inv?.sealed){
    console.log(`\n  📦 SEALED BOXES:`)
    for(const[key, box] of Object.entries(inv.sealed)){
      const warn=box.qty<=1?' ⚠️ LOW':''
      console.log(`  ${box.qty>0?'✅':'❌'} ${pR(box.name,25)} ${fm$(box.price).padStart(7)}  Stock: ${String(box.qty).padStart(3)}${warn}`)
    }
  }

  // Single cards
  if(inv?.singles?.length){
    console.log(`\n  🃏 SINGLE CARDS (${inv.singles.length} listings):`)
    for(const s of inv.singles){
      const te=TIER_EMOJI[s.starTier]||''
      const warn=s.qty<=1?' ⚠️ LAST COPY':''
      console.log(`  ${te} #${s.num} ${pR(s.name,25)} ${fm$(s.price).padStart(7)}  ×${s.qty}${warn}`)
    }
  }

  // Supplies
  if(inv?.supplies){
    console.log(`\n  🛡️  SUPPLIES:`)
    for(const[id, sup] of Object.entries(inv.supplies)){
      const warn=sup.qty<=2?' ⚠️ LOW':''
      const salePrice=saleDisc>0?` → ${fm$(Math.round(sup.basePrice*(1-saleDisc)*100)/100)}`:''
      console.log(`  ${sup.qty>0?'✅':'❌'} ${pR(sup.name,30)} ${fm$(sup.basePrice).padStart(7)}  ×${String(sup.qty).padStart(2)}${warn}${salePrice}`)
    }
  }

  console.log(`\n  📊 Last restock: ${new Date(state.stores[store.id].lastRestock).toISOString().split('T')[0]}`)
  console.log(`  Next restock in: ~${Math.max(0, Math.ceil(store.restockDays-(Date.now()-state.stores[store.id].lastRestock)/(1000*60*60*24)))} days`)
  console.log(`${'═'.repeat(56)}\n`)
}

function cmdStorePressure(){
  const storeId=args[2]
  if(!storeId){console.log(`\n  Usage: card-engine store pressure <store-id>\n`);return}
  const defaults=loadDefaultStores()
  const store=defaults.find(s=>s.id===storeId)
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  const cfg=loadCfg()
  if(!cfg.activeSet){console.log(`\n  ❌ No active set.\n`);return}
  const setKey=cfg.activeSet
  const state=loadStoreState()
  ensureFullInventory(state, store, setKey)
  const profile=getStoreInventoryProfile(store, setKey)
  const inv=state.stores[store.id].inventory[setKey]
  const saleInfo=getStoreSaleDiscount(storeId)
  const stockTotal=Object.entries(PACKS)
    .filter(([t])=>!(store.sellsHobby===false&&t==='hobby')&&!(store.type==='online'&&t==='retail'))
    .reduce((sum,[type])=>sum+(inv?.[type]||0),0)
  const maxStock=Object.entries(PACKS)
    .filter(([t])=>!(store.sellsHobby===false&&t==='hobby')&&!(store.type==='online'&&t==='retail'))
    .reduce((sum)=>sum+12,0)
  const pressure=Math.min(1, profile.scalperPressure/1.5)
  const restockAgeDays=(Date.now()-state.stores[store.id].lastRestock)/(1000*60*60*24)
  const nextRestock=Math.max(0, Math.ceil(store.restockDays-restockAgeDays))
  const fillPct=maxStock>0?Math.round((stockTotal/maxStock)*100):0

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  ⚙️ STORE PRESSURE — ${store.name}`)
  console.log(`  Set: ${setKey}`)
  console.log(`${'═'.repeat(56)}`)
  console.log(`  Type: ${store.type}`)
  console.log(`  Hot set: ${profile.hot?'yes':'no'}`)
  console.log(`  Scalper pressure: ${profile.scalperPressure.toFixed(2)} (${Math.round(pressure*100)}% of max)`)
  console.log(`  Flopps allocation: ${profile.allocationMultiplier.toFixed(2)}x`)
  console.log(`  Distributor lag risk: ${Math.round(profile.distributorLagRisk*100)}%`)
  console.log(`  Release phase: ${profile.releasePhase}`)
  console.log(`  Stock fill: ${fillPct}%`)
  console.log(`  Restock cadence: every ${store.restockDays} days`)
  console.log(`  Days since restock: ${restockAgeDays.toFixed(1)}`)
  console.log(`  Next restock in: ~${nextRestock} days`)
  console.log(`  Current market sentiment: ${(loadMarket(setKey)?.sentiment||1).toFixed(2)}`)
  if(saleInfo.sales.length){
    console.log(`  Active sales: ${saleInfo.sales.map(s=>s.name).join(' + ')}`)
    console.log(`  Sale discount: ${Math.round(saleInfo.discount*100)}%`)
  }
  console.log(`  Inventory bias: ${profile.typeBase.toFixed(2)} base × hot/scalper/sentiment modifiers`)
  console.log(`${'═'.repeat(56)}\n`)
}

function cmdStoreRestock(){
  const storeId=args[2]
  if(!storeId){console.log(`\n  Usage: card-engine store restock <store-id>\n`);return}
  const defaults=loadDefaultStores()
  const store=defaults.find(s=>s.id===storeId)
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  const cfg=loadCfg()
  if(!cfg.activeSet){console.log(`\n  ❌ No active set.\n`);return}
  const setKey=cfg.activeSet
  const state=loadStoreState()
  ensureFullInventory(state, store, setKey)
  const before=JSON.parse(JSON.stringify(state.stores[store.id].inventory[setKey]||{}))
  restockIfNeeded(state, store, setKey)
  saveStoreState(state)
  const after=state.stores[store.id].inventory[setKey]||{}
  const changes=[]
  for(const[type] of Object.entries(PACKS)){
    if(!(store.sellsHobby===false&&type==='hobby')&&!(store.type==='online'&&type==='retail')){
      const delta=(after[type]||0)-(before[type]||0)
      if(delta!==0) changes.push(`${PACKS[type].name}: +${delta}`)
    }
  }
  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  📦 RESTOCK CHECK — ${store.name}`)
  console.log(`  Set: ${setKey}`)
  console.log(`${'═'.repeat(56)}`)
  if(changes.length){
    console.log(`  Restocked: ${changes.join(' │ ')}`)
  } else {
    console.log(`  No restock triggered yet.`)
  }
  console.log(`  Last restock: ${new Date(state.stores[store.id].lastRestock).toISOString().split('T')[0]}`)
  console.log(`  Next restock in: ~${Math.max(0, Math.ceil(store.restockDays-(Date.now()-state.stores[store.id].lastRestock)/(1000*60*60*24)))} days`)
  console.log(`${'═'.repeat(56)}\n`)
}

// ─── STORE TRADING ─────────────────────────────────────────────────

function cmdStoreTrade(){
  const storeId=args[2]
  const cardNum=args[3]
  const productArg=args[4]
  if(!storeId||!cardNum||!productArg){
    console.log(`\n  Usage: card-engine store trade <store-id> <your-card-num> <product-id>\n`)
    console.log(`  Products: hobby, blaster, retail, jumbo, hobby_box, jumbo_box`)
    console.log(`  Supplies: sleeves-pack, toploaders, card-box, magnetic-case, grading-holder, team-bag\n`)
    return
  }
  const defaults=loadDefaultStores()
  const store=defaults.find(s=>s.id===storeId)
  if(!store){console.log(`\n  ❌ Store "${storeId}" not found.\n`);return}
  const cfg=loadCfg()
  if(!cfg.activeSet){console.log(`\n  ❌ No active set.\n`);return}
  const set=loadSet()
  const col=loadCol()
  if(!col||!col.cards.length){console.log(`\n  ❌ Collection is empty.\n`);return}
  const state=loadStoreState()

  // Resolve product
  let productPrice=0
  let productName=productArg
  // Check pack types
  if(PACKS[productArg]){
    productPrice=PACKS[productArg].price
  } else {
    // Check sealed boxes
    ensureFullInventory(state, store, cfg.activeSet)
    const sealed=state.stores[store.id].inventory[cfg.activeSet]?.sealed
    if(sealed&&sealed[productArg]){
      productPrice=sealed[productArg].price
      productName=sealed[productArg].name
    } else {
      // Check supplies
      const sup=SUPPLIES.find(s=>s.id===productArg)
      if(sup){
        productPrice=sup.basePrice
        productName=sup.name
      } else {
        console.log(`\n  ❌ Unknown product: ${productArg}\n`);return
      }
    }
    saveStoreState(state)
  }

  // Find card to trade
  const card=col.cards.find(c=>c.cardNum===cardNum)
  if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}

  const cardValue=card.marketPrice||card.price
  // Store margin: higher tier store = better trade value
  const storeMargin={lcs:0.85, bigbox:0.70, online:0.75}
  const margin=storeMargin[store.type]||0.75
  // Relationship bonus
  const rel=state.relationships[store.id]||{totalSpent:0}
  const tier=getRelationshipTier(store, rel)
  const relBonus=[0,0.02,0.04,0.06,0.08,0.10][tier]||0
  const tradeValue=cardValue*(margin+relBonus)

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  🔄 STORE TRADE — ${store.name}`)
  console.log(`${'═'.repeat(56)}`)
  console.log(`  You offer:  #${cardNum} ${card.name} (${card.parallel})`)
  console.log(`  Card value: ${fm$(cardValue)} | Store values at: ${fm$(tradeValue)} (${(margin*100+relBonus*100).toFixed(0)}%${relBonus>0?' (loyalty bonus)':''})`)
  console.log(`  You want:   ${productName} (${fm$(productPrice)})`)

  if(tradeValue<productPrice*0.5){
    console.log(`\n  ❌ Card value way too low. Store needs at least ${fm$(productPrice*0.5)} in trade value.\n`)
    return
  }

  const deficit=productPrice-tradeValue
  const evenTrade=deficit<=0.01

  if(evenTrade){
    // Even trade
    const idx=col.cards.indexOf(card)
    col.cards.splice(idx,1)
    col.stats.total--
    col.stats.value-=(card.marketPrice||card.price)
    const pc=col.pulls[cardNum]||0
    if(pc<=1) delete col.pulls[cardNum]
    else col.pulls[cardNum]=pc-1
    rebuildPulls(col)
    // If it's a pack product, open it
    if(PACKS[productArg]){
      const np=PACKS[productArg].packs
      let tv=0,th=0
      console.log(`\n  ✅ Trade accepted! Opening ${PACKS[productArg].name}...\n`)
      console.log(`  ── ${PACKS[productArg].name} ─────────────────────────`)
      for(let p=0;p<np;p++){
        if(col){col.stats.packs++}
        const{pack,hc}=pullCards(set,col,productArg)
        th+=hc
        const pv=pack.reduce((s,c)=>s+c.price,0)
        tv+=pv
        pack.forEach((c,i)=>{
          console.log(fmtCard(c,i+1,set,0))
          console.log('')
        })
      }
      console.log(`  Value pulled: ${fm$(tv)} │ Hits: ${th}`)
    } else {
      console.log(`\n  ✅ Trade accepted! You received: ${productName}`)
    }
    if(set)updateChecklist(set,col)
    saveCol(col)
    logHistory('store-trade',`#${cardNum} for ${productName}`,cfg.wallet,cfg.wallet)
  } else {
    console.log(`\n  💰 Card covers ${fm$(tradeValue)} of ${fm$(productPrice)} — you'd need to pay the difference: ${fm$(deficit)}`)
    console.log(`  (Differential payment not yet supported — find a higher-value card to trade)\n`)
  }
  console.log(`${'═'.repeat(56)}\n`)
}

// ─── ENHANCED SCALPER SYSTEM ───────────────────────────────────────

function simulateScalpersEnhanced(setKey){
  const scalperState=loadScalperState()
  const storeState=loadStoreState()
  const defaults=loadDefaultStores()
  const defaultsScalpers=loadDefaultScalpers()
  const flopps=loadFloppsState()
  const corp=flopps.corporation||floppsDefaultCorporation()
  const now=Date.now()
  const msSince=now-scalperState.lastSimulation
  const daysSince=msSince/(1000*60*60*24)
  if(daysSince<1) return

  const storeMap=Object.fromEntries(defaults.map(s=>[s.id,s]))
  const scalperMap=Object.fromEntries(defaultsScalpers.map(s=>[s.id,s]))
  const hot=isSetHot(setKey)
  const demandFactor=getDemandFactor(setKey)
  const market=loadMarket(setKey)
  const log=scalperState.activityLog||[]
  const marketCards=market?getMarketCardList(market):[]
  const hotCards=marketCards
    .filter(c=>c.starTier==='Superstar'||c.starTier==='Legendary')
    .sort((a,b)=>b.currentPrice-a.currentPrice)
    .slice(0,5)
  const recentListingsByCard={}
  for(const e of log){
    if(e.action!=='list'||Date.now()-e.timestamp>3*24*60*60*1000) continue
    (recentListingsByCard[e.cardNum]||(recentListingsByCard[e.cardNum]=[])).push(e)
  }

  // Determine market direction for scalper reactions
  let marketDirection='neutral'
  if(market){
    const recentEvents=market.events||[]
    const hasBullish=recentEvents.some(e=>isBullishMarketEvent(e.type))
    const hasBearish=recentEvents.some(e=>isBearishMarketEvent(e.type))
    if(hasBullish && !hasBearish) marketDirection='bullish'
    else if(hasBearish && !hasBullish) marketDirection='bearish'
    else if(hasBullish && hasBearish) marketDirection=market.sentiment>=1?'bullish':'bearish'
    else if(market.sentiment>1.1) marketDirection='bullish'
    else if(market.sentiment<0.9) marketDirection='bearish'
  }

  for(const[sid, scalper] of Object.entries(scalperState.scalpers)){
    const def=scalperMap[sid]
    if(!def) continue

    const cyclesPerDay=def.activityPattern==='daily'?1:(def.activityPattern==='weekly'?(1/7):1/14)
    const cycles=Math.floor(daysSince*cyclesPerDay)
    if(cycles<=0) continue

    // Strategy: flip_quick = buy & list fast; hold = accumulate & wait
    const strategy=def.strategy||'flip_quick'

    for(let c=0;c<cycles;c++){
      // ── MARKET REACTION ──
      // Buy on dips (crash/bearish)
      const preferred=def.targetStorePreference.filter(id=>storeMap[id])
      if(!preferred.length) continue
      const targetId=preferred[Math.floor(Math.random()*preferred.length)]
      const targetStore=storeMap[targetId]
      const recentStorePressure=getRecentScalperBuyQty(targetId, 7)
      const pressureBoost=Math.min(0.5, recentStorePressure/24)
      let buyChance=def.aggressiveness*(hot?1.5:0.7)*demandFactor*(1+pressureBoost)
      buyChance*=1+(corp.hypeIndex*0.18)+(corp.scarcityIndex*0.14)
      if(marketDirection==='bearish'&&strategy==='hold') buyChance*=2.0 // bargain hunt
      if(marketDirection==='bearish'&&strategy==='flip_quick') buyChance*=0.3 // avoid dropping market
      if(marketDirection==='bullish') buyChance*=1.3 // fomo

      if(Math.random()>buyChance) continue

      ensureFullInventory(storeState, targetStore, setKey)
      const inv=storeState.stores[targetId]?.inventory?.[setKey]
      if(!inv) continue

      const allowedTypes=Object.entries(PACKS).filter(([t])=>
        !(targetStore.sellsHobby===false&&t==='hobby')&&!(targetStore.type==='online'&&t==='retail'))
      const[type, pt]=allowedTypes[Math.floor(Math.random()*allowedTypes.length)]
      const stock=inv[type]||0

      let buyQty=1
      if(def.aggressiveness>0.7) buyQty=Math.min(3, Math.floor(Math.random()*4)+1)
      if(def.aggressiveness>0.9) buyQty=Math.min(5, buyQty+2)
      if(def.tier==='bot') buyQty=Math.min(stock, buyQty+2)
      if(hot) buyQty=Math.min(stock, buyQty+1)
      if(marketDirection==='bullish') buyQty=Math.min(stock, buyQty+1)
      buyQty=Math.min(buyQty, stock)
      if(buyQty<=0||stock<=0) continue

      const price=pt.price*(1+(targetStore.markupBase||0.1))
      const totalCost=price*buyQty
      if(scalper.cash<totalCost) continue

      scalper.cash-=totalCost
      inv[type]-=buyQty
      scalper.lastAction=now

      log.push({
        timestamp:now, scalperId:sid, scalperName:def.name, emoji:def.emoji,
        storeId:targetId, storeName:targetStore.name, action:'buy',
        product:pt.name, productType:type, qty:buyQty, cost:totalCost,
        marketDirection, strategy
      })

      // ── LIST & UNDERCUT ──
      if(market&&Math.random()<0.6){
        if(hotCards.length>0){
          const card=hotCards[Math.floor(Math.random()*hotCards.length)]
          // Check for undercutting
          const otherListings=(recentListingsByCard[card.num]||[]).filter(e=>e.scalperId!==sid)
          const undercut=otherListings.length>0?0.95:1.0
          const markup=def.markupRange[0]+Math.random()*(def.markupRange[1]-def.markupRange[0])
          const listPrice=Math.round(card.currentPrice*markup*undercut*100)/100

          log.push({
            timestamp:now, scalperId:sid, scalperName:def.name, emoji:def.emoji,
            action:'list', cardNum:card.num, cardName:card.name,
            cardTier:card.starTier, listPrice, markup:markup*undercut,
            undercut:undercut<1, undercuttingWho:undercut<1?otherListings[0]?.scalperName:null
          })

          const existingListings=Array.isArray(scalper.listings)?scalper.listings:[]
          scalper.listings=existingListings.concat([{cardNum:card.num, cardName:card.name, listPrice, markup:markup*undercut, listedAt:now, strategy}])
          const recentForCard=Array.isArray(recentListingsByCard[card.num])?recentListingsByCard[card.num]:[]
          recentListingsByCard[card.num]=recentForCard.concat([{scalperId:sid, action:'list', timestamp:now}])
        }
      }
    }

    // ── STUCK INVENTORY CHECK ──
    // If scalper has listings older than 7 days and market is bearish, force discount
    const oldListings=(scalper.listings||[]).filter(l=>Date.now()-l.listedAt>7*24*60*60*1000)
    if(oldListings.length>0&&marketDirection!=='bullish'&&Math.random()<0.4){
      const stuck=oldListings[Math.floor(Math.random()*oldListings.length)]
      const discount=0.8+Math.random()*0.1
      const oldPrice=stuck.listPrice
      stuck.listPrice=Math.round(stuck.listPrice*discount*100)/100
      log.push({
        timestamp:now, scalperId:sid, scalperName:def.name, emoji:def.emoji,
        action:'discount', cardNum:stuck.cardNum, cardName:stuck.cardName,
        oldPrice, newPrice:stuck.listPrice, reason:marketDirection==='bearish'?'market dip':'stuck inventory'
      })
    }
  }

  scalperState.activityLog=log.slice(-300)
  scalperState.lastSimulation=now
  saveScalperState(scalperState)
  saveStoreState(storeState)
}

function cmdScalperLog(){
  const cfg=loadCfg()
  if(!cfg.activeSet){console.log('No active set.');return}
  const scalperState=loadScalperState()
  const allLog=(scalperState.activityLog||[]).slice(-50)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  👾 SCALPER ACTIVITY LOG (last 50 entries)`)
  console.log(`${'═'.repeat(60)}`)

  if(!allLog.length){
    console.log(`\n  No scalper activity yet. Visit a store to trigger simulation.\n`)
    return
  }

  for(const e of allLog){
    const ago=((Date.now()-e.timestamp)/(1000*60*60*24)).toFixed(1)
    const agoStr=ago<1?`${Math.floor((Date.now()-e.timestamp)/(1000*60*60))}h ago`:`${ago}d ago`
    let line=''
    if(e.action==='buy'){
      const dir=e.marketDirection?` [${e.marketDirection.toUpperCase()}]`:''
      line=`📦 ${e.emoji} ${e.scalperName} bought ${e.qty}× ${e.product} from ${e.storeName} for ${fm$(e.cost)}${dir}`
    } else if(e.action==='list'){
      const undercut=e.undercut?` (undercutting ${e.undercuttingWho})`:''
      line=`📈 ${e.emoji} ${e.scalperName} listed #${e.cardNum} ${e.cardName} — ${fm$(e.listPrice)} (${e.markup.toFixed(1)}×)${undercut}`
    } else if(e.action==='discount'){
      line=`📉 ${e.emoji} ${e.scalperName} discounted #${e.cardNum} ${e.cardName}: ${fm$(e.oldPrice)} → ${fm$(e.newPrice)} (${e.reason})`
    } else {
      line=`❓ ${e.emoji} ${e.scalperName} ${e.action}`
    }
    console.log(`  ${agoStr.padEnd(10)} ${line}`)
  }

  // Summary stats
  const buys=allLog.filter(e=>e.action==='buy')
  const lists=allLog.filter(e=>e.action==='list')
  const discounts=allLog.filter(e=>e.action==='discount')
  const totalSpent=buys.reduce((s,e)=>s+e.cost,0)
  const avgMarkup=lists.length>0?(lists.reduce((s,e)=>s+e.markup,0)/lists.length):0

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  📊 SUMMARY: ${buys.length} buys (${fm$(totalSpent)}), ${lists.length} listings (avg ${avgMarkup.toFixed(1)}× markup), ${discounts.length} forced discounts`)
  console.log(`${'═'.repeat(60)}\n`)
}

function cmdStoreReputation(){
  const defaults=loadDefaultStores();
  const state=loadStoreState();
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🤝 STORE REPUTATION`);
  console.log(`${'═'.repeat(56)}`);
  for(const store of defaults){
    const rel=state.relationships[store.id]||{totalSpent:0,purchaseCount:0,tier:0};
    const tier=getRelationshipTier(store, rel);
    const emoji=store.emoji||'🏪';
    const thresholds=store.relationshipThresholds||[];
    const nextThreshold=tier<thresholds.length?thresholds[tier]:null;
    const progress=nextThreshold?`│ ${fm$(rel.totalSpent)} / ${fm$(nextThreshold)} to next`:'│ MAX';
    const tierBar='★'.repeat(tier)+'☆'.repeat(5-tier);
    console.log(`\n  ${emoji} ${pR(store.name,25)} ${tierBar}  Tier ${tier}/5`);
    console.log(`     ${progress} │ Purchases: ${rel.purchaseCount}`);
    if(tier<5){
      for(let i=0;i<=tier;i++){
        const check=i<=tier?'✅':'⬜';
        console.log(`     ${check} ${store.relationshipBenefits[i]}`);
      }
      if(tier+1<store.relationshipBenefits.length){
        console.log(`     ⬜ ${store.relationshipBenefits[tier+1]} ← next`);
      }
    } else {
      for(const b of store.relationshipBenefits) console.log(`     ✅ ${b}`);
    }
  }
  console.log(`\n${'═'.repeat(56)}\n`);
}

// ─── SCALPER NPC SYSTEM ────────────────────────────────────────────

function simulateScalpers(setKey){
  const scalperState=loadScalperState();
  const storeState=loadStoreState();
  const defaults=loadDefaultStores();
  const now=Date.now();
  const msSince=now-scalperState.lastSimulation;
  const daysSince=msSince/(1000*60*60*24);
  if(daysSince<1) return; // Don't simulate if less than 1 day has passed

  const storeMap=Object.fromEntries(defaults.map(s=>[s.id,s]));
  const hot=isSetHot(setKey);
  const demandFactor=getDemandFactor(setKey);
  const log=scalperState.activityLog||[];

  for(const[sid, scalper] of Object.entries(scalperState.scalpers)){
    const def=loadDefaultScalpers().find(s=>s.id===sid);
    if(!def) continue;
    // How many cycles did this scalper act?
    const cyclesPerDay=def.activityPattern==='daily'?1:(def.activityPattern==='weekly'?(1/7):1/14);
    const cycles=Math.floor(daysSince*cyclesPerDay);
    if(cycles<=0) continue;

    for(let c=0;c<cycles;c++){
      // Decide whether to buy (based on aggressiveness × demand)
      const buyChance=def.aggressiveness*(hot?1.5:0.7)*demandFactor;
      if(Math.random()>buyChance) continue;

      // Pick a store from preferences
      const preferred=def.targetStorePreference.filter(id=>storeMap[id]);
      if(!preferred.length) continue;
      const targetId=preferred[Math.floor(Math.random()*preferred.length)];
      const targetStore=storeMap[targetId];

      // Ensure store has inventory for this set
      ensureStoreInventory(storeState, targetStore, setKey);
      const inv=storeState.stores[targetId]?.inventory?.[setKey];
      if(!inv) continue;

      // Pick a product type to buy
      const allowedTypes=Object.entries(PACKS).filter(([t])=>
        !(targetStore.sellsHobby===false&&t==='hobby')&&!(targetStore.type==='online'&&t==='retail'));
      const[type, pt]=allowedTypes[Math.floor(Math.random()*allowedTypes.length)];
      const stock=inv[type]||0;

      // Buy quantity based on aggressiveness and type
      let buyQty=1;
      if(def.aggressiveness>0.7) buyQty=Math.min(3, Math.floor(Math.random()*4)+1);
      if(def.aggressiveness>0.9) buyQty=Math.min(5, buyQty+2);
      if(def.tier==='bot') buyQty=Math.min(stock, buyQty+2); // bots buy more
      buyQty=Math.min(buyQty, stock);

      if(buyQty<=0||stock<=0) continue;

      const price=pt.price*(1+(targetStore.markupBase||0.1));
      const totalCost=price*buyQty;

      if(scalper.cash<totalCost) continue;

      // Execute buy
      scalper.cash-=totalCost;
      inv[type]-=buyQty;
      scalper.lastAction=now;

      log.push({
        timestamp:now, scalperId:sid, scalperName:def.name, emoji:def.emoji,
        storeId:targetId, storeName:targetStore.name, action:'buy',
        product:pt.name, productType:type, qty:buyQty, cost:totalCost
      });

      // Simulate scalper opening and listing some cards
      const set=loadSet();
      if(set&&Math.random()<0.6){
        // Pick a random high-value card from set to "list"
        const hotCards=set.cards.filter(c=>c.starTier==='Superstar'||c.starTier==='Legendary');
        if(hotCards.length>0){
          const card=hotCards[Math.floor(Math.random()*hotCards.length)];
          const markup=def.markupRange[0]+Math.random()*(def.markupRange[1]-def.markupRange[0]);
          const listPrice=Math.round(card.basePrice*markup*100)/100;
          log.push({
            timestamp:now, scalperId:sid, scalperName:def.name, emoji:def.emoji,
            action:'list', cardNum:card.num, cardName:card.name,
            cardTier:card.starTier, listPrice, markup
          });
          const existingListings=Array.isArray(scalper.listings)?scalper.listings:[];
          scalper.listings=existingListings.concat([{cardNum:card.num, cardName:card.name, listPrice, markup, listedAt:now}]);
        }
      }
    }
  }

  // Keep log manageable (last 200 entries)
  scalperState.activityLog=log.slice(-200);
  scalperState.lastSimulation=now;
  saveScalperState(scalperState);
  saveStoreState(storeState);
}

function cmdMarketScalpers(){
  const sub=args[1];
  if(sub==='scalper') return cmdMarketScalperDetail();
  // Show scalper activity log
  const scalperState=loadScalperState();
  const log=(scalperState.activityLog||[]).filter(e=>Date.now()-e.timestamp<7*24*60*60*1000);
  const buys=[];
  const listings=[];
  const countsByScalper={};
  for(const e of log){
    if(e.action==='buy') buys.push(e);
    else if(e.action==='list') listings.push(e);
    if(e.scalperId){
      const bucket=countsByScalper[e.scalperId]||(countsByScalper[e.scalperId]={buy:0,list:0});
      if(e.action==='buy') bucket.buy++;
      else if(e.action==='list') bucket.list++;
    }
  }

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  👾 SCALPER ACTIVITY (last 7 days)`);
  console.log(`${'═'.repeat(56)}`);

  if(!log.length){
    console.log(`\n  No scalper activity recorded yet.\n`);
  } else {
    console.log(`\n  📦 Buys (${buys.length}):`);
    for(const e of buys.slice(-10)){
      const ago=((Date.now()-e.timestamp)/(1000*60*60*24)).toFixed(1);
      console.log(`  ${e.emoji} ${e.scalperName} bought ${e.qty}× ${e.product} from ${e.storeName} (${ago}d ago)`);
    }
    console.log(`\n  📈 Listings (${listings.length}):`);
    for(const e of listings.slice(-10)){
      const ago=((Date.now()-e.timestamp)/(1000*60*60*24)).toFixed(1);
      const multTag=`(${e.markup.toFixed(1)}× market)`;
      console.log(`  ${e.emoji} ${e.scalperName} listed #${e.cardNum} ${e.cardName} — ${fm$(e.listPrice)} ${multTag} (${ago}d ago)`);
    }
  }

  // Per-scalper summary
  const defaults=loadDefaultScalpers();
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  SCALPER PROFILES:`);
  for(const def of defaults){
    const s=scalperState.scalpers[def.id];
    if(!s) continue;
    const counts=countsByScalper[def.id]||{buy:0,list:0};
    const buyCount=counts.buy;
    const listCount=counts.list;
    console.log(`  ${def.emoji} ${pR(def.name,18)} ${pR(def.tier,12)} Cash: ${fm$(s.cash).padStart(9)} │ Buys: ${buyCount} │ Listings: ${listCount}`);
  }

  console.log(`\n  Use "market scalper <id>" for detailed view`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdMarketScalperDetail(){
  const scalperId=args[2];
  if(!scalperId){console.log(`\n  Usage: card-engine market scalper <flip-fred|scout-sam|card-cartel|bot-brigade>\n`);return}
  const defaults=loadDefaultScalpers();
  const def=defaults.find(s=>s.id===scalperId);
  if(!def){console.log(`\n  ❌ Scalper "${scalperId}" not found.\n`);return}
  const scalperState=loadScalperState();
  const s=scalperState.scalpers[scalperId];
  if(!s){console.log(`\n  ❌ Scalper state not found.\n`);return}

  const allLog=scalperState.activityLog||[];
  const recentLog=allLog.filter(e=>e.scalperId===scalperId&&Date.now()-e.timestamp<7*24*60*60*1000);
  const recentBuys=recentLog.filter(e=>e.action==='buy');
  const recentListings=recentLog.filter(e=>e.action==='list');

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ${def.emoji} ${def.name.toUpperCase()} — ${def.tier.toUpperCase()} SCALPER`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  ${def.description}`);
  console.log(`  Aggressiveness: ${(def.aggressiveness*100).toFixed(0)}%`);
  console.log(`  Markup range: ${def.markupRange[0].toFixed(1)}× - ${def.markupRange[1].toFixed(1)}×`);
  console.log(`  Cash: ${fm$(s.cash)}`);
  console.log(`  Targets: ${def.targetStorePreference.join(', ')}`);
  console.log(`  Activity: ${def.activityPattern}`);

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  RECENT ACTIVITY (7 days):`);
  if(recentBuys.length){
    for(const e of recentBuys){
      console.log(`  📦 Bought ${e.qty}× ${e.product} from ${e.storeName} (${fm$(e.cost)})`);
    }
  } else console.log(`  No buys.`);

  if(recentListings.length){
    console.log(`\n  ACTIVE LISTINGS:`);
    for(const e of recentListings){
      console.log(`  📈 #${e.cardNum} ${e.cardName} [${e.cardTier}] — ${fm$(e.listPrice)} (${e.markup.toFixed(1)}×)`);
    }
  }

  // Outstanding listings
  const outstandingListings=(s.listings||[]).slice(-10);
  if(outstandingListings.length){
    console.log(`\n  📋 INVENTORY SNAPSHOT (last 10 listed):`);
    for(const l of outstandingListings){
      console.log(`  #${l.cardNum} ${l.cardName} — ${fm$(l.listPrice)}`);
    }
  }

  console.log(`\n  💡 Tip: Compete with ${def.name} by visiting their target stores early after restocks.`);
  console.log(`${'═'.repeat(56)}\n`);
}

// ─── GRADING ECONOMY COMMANDS ─────────────────────────────────────

function cmdGrade(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||!col.cards.length){console.log('Collection is empty.');return}
  const set=loadSet();
  const a=process.argv.slice(2);
  const sub=a[1];
  if(!sub||sub==='help'){
    console.log(`\n  Usage: card-engine grade <command> [options]
  Commands:
    submit <card-num> [company] [tier]  — Submit card for grading (default: PSA standard)
    submit bulk <card-nums...> [company] [tier]
    status                               — Show cards currently being graded
    history                              — Past grading results
    pop <card-num>                       — Population report
    cost <card-num>                      — ROI estimate
    crack <card-num>                     — Remove card from slab (risky)
    stats                                — Your grading statistics

  Companies: PSA, BGS, SGC
  Tiers: economy, standard, express\n`);return;
  }

  switch(sub){
    case 'submit': cmdGradeSubmit(); break;
    case 'status': cmdGradeStatus(); break;
    case 'history': cmdGradeHistory(); break;
    case 'pop': cmdGradePop(); break;
    case 'cost': cmdGradeCost(); break;
    case 'crack': cmdGradeCrack(); break;
    case 'stats': cmdGradeStats(); break;
    case 'pop-report': cmdGradePopReport(); break;
    case 'value-add': cmdGradeValueAdd(); break;
    case 'crack-risk': cmdGradeCrackRisk(); break;
    default: console.log(`  Unknown grade command: ${sub}. Use "card-engine grade help".`);
  }
}

function cmdGradeSubmit(){
  const cfg=loadCfg();const col=loadCol();const set=loadSet();
  const a=process.argv.slice(3); // after "grade submit"
  if(!a.length){console.log('  Usage: card-engine grade submit <card-num> [company] [tier]');return;}
  const isBulk=a[0]==='bulk';
  const cardNums=isBulk?a.slice(1).filter(x=>/^\d+$/.test(x)):[a[0].match(/^\d+$/)?a[0]:null];
  if(!cardNums||!cardNums.length){console.log('  Provide valid card number(s).');return;}
  // Parse company and tier from remaining non-numeric args
  const nonNum=a.filter(x=>!/^\d+$/.test(x)&&x!=='bulk');
  const companies=loadCompanies();
  let company=nonNum.find(x=>companies[x.toUpperCase()])||'PSA';
  company=company.toUpperCase();
  const comp=companies[company];
  if(!comp){console.log(`  Unknown company: ${company}. Available: ${Object.keys(companies).join(', ')}`);return;}
  let tier=nonNum.find(x=>comp.tiers[x])||'standard';
  const tierInfo=comp.tiers[tier];
  if(!tierInfo){console.log(`  Unknown tier: ${tier}. Available: ${Object.keys(comp.tiers).join(', ')}`);return;}

  const state=loadGradingState();
  const activeSubmissions=new Set(state.submissions.filter(s=>!s.completed).map(s=>s.cardNum));
  const perCardCost=tierInfo.cost;
  const totalCost=perCardCost*cardNums.length;
  if(cfg.wallet<totalCost){console.log(`  ❌ Need ${fm$(totalCost)}, have ${fm$(cfg.wallet)}.`);return;}

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📤 GRADING SUBMISSION${isBulk?' (BULK)':''}`);
  console.log(`${'═'.repeat(56)}`);

  for(const num of cardNums){
    const cardIdx=col.cards.findIndex(c=>c.cardNum===num);
    if(cardIdx===-1){console.log(`  ❌ Card #${num} not in collection.`);continue;}
    const card=col.cards[cardIdx];
    if(activeSubmissions.has(num)){console.log(`  ❌ Card #${num} already being graded.`);continue;}
    if(card.gradingResult&&!card.gradingResult.cracked){console.log(`  ❌ Card #${num} already graded (${gradeLabel(card.gradingResult.grade,card.gradingResult.company,card.gradingResult.condition)}). Crack it first to resubmit.`);continue;}
    const cond=ensureCondition(card);
    const estAvg=(cond.centering/10+cond.corners+cond.edges+cond.surface)/4;
    const estLow=Math.max(7,Math.floor(estAvg*2)/2-0.5);
    const estHigh=Math.min(10,Math.ceil(estAvg*2)/2+0.5);
    const bars=Math.round((estAvg/10)*8);
    const condBar='█'.repeat(bars)+'░'.repeat(8-bars);
    const psa10prob=Math.round(estimateGradeProbability(cond,company,10)*100);
    const psa9prob=Math.round(estimateGradeProbability(cond,company,9)*100);
    const mult9=gradeMultiplier(9,company,cond);
    const mult10=gradeMultiplier(10,company,cond);
    const rawValue=card.price||10;

    console.log(`\n  Card: #${num} ${card.name} (${card.starTier})`);
    console.log(`  Company: ${comp.name} — ${tierInfo.label}`);
    console.log(`  Condition (hidden): ${condBar} est ${estLow}-${estHigh}`);
    console.log(`  Cost: ${fm$(perCardCost)}`);
    console.log(`  Current raw value: ${fm$(rawValue)}`);
    console.log(`    If ${company} 9: ~${fm$(rawValue*mult9*0.85)}-${fm$(rawValue*mult9*1.15)} (${mult9.toFixed(1)}×)`);
    console.log(`    If ${company} 10: ~${fm$(rawValue*mult10*0.85)}-${fm$(rawValue*mult10*1.15)} (${mult10.toFixed(1)}×)`);
    console.log(`    ${company} 10 probability: ~${psa10prob}%`);
    const ev=rawValue*(psa9prob/100*mult9+(psa10prob/100*mult10)+(1-psa9prob/100-psa10prob/100)*0.9);
    console.log(`    Expected value: ~${fm$(ev)}`);

    state.submissions.push({
      cardNum:num,cardIdx,name:card.name,starTier:card.starTier,
      company,tier,cost:perCardCost,submittedAt:Date.now(),
      daysToComplete:tierInfo.days,condition:{...cond},rawValue,
      completed:false,result:null
    });
    activeSubmissions.add(num);
    // Mark card as in-grading in collection
    card.gradingResult={status:'submitted',company,tier,submittedAt:Date.now()};
  }

  const actualCost=state.submissions.filter(s=>!s._charged).length*perCardCost;
  state.submissions.filter(s=>!s._charged).forEach(s=>s._charged=true);
  const beforeWallet=cfg.wallet;
  cfg.wallet-=actualCost;saveCfg(cfg);
  col.wallet=cfg.wallet;saveCol(col);
  saveGradingState(state);
  logHistory('grade-submit',`${cardNums.length} cards to ${company} ${tier} (${fm$(actualCost)})`,beforeWallet,cfg.wallet);

  console.log(`\n  Wallet: ${fm$(beforeWallet)} → ${fm$(cfg.wallet)}`);
  console.log(`  Submit? Cards will be unavailable for ~${tierInfo.days} days.`);
  console.log(`${'═'.repeat(56)}\n`);
}

function processCompletedSubmissions(state,col,set){
  let newCompletions=false;
  const cardByNum=Object.fromEntries(col.cards.map((c,i)=>[c.cardNum,{card:c,idx:i}]));
  for(const sub of state.submissions){
    if(sub.completed)continue;
    const elapsed=(Date.now()-sub.submittedAt)/(1000*60*60*24); // days
    if(elapsed>=sub.daysToComplete){
      sub.completed=true;
      sub.completedAt=Date.now();
      const grade=conditionToGrade(sub.condition,sub.company);
      const cond=sub.condition;
      const blackLabel=sub.company==='BGS'&&grade===10&&isBlackLabel(cond);
      const mult=gradeMultiplier(grade,sub.company,cond);
      const newPrice=Math.round(sub.rawValue*mult*100)/100;
      sub.result={grade,blackLabel,mult,newPrice};
      // Update card in collection
      const entry=cardByNum[sub.cardNum];
      if(entry){
        const card=entry.card;
        card.gradingResult={
          company:sub.company,tier:sub.tier,grade,blackLabel,
          condition:{...cond},gradedAt:Date.now(),
          originalPrice:sub.rawValue,newPrice,mult,cracked:false
        };
        card.price=newPrice;
      }
      // Update population
      bumpPopulation(col.setKey,sub.cardNum,sub.company,grade);
      state.history.push({
        cardNum:sub.cardNum,name:sub.name,company:sub.company,tier:sub.tier,
        grade,blackLabel,rawValue:sub.rawValue,newPrice,mult,
        submittedAt:sub.submittedAt,completedAt:Date.now()
      });
      newCompletions=true;
    }
  }
  if(newCompletions){rebuildPulls(col);saveCol(col);}
  return newCompletions;
}

function cmdGradeStatus(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const state=loadGradingState();
  processCompletedSubmissions(state,col,set);
  saveGradingState(state);
  const active=state.submissions.filter(s=>!s.completed);
  if(!active.length){
    // Check for just completed
    const recent=state.history.slice(-3).reverse();
    if(recent.length&&Date.now()-recent[0].completedAt<5000){
      console.log(`\n${'═'.repeat(56)}`);
      console.log(`  ✅ GRADING COMPLETE — Just returned!\n`);
      for(const h of recent){
        const label=gradeLabel(h.grade,h.company,h.condition||{centering:90,corners:9,edges:9,surface:9});
        console.log(`  🏷️  #${h.cardNum} ${h.name} — ${label}`);
        console.log(`     ${fm$(h.rawValue)} → ${fm$(h.newPrice)} (${h.mult.toFixed(1)}×)\n`);
      }
      console.log(`${'═'.repeat(56)}\n`);
    } else {
      console.log(`\n  ℹ️  No cards currently being graded.\n`);
    }
    return;
  }
  const companies=loadCompanies();
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📊 GRADING STATUS`);
  console.log(`${'═'.repeat(56)}`);
  for(const sub of active){
    const elapsed=(Date.now()-sub.submittedAt)/(1000*60*60*24);
    const remaining=Math.max(0,Math.ceil(sub.daysToComplete-elapsed));
    const pct=clamp(elapsed/sub.daysToComplete,0,1);
    const bar='█'.repeat(Math.round(pct*15))+'░'.repeat(15-Math.round(pct*15));
    const comp=companies[sub.company];
    const tierLabel=comp?comp.tiers[sub.tier]?.label||sub.tier:sub.tier;
    console.log(`\n  📦 #${sub.cardNum} ${sub.name} — ${comp?.name||sub.company} ${sub.tier}`);
    console.log(`     Progress: ${bar} ${remaining}/${sub.daysToComplete} days remaining`);
    console.log(`     Submitted: ${new Date(sub.submittedAt).toISOString().split('T')[0]}`);
  }
  console.log(`\n${'═'.repeat(56)}\n`);
}

function cmdGradeHistory(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const state=loadGradingState();
  processCompletedSubmissions(state,col,set);saveGradingState(state);
  if(!state.history.length){console.log(`\n  ℹ️  No grading history yet.\n`);return;}
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📜 GRADING HISTORY (${state.history.length} cards graded)`);
  console.log(`${'═'.repeat(56)}`);
  const recent=state.history.slice(-20).reverse();
  for(const h of recent){
    const label=gradeLabel(h.grade,h.company,{centering:90,corners:9,edges:9,surface:9});
    const diff=h.newPrice-h.rawValue;
    console.log(`  ${label.padEnd(24)} #${h.cardNum} ${h.name.padEnd(20)} ${fm$(h.rawValue)} → ${fm$(h.newPrice)} (${diff>=0?'+':''}${diff.toFixed(2)})`);
  }
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdGradePop(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const a=process.argv.slice(3);
  const num=a.find(x=>/^\d+$/.test(x));
  if(!num){console.log('  Usage: card-engine grade pop <card-num>');return;}
  const card=col.cards.find(c=>c.cardNum===num);
  if(!card){console.log(`  ❌ Card #${num} not in collection.`);return;}
  const pop=loadPopulation();
  simNpcPopulationGrowth(col.setKey,num);
  const popReload=loadPopulation();
  const cardPop=popReload[col.setKey]?.[num];
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📋 POPULATION REPORT — #${num} ${card.name}`);
  console.log(`${'═'.repeat(56)}`);
  if(!cardPop||cardPop.totalGraded===0){
    console.log(`\n  No cards graded yet for this card.\n`);
    return;
  }
  const grades=[10,'9.5',9,'8.5',8,7];
  const companies=['PSA','BGS','SGC'];
  console.log(`\n${' '.repeat(12)}${companies.map(c=>c.padEnd(7)).join('')}`);
  for(const g of grades){
    const row=[String(g).padEnd(12)];
    for(const c of companies){
      row.push(String(cardPop[c]?.[g]||0).padEnd(7));
    }
    console.log(row.join(''));
  }
  const totals=companies.map(c=>Object.values(cardPop[c]||{}).reduce((s,v)=>s+v,0));
  console.log(`  ${'─'.repeat(32)}`);
  console.log(`  Total: ${totals.join(' + ')} = ${cardPop.totalGraded}`);
  // Find highest grade with entries
  let highestCompany='PSA',highestGrade=0,highestCount=0;
  for(const c of companies){
    for(const g of [10,'9.5',9,'8.5',8,7]){
      const cnt=cardPop[c]?.[g]||0;
      if(cnt>0&&Number(g)>highestGrade){highestGrade=Number(g);highestCount=cnt;highestCompany=c;}
    }
  }
  console.log(`  Highest: ${highestCompany} ${highestGrade} (${highestCount} examples)`);
  // Scarcity premium for PSA 10
  const psa10count=cardPop.PSA?.[10]||0;
  const premium=psa10count===0?'∞':psa10count<=3?'8-10×':psa10count<=10?'4-6×':psa10count<=30?'2-3×':'1.5-2×';
  console.log(`  PSA 10 premium: ${premium} raw price`);
  // Your copies
  const myCopies=col.cards.filter(c=>c.cardNum===num&&c.gradingResult&&!c.gradingResult.cracked);
  if(myCopies.length){
    console.log(`  Your copies: ${myCopies.length} (${myCopies.map(c=>gradeLabel(c.gradingResult.grade,c.gradingResult.company,c.gradingResult.condition)).join(', ')})`);
  }
  console.log(`\n${'═'.repeat(56)}\n`);
}

function cmdGradeCost(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const a=process.argv.slice(3);
  const num=a.find(x=>/^\d+$/.test(x));
  if(!num){console.log('  Usage: card-engine grade cost <card-num>');return;}
  const card=col.cards.find(c=>c.cardNum===num);
  if(!card){console.log(`  ❌ Card #${num} not in collection.`);return;}
  if(card.gradingResult&&!card.gradingResult.cracked){console.log(`  Card already graded (${gradeLabel(card.gradingResult.grade,card.gradingResult.company,card.gradingResult.condition)}). Crack first.`);return;}
  const cond=ensureCondition(card);
  const companies=loadCompanies();
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  💰 ROI ESTIMATE — #${num} ${card.name}`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Raw value: ${fm$(card.price)}`);
  console.log(`  Condition: centering ${cond.centering}, corners ${cond.corners}, edges ${cond.edges}, surface ${cond.surface}\n`);
  for(const[compKey,comp]of Object.entries(companies)){
    for(const[tierKey,tier]of Object.entries(comp.tiers)){
      const mult9=gradeMultiplier(9,compKey,cond);
      const mult10=gradeMultiplier(10,compKey,cond);
      const psa10p=estimateGradeProbability(cond,compKey,10);
      const psa9p=estimateGradeProbability(cond,compKey,9);
      const ev=card.price*(psa9p*mult9+psa10p*mult10+(1-psa9p-psa10p)*0.9);
      const netEV=ev-tier.cost;
      console.log(`  ${comp.name} ${tier.label}:`);
      console.log(`    Cost: ${fm$(tier.cost)} | EV: ${fm$(ev)} | Net: ${netEV>=0?'+':''}${fm$(netEV)}`);
      console.log(`    10 chance: ${(psa10p*100).toFixed(0)}% | 9+ chance: ${((psa9p+psa10p)*100).toFixed(0)}%`);
    }
    console.log();
  }
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdGradeCrack(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const a=process.argv.slice(3);
  const num=a.find(x=>/^\d+$/.test(x));
  if(!num){console.log('  Usage: card-engine grade crack <card-num>');return;}
  const card=col.cards.find(c=>c.cardNum===num&&c.gradingResult&&!c.gradingResult.cracked);
  if(!card){console.log(`  ❌ No graded slab found for #${num}.`);return;}
  const gr=card.gradingResult;
  const label=gradeLabel(gr.grade,gr.company,gr.condition);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  💥 SLAB CRACK — #${num} ${card.name} (${label})`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  ⚠️  Risk: Card condition may degrade during removal`);
  console.log(`  Rolling the dice...\n`);
  const degrade=Math.random()<0.2;
  let newCond;
  if(degrade){
    console.log(`  🎲 Result: Condition degraded!`);
    newCond={
      centering:clamp(gr.condition.centering-Math.round(Math.random()*8),50,100),
      corners:Math.round(clamp(gr.condition.corners-Math.random()*1.5,1,10)*10)/10,
      edges:Math.round(clamp(gr.condition.edges-Math.random()*1.0,1,10)*10)/10,
      surface:Math.round(clamp(gr.condition.surface-Math.random()*2.0,1,10)*10)/10,
    };
  } else {
    console.log(`  🎲 Result: Condition preserved!`);
    newCond={...gr.condition};
    // Tiny random variance even on success
    newCond.corners=Math.round(clamp(newCond.corners+(Math.random()-0.5)*0.3,1,10)*10)/10;
    newCond.edges=Math.round(clamp(newCond.edges+(Math.random()-0.5)*0.3,1,10)*10)/10;
    newCond.surface=Math.round(clamp(newCond.surface+(Math.random()-0.5)*0.3,1,10)*10)/10;
  }
  card.condition=newCond;
  card.gradingResult={status:'cracked',company:gr.company,grade:gr.grade,cracked:true,crackedAt:Date.now()};
  card.price=gr.originalPrice||card.price*0.9; // Revert to roughly original
  col.wallet=cfg.wallet;saveCol(col);
  logHistory('grade-crack',`#${num} ${card.name} — ${label} ${degrade?'DEGRADED':'preserved'}`,cfg.wallet,cfg.wallet);
  console.log(`  New condition: centering ${newCond.centering}, corners ${newCond.corners}, edges ${newCond.edges}, surface ${newCond.surface}`);
  console.log(`  Card returned to collection (ungraded)`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdGradeStats(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet();
  const state=loadGradingState();
  processCompletedSubmissions(state,col,set);saveGradingState(state);
  if(!state.history.length){console.log(`\n  ℹ️  No grading history yet. Submit some cards first!\n`);return;}
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📈 GRADING STATISTICS`);
  console.log(`${'═'.repeat(56)}`);
  const totalSubmitted=state.history.length;
  const totalSpent=state.history.reduce((s,h)=>s+h.cost||0,0);
  // Grade distribution
  const dist={};
  for(const h of state.history){
    const g=h.grade;if(!dist[g])dist[g]={count:0,totalMult:0};
    dist[g].count++;dist[g].totalMult+=h.mult||1;
  }
  console.log(`\n  Total submitted: ${totalSubmitted}`);
  console.log(`  Total spent: ${fm$(totalSpent)}\n`);
  console.log(`  Grade distribution:`);
  const sortedGrades=Object.keys(dist).map(Number).sort((a,b)=>b-a);
  for(const g of sortedGrades){
    const d=dist[g];const pct=(d.count/totalSubmitted*100).toFixed(1);
    const avgMult=(d.totalMult/d.count).toFixed(1);
    console.log(`    ${String(g).padEnd(5)} ${d.count} cards (${pct.padStart(5)}%) — avg value increase: ${avgMult}×`);
  }
  // ROI
  const totalValue=state.history.reduce((s,h)=>s+(h.newPrice||0),0);
  const totalRaw=state.history.reduce((s,h)=>s+(h.rawValue||0),0);
  const roi=totalValue-totalRaw-totalSpent;
  const roiPct=totalSpent>0?(roi/totalSpent*100).toFixed(1):'N/A';
  console.log(`\n  ROI: ${roi>=0?'+':''}${fm$(roi)} (${roiPct}% return on grading investment)`);
  // Best/worst
  const best=state.history.reduce((b,h)=>(h.mult||0)>(b.mult||0)?h:b,state.history[0]);
  const worst=state.history.reduce((b,h)=>(h.mult||0)<(b.mult||0)?h:b,state.history[0]);
  console.log(`  Best flip: #${best.cardNum} ${best.name} — raw ${fm$(best.rawValue)} → ${gradeLabel(best.grade,best.company,{}).split(' ')[0]} ${best.company} ${best.grade} → ${fm$(best.newPrice)}`);
  console.log(`  Worst: #${worst.cardNum} ${worst.name} — raw ${fm$(worst.rawValue)} → ${worst.company} ${worst.grade} → ${fm$(worst.newPrice)} (${worst.mult<1?'loss':'gain'})`);
  // By company
  const byCompany={};
  for(const h of state.history){byCompany[h.company]=(byCompany[h.company]||0)+1;}
  console.log(`\n  ${Object.entries(byCompany).map(([c,n])=>`${c}: ${n} submitted`).join(', ')}`);
  console.log(`\n${'═'.repeat(56)}\n`);
}

// ─── COLLECTION ACQUISITION & ADVANCED MARKET ─────────────────────

const MARKETPLACE_DIR=path.join(DATA_DIR,'marketplace');
const NPCS_DIR=path.join(DATA_DIR,'npcs');

function loadListings(){return rJ(path.join(MARKETPLACE_DIR,'listings.json'))||{listings:[],sold:[],nextId:1,lastChecked:0}}
function saveListings(d){wJ(path.join(MARKETPLACE_DIR,'listings.json'),d)}
function loadLots(){return rJ(path.join(MARKETPLACE_DIR,'lots.json'))||{lots:[],soldLots:[],nextId:1,lastRefreshed:0}}
function saveLots(d){wJ(path.join(MARKETPLACE_DIR,'lots.json'),d)}
function loadAuctions(){return rJ(path.join(MARKETPLACE_DIR,'auctions.json'))||{auctions:[],completed:[],nextId:1,lastChecked:0}}
function saveAuctions(d){wJ(path.join(MARKETPLACE_DIR,'auctions.json'),d)}
function loadTraders(){return rJ(path.join(NPCS_DIR,'traders.json'))||[]}
function loadTradeHistory(){return rJ(path.join(NPCS_DIR,'trade-history.json'))||[]}
function saveTradeHistory(d){wJ(path.join(NPCS_DIR,'trade-history.json'),d)}

// ── Buy Single ──
function cmdBuySingle(){
  const argv=process.argv.slice(2);
  const wantBest=argv.includes('--best')
  const maxPriceIdx=argv.indexOf('--max-price')
  const maxPrice=maxPriceIdx>=0?parseFloat(argv[maxPriceIdx+1]):Infinity
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();
  if(!set||!col){console.log('No set/collection found.');return}
  const cardNum=argv.find(a=>!a.startsWith('-')&&a!=='buy-single'&&a!=='buy');
  if(!cardNum||cardNum==='--best'||cardNum==='--max-price'){console.log('Usage: buy <card-num> [--best] [--max-price $X]\n  --best       buy highest grade available\n  --max-price  refuse if market price exceeds $X');return}
  const baseCard=set.cards.find(c=>c.num===cardNum);
  if(!baseCard){console.log(`\n  ❌ Card #${cardNum} not in set.\n`);return}
  const market=initMarket(set);
  const mc=market.cards[cardNum];
  if(!mc){console.log(`\n  ❌ Market data for #${cardNum} not found.\n`);return}
  const basePrice=mc.currentPrice;
  if(basePrice>maxPrice){console.log(`\n  ❌ Market price ${fm$(basePrice)} exceeds your max ${fm$(maxPrice)}.\n`);return}
  // Check supply — buying reduces supply and may increase price
  const supplyBefore=mc.supplyInMarket
  const buyerPremium=basePrice*1.05;
  if(cfg.wallet<buyerPremium){console.log(`\n  ❌ Need ${fm$(buyerPremium)}, have ${fm$(cfg.wallet)}\n`);return}
  // Generate the card
  let grade
  if(wantBest){
    // Bias toward higher grades — weighted roll favoring 9-10
    const bestPool=[{grade:10,w:15},{grade:9,w:40},{grade:8,w:30},{grade:7,w:10},{grade:6,w:5}]
    let r=Math.random()*bestPool.reduce((s,g)=>s+g.w,0)
    for(const g of bestPool){r-=g.w;if(r<=0){grade=GRADES.find(x=>x.grade===g.grade);break}}
    if(!grade)grade=GRADES.find(g=>g.grade===9)
  } else {
    grade=rollGrade()
  }
  const quality=generateQuality(grade)
  const par=PARALLELS[0]
  const price=basePrice*par.pm*grade.mult
  const id=`${set.code}-${cardNum}-Base-0-G${grade.grade}`
  const catLine=CAT.fmtCardCategoryLine(baseCard,set.setCategory)
  const newCard={id,cardNum,name:baseCard.name,subset:baseCard.subset,starTier:baseCard.starTier,
    stats:baseCard.stats||{},parallel:'Base',sn:null,serStr:'',plate:null,special:'None',specialDesc:'',
    quality,grade:grade.grade,gradeName:grade.name,price,isHit:false,
    marketPrice:basePrice*par.pm*grade.mult,popScore:0,demandScore:0,
    cardFormat:'standard',cardTypeId:null,cardTypeName:null,
    _categoryLine:catLine,source:'purchased',purchasePrice:buyerPremium,purchaseDate:Date.now()}
  const before=cfg.wallet
  cfg.wallet-=buyerPremium;saveCfg(cfg)
  col.wallet=cfg.wallet
  col.cards.push(newCard);col.pulls[cardNum]=(col.pulls[cardNum]||0)+1
  col.stats.total++;col.stats.value+=price;col.stats.spent+=buyerPremium
  if(!col.bestPull||price>col.bestPull.price)col.bestPull=newCard
  rebuildPulls(col);saveCol(col)
  // Demand pressure: buying reduces supply, may bump price
  mc.supplyInMarket=Math.max(0,supplyBefore-1)
  if(mc.supplyInMarket<=2&&mc.demandScore>0.5){
    const bump=(1-mc.supplyInMarket/3)*0.03*mc.demandScore
    mc.currentPrice=Math.round((mc.currentPrice*(1+bump))*100)/100
  }
  saveMarket(market.setKey,market)
  if(set)updateChecklist(set,col)
  logHistory('buy-single',`#${cardNum} ${baseCard.name} (${fm$(buyerPremium)})`,before,cfg.wallet)
  // Price comparison section
  const storePrice=basePrice*1.15 // store markup ~15%
  const scalperPrice=basePrice*1.35 // scalper markup ~35%
  console.log(`\n${'═'.repeat(52)}`)
  console.log(`  🛒 PURCHASED — ${baseCard.name} (#${cardNum})`)
  console.log(`${'═'.repeat(52)}`)
  console.log(fmtCard(newCard,1,set,0))
  console.log(`\n${'─'.repeat(52)}`)
  console.log(`  💰 PRICE COMPARISON:`)
  const supplyWarn=mc.supplyInMarket<3?' ⚠️ LOW':''
  console.log(`  Market:   ${fm$(basePrice)} (supply: ${mc.supplyInMarket}${supplyWarn})`)
  console.log(`  Your buy: ${fm$(buyerPremium)} (+5% premium)`)
  console.log(`  Store:    ${fm$(storePrice)} (+15% markup)`)
  console.log(`  Scalpers: ${fm$(scalperPrice)} (+35% markup)`)
  console.log(`  ${buyerPremium<=storePrice?'✅ Good deal vs store':'⚠️ Above store price'}`)
  if(supplyBefore!==mc.supplyInMarket){
    console.log(`  📉 Supply dropped ${supplyBefore}→${mc.supplyInMarket} (demand pressure)`)
  }
  console.log(`  Wallet:   ${fm$(cfg.wallet)}`)
  console.log(`${'═'.repeat(52)}\n`)
}

// ── Trade System ──
function cmdTrade(){
  const sub=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='trade');
  if(!sub||sub==='browse') return cmdTradeBrowse();
  if(sub==='offer') return cmdTradeOffer();
  if(sub==='counter') return cmdTradeCounter();
  if(sub==='history') return cmdTradeHistory();
  console.log('Usage: trade [browse|offer|counter|history]');
}

function cmdTradeBrowse(){
  const npcId=process.argv.slice(2).filter(a=>a!=='trade'&&a!=='browse')[1];
  const traders=loadTraders();
  const set=loadSet();if(!set){console.log('No active set.');return}
  const market=initMarket(set);
  const col=loadCol();
  if(npcId){
    const trader=traders.find(t=>t.id===npcId);
    if(!trader){console.log(`\n  ❌ Trader "${npcId}" not found.\n`);return}
    showTraderInventory(trader,set,market,col);
  } else {
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  🤝 NPC TRADERS`);
    console.log(`${'═'.repeat(52)}`);
    for(const t of traders){
      const styleIcon=t.tradeStyle==='generous'?'💚':t.tradeStyle==='stingy'?'🦈':'⚖️';
      const tierVal={Common:'$0.10-0.30',Uncommon:'$0.30-0.75',Star:'$0.75-1.50',Superstar:'$1.50-3.00',Legendary:'$3.00-5.00'};
      const wantsStr=t.wants.map(w=>`  ${tierVal[w]||w}`).join('\n');
      const havesStr=t.haves.map(h=>`  ${tierVal[h]||h}`).join('\n');
      console.log(`\n  ${styleIcon} ${t.name} (${t.id})`);
      console.log(`  ${t.personality}`);
      console.log(`  Wants: ${t.wants.join(', ')}\n${wantsStr}`);
      console.log(`  Haves: ${t.haves.join(', ')}\n${havesStr}`);
    }
    console.log(`\n  Use "trade browse <npc-id>" for their specific inventory`);
    console.log(`  Use "trade offer <npc> <your-card-num> for <their-card-num>" to propose`);
    console.log(`${'═'.repeat(52)}\n`);
  }
}

function showTraderInventory(trader,set,market,col){
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🤝 ${trader.name}'s Trade Inventory`);
  console.log(`  Style: ${trader.tradeStyle} | Wants: ${trader.wants.join(', ')}`);
  console.log(`${'═'.repeat(52)}`);
  const availCards=set.cards.filter(c=>trader.haves.includes(c.starTier));
  if(!availCards.length){console.log('  (no cards available for trade)\n');return}
  const shuffled=[...availCards].sort(()=>Math.random()-0.5).slice(0,10);
  for(const c of shuffled){
    const mc=market.cards[c.num];
    const price=mc?mc.currentPrice:c.basePrice;
    const te=TIER_EMOJI[c.starTier]||'';
    const inWants=trader.wants.includes(c.starTier);
    const demand=inWants?'🔴 HIGH':' ';
    console.log(`  ${demand}${te} #${c.num} ${pR(c.name,25)} ${fm$(price)}`);
  }
  console.log(`\n  🔴 = in trader's wishlist (they'll want more for these)`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeOffer(){
  const parts=process.argv.slice(2);
  const forIdx=parts.indexOf('for');
  if(forIdx<0){console.log('Usage: trade offer <npc-id> <your-card-num> for <their-card-num>');return}
  const npcId=parts[parts.indexOf('offer')+1];
  const offerNum=parts[forIdx-1];
  const requestNum=parts[forIdx+1];
  if(!npcId||!offerNum||!requestNum){console.log('Usage: trade offer <npc-id> <your-card-num> for <their-card-num>');return}
  const traders=loadTraders();
  const trader=traders.find(t=>t.id===npcId);
  if(!trader){console.log(`\n  ❌ Trader "${npcId}" not found.\n`);return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No set/collection.');return}
  const offerCard=col.cards.find(c=>c.cardNum===offerNum);
  if(!offerCard){console.log(`\n  ❌ You don't have card #${offerNum}.\n`);return}
  // Check card isn't listed/locked
  const listings=loadListings();
  const listedCardIds=new Set(listings.listings.map(l=>l.cardId));
  if(listedCardIds.has(offerCard.id)){
    console.log(`\n  ❌ This card is listed on the marketplace. Cancel the listing first.\n`);return}
  const requestBase=set.cards.find(c=>c.num===requestNum);
  if(!requestBase){console.log(`\n  ❌ Card #${requestNum} not in set.\n`);return}
  if(!trader.haves.includes(requestBase.starTier)){console.log(`\n  ❌ ${trader.name} doesn't have ${requestBase.starTier} cards to trade.\n`);return}
  const offerVal=offerCard.marketPrice||offerCard.price;
  const reqMc=market.cards[requestNum];
  const reqVal=reqMc?reqMc.currentPrice:requestBase.basePrice;
  const ratio=reqVal>0?offerVal/reqVal:0;
  const fairness=ratio; // >1 = player offering more (good for NPC), <1 = player asking more

  const thresholds={fair:0.20,generous:0.40,stingy:0.10};
  const thresh=thresholds[trader.tradeStyle]||0.20;

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🤝 TRADE PROPOSAL — ${trader.name}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  You offer:  #${offerNum} ${offerCard.name} (${offerCard.parallel}) — ${fm$(offerVal)}`);
  console.log(`  You want:   #${requestNum} ${requestBase.name} (${requestBase.starTier}) — ${fm$(reqVal)}`);
  console.log(`  Ratio: ${ratio.toFixed(2)} (1.00 = even trade)`);

  let accepted=false;
  let counterCard=null;
  let reason='';

  if(fairness>=1.05+thresh){
    // Clearly in NPC's favor
    accepted=true;
    reason='Great deal for the trader!';
  } else if(fairness>=1.0-thresh&&fairness<=1.05+thresh){
    // Roughly fair
    const acceptChance=trader.tradeStyle==='generous'?0.8:trader.tradeStyle==='stingy'?0.4:0.6;
    accepted=Math.random()<acceptChance;
    reason=accepted?'Fair trade accepted!':'Trader wants slightly better value.';
  } else if(fairness>=0.7){
    // Slightly unfair to NPC
    const acceptChance=trader.tradeStyle==='generous'?0.4:trader.tradeStyle==='stingy'?0.05:0.2;
    accepted=Math.random()<acceptChance;
    reason=accepted?'Trader was feeling generous!':'Trade undervalues their card.';
  } else {
    // Very unfair to NPC — always reject
    reason='Way too low! Trader is insulted.';
  }

  if(!accepted&&!counterCard){
    // Generate counter-offer: NPC wants a card closer to their card's value
    const neededVal=reqVal*(1.0-thresh);
    const ownedCards=[...col.cards].filter(c=>c.cardNum!==offerNum&&
      !listedCardIds.has(c.id));
    const sorted=ownedCards.sort((a,b)=>(b.marketPrice||b.price)-(a.marketPrice||a.price));
    const counter=sorted.find(c=>(c.marketPrice||c.price)>=neededVal&&c.cardNum!==offerNum);
    if(counter) counterCard=counter;
  }

  if(accepted){
    // Execute trade
    const idx=col.cards.indexOf(offerCard);
    col.cards.splice(idx,1);
    col.stats.total--;
    col.stats.value-=(offerCard.marketPrice||offerCard.price);
    const cardCount=(col.pulls[offerNum]||0);
    if(cardCount<=1) delete col.pulls[offerNum]; else col.pulls[offerNum]=cardCount-1;

    // Add received card
    const par=PARALLELS[0];
    const grade=rollGrade();
    const quality=generateQuality(grade);
    const newPrice=reqVal*par.pm*grade.mult;
    const id=`${set.code}-${requestNum}-Base-0-G${grade.grade}`;
    const catLine=CAT.fmtCardCategoryLine(requestBase,set.setCategory);
    const newCard={id,cardNum:requestNum,name:requestBase.name,subset:requestBase.subset,
      starTier:requestBase.starTier,stats:requestBase.stats||{},parallel:'Base',sn:null,
      serStr:'',plate:null,special:'None',specialDesc:'',quality,grade:grade.grade,
      gradeName:grade.name,price:newPrice,isHit:false,marketPrice:newPrice,
      popScore:0,demandScore:0,cardFormat:'standard',cardTypeId:null,cardTypeName:null,
      _categoryLine:catLine,source:'traded',tradeWith:trader.id};
    col.cards.push(newCard);
    col.pulls[requestNum]=(col.pulls[requestNum]||0)+1;
    col.stats.total++;col.stats.value+=newPrice;
    if(!col.bestPull||newPrice>col.bestPull.price)col.bestPull=newCard;
    rebuildPulls(col);saveCol(col);

    const history=loadTradeHistory();
    history.push({date:new Date().toISOString(),type:'trade',npc:trader.id,gave:`#${offerNum} ${offerCard.name}`,received:`#${requestNum} ${requestBase.name}`,offerVal,requestVal,status:'accepted'});
    saveTradeHistory(history);

    console.log(`\n  ✅ ${reason}`);
    console.log(`  Trade completed!`);
    console.log(`${'─'.repeat(52)}`);
    console.log(`  Received: #${requestNum} ${requestBase.name} — ${fm$(newPrice)}`);
    console.log(`  Collection: ${col.cards.length} cards (${Object.keys(col.pulls).length} unique)`);
  } else {
    console.log(`\n  ❌ ${reason}`);
    if(counterCard){
      const cv=counterCard.marketPrice||counterCard.price;
      const history=loadTradeHistory();
      const tradeId=`trade-${Date.now()}`;
      history.push({date:new Date().toISOString(),type:'trade',id:tradeId,npc:trader.id,
        gave:`#${offerNum} ${offerCard.name}`,received:`#${requestNum} ${requestBase.name}`,
        offerVal,requestVal,status:'rejected',counterOffer:`#${counterCard.cardNum} ${counterCard.name} (${fm$(cv)})`});
      saveTradeHistory(history);
      console.log(`\n  💡 Counter-offer: ${trader.name} wants #${counterCard.cardNum} ${counterCard.name} (${fm$(cv)})`);
      console.log(`  Use "trade counter ${tradeId} #${counterCard.cardNum}" to accept`);
    }
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeCounter(){
  const parts=process.argv.slice(2);
  const tradeId=parts[parts.indexOf('counter')+1];
  const counterNum=parts[parts.indexOf('counter')+2];
  if(!tradeId||!counterNum){console.log('Usage: trade counter <trade-id> <your-card-num>');return}
  const history=loadTradeHistory();
  const trade=history.find(t=>t.id===tradeId&&t.status==='rejected'&&t.counterOffer);
  if(!trade){console.log('\n  ❌ No matching counter-offer found.\n');return}
  const cfg=loadCfg();const col=loadCol();const set=loadSet();
  if(!col||!set){console.log('No collection/set.');return}
  const counterCard=col.cards.find(c=>c.cardNum===counterNum);
  if(!counterCard){console.log(`\n  ❌ You don't have card #${counterNum}.\n`);return}
  // Execute the counter-trade
  // First remove original offer card
  const origCard=col.cards.find(c=>c.cardNum===trade.give.match(/#(\d+)/)?.[1]);
  if(origCard){
    const idx=col.cards.indexOf(origCard);
    if(idx>=0){col.cards.splice(idx,1);col.stats.total--;col.stats.value-=(origCard.marketPrice||origCard.price);}
  }
  // Remove counter card
  const ci=col.cards.indexOf(counterCard);
  col.cards.splice(ci,1);col.stats.total--;col.stats.value-=(counterCard.marketPrice||counterCard.price);
  // Add requested card
  const reqNum=trade.received.match(/#(\d+)/)?.[1];
  const reqBase=set.cards.find(c=>c.num===reqNum);
  if(reqBase){
    const market=initMarket(set);
    const mc=market.cards[reqNum];
    const reqVal=mc?mc.currentPrice:reqBase.basePrice;
    const par=PARALLELS[0];const grade=rollGrade();const quality=generateQuality(grade);
    const newPrice=reqVal*par.pm*grade.mult;
    const id=`${set.code}-${reqNum}-Base-0-G${grade.grade}`;
    const catLine=CAT.fmtCardCategoryLine(reqBase,set.setCategory);
    const newCard={id,cardNum:reqNum,name:reqBase.name,subset:reqBase.subset,
      starTier:reqBase.starTier,stats:reqBase.stats||{},parallel:'Base',sn:null,
      serStr:'',plate:null,special:'None',specialDesc:'',quality,grade:grade.grade,
      gradeName:grade.name,price:newPrice,isHit:false,marketPrice:newPrice,
      popScore:0,demandScore:0,cardFormat:'standard',cardTypeId:null,cardTypeName:null,
      _categoryLine:catLine,source:'traded',tradeWith:trade.npc};
    col.cards.push(newCard);col.pulls[reqNum]=(col.pulls[reqNum]||0)+1;
    col.stats.total++;col.stats.value+=newPrice;
  }
  trade.status='counter-accepted';
  saveTradeHistory(history);
  rebuildPulls(col);saveCol(col);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  ✅ COUNTER-TRADE ACCEPTED`);
  console.log(`  You gave: #${counterNum} ${counterCard.name} + #${origCard?origCard.cardNum:'?'} ${origCard?origCard.name:'?'}`);
  console.log(`  You got:  ${trade.received}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeHistory(){
  const history=loadTradeHistory();
  if(!history.length){console.log('\n  📜 No trades yet.\n');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📜 TRADE HISTORY (${history.length})`);
  console.log(`${'═'.repeat(52)}`);
  for(const t of history.slice(-20).reverse()){
    const ts=t.date.split('T')[0];
    const status=t.status==='accepted'?'✅':t.status==='rejected'?'❌':'🔄';
    console.log(`  ${ts} ${status} ${t.gave} → ${t.received} (${t.npc})`);
    if(t.counterOffer) console.log(`         Counter: ${t.counterOffer}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

// ── Collection Lots ──
function refreshLots(set,market){
  const lots=loadLots();
  const now=Date.now();
  const hrsSinceRefresh=(now-(lots.lastRefreshed||0))/(1000*60*60);
  if(hrsSinceRefresh<6&&lots.lots.length>0) return lots;
  // Generate new lots
  const traders=loadTraders();
  const sellers=traders.slice(0,3);
  const newLots=[];
  const count=3+Math.floor(Math.random()*3);
  for(let i=0;i<count;i++){
    const seller=sellers[i%sellers.length];
    const cardCount=5+Math.floor(Math.random()*10);
    const contents=[];
    const usedNums=new Set();
    let estValue=0;
    // Pick random cards from the set
    const allCards=[...set.cards].sort(()=>Math.random()-0.5).slice(0,cardCount);
    // 15% chance of a hidden gem (high tier card)
    let hasGem=false;
    if(Math.random()<0.15){
      const gems=set.cards.filter(c=>c.starTier==='Legendary'||c.starTier==='Superstar');
      if(gems.length){
        const gem=gems[Math.floor(Math.random()*gems.length)];
        contents.push({num:gem.num,name:gem.name,starTier:gem.starTier});
        usedNums.add(gem.num);
        estValue+=market.cards[gem.num]?market.cards[gem.num].currentPrice:gem.basePrice;
        hasGem=true;
      }
    }
    for(const c of allCards){
      if(!usedNums.has(c.num)){
        contents.push({num:c.num,name:c.name,starTier:c.starTier});
        usedNums.add(c.num);
        estValue+=market.cards[c.num]?market.cards[c.num].currentPrice:c.basePrice;
      }
    }
    const discount=0.3+Math.random()*0.2; // 30-50% off
    const price=Math.round(estValue*(1-discount)*100)/100;
    newLots.push({
      id:String(lots.nextId+i),seller:seller.name,sellerId:seller.id,
      cardCount:contents.length,price,estimatedValue:Math.round(estValue*100)/100,
      discount:Math.round(discount*100),
      description:`${contents.length} cards from ${seller.name}'s collection${hasGem?' (rumored gem inside!)':''}`,
      hasGem,contents,createdAt:now
    });
  }
  lots.lots=newLots;lots.lastRefreshed=now;lots.nextId+=count;
  saveLots(lots);
  return lots;
}

function cmdLot(){
  const sub=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='lot');
  if(sub==='buy') return cmdLotBuy();
  if(sub==='history') return cmdLotHistory();
  return cmdLotBrowse();
}

function cmdLotBrowse(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const market=initMarket(set);
  if(!set){console.log('No set.');return}
  const lots=refreshLots(set,market);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🎁 COLLECTION LOTS`);
  console.log(`${'═'.repeat(52)}`);
  if(!lots.lots.length){console.log('  No lots available right now. Check back later!\n');return}
  for(const lot of lots.lots){
    const gemTag=lot.hasGem?' 💎possible gem':'';
    console.log(`  📦 Lot #${lot.id} — ${lot.description}`);
    console.log(`     ${lot.cardCount} cards | Est. value: ${fm$(lot.estimatedValue)} | Price: ${fm$(lot.price)} (-${lot.discount}%)${gemTag}`);
    console.log(`     Seller: ${lot.seller}`);
    console.log('');
  }
  console.log(`  Use "lot buy <lot-id>" to purchase`);
  console.log(`  Contents are revealed AFTER purchase!`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdLotBuy(){
  const lotId=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='lot'&&a!=='buy');
  if(!lotId){console.log('Usage: lot buy <lot-id>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No set/collection.');return}
  const lots=refreshLots(set,market);
  const lot=lots.lots.find(l=>l.id===lotId);
  if(!lot){console.log(`\n  ❌ Lot #${lotId} not found.\n`);return}
  if(cfg.wallet<lot.price){console.log(`\n  ❌ Need ${fm$(lot.price)}, have ${fm$(cfg.wallet)}\n`);return}
  const before=cfg.wallet;
  cfg.wallet-=lot.price;saveCfg(cfg);col.wallet=cfg.wallet;
  let totalValue=0;
  for(const item of lot.contents){
    const baseCard=set.cards.find(c=>c.num===item.num);
    if(!baseCard) continue;
    const mc=market.cards[item.num];
    const price=mc?mc.currentPrice:baseCard.basePrice;
    const par=PARALLELS[0];const grade=rollGrade();const quality=generateQuality(grade);
    const cardPrice=price*par.pm*grade.mult;
    const id=`${set.code}-${item.num}-Base-0-G${grade.grade}`;
    const catLine=CAT.fmtCardCategoryLine(baseCard,set.setCategory);
    const newCard={id,cardNum:item.num,name:baseCard.name,subset:baseCard.subset,
      starTier:baseCard.starTier,stats:baseCard.stats||{},parallel:'Base',sn:null,
      serStr:'',plate:null,special:'None',specialDesc:'',quality,grade:grade.grade,
      gradeName:grade.name,price:cardPrice,isHit:false,marketPrice:cardPrice,
      popScore:0,demandScore:0,cardFormat:'standard',cardTypeId:null,cardTypeName:null,
      _categoryLine:catLine,source:'lot',lotId:lot.id,lotSeller:lot.seller};
    col.cards.push(newCard);
    col.pulls[item.num]=(col.pulls[item.num]||0)+1;
    col.stats.total++;col.stats.value+=cardPrice;
    if(!col.bestPull||cardPrice>col.bestPull.price)col.bestPull=newCard;
    totalValue+=cardPrice;
  }
  rebuildPulls(col);saveCol(col);
  lot.sold=true;lot.soldAt=Date.now();
  lots.soldLots.push({...lot});
  lots.lots=lots.lots.filter(l=>l.id!==lotId);
  saveLots(lots);
  logHistory('lot-buy',`Lot #${lotId} ${lot.cardCount} cards (${fm$(lot.price)})`,before,cfg.wallet);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🎁 LOT #${lotId} PURCHASED!`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Seller: ${lot.seller} | Cards: ${lot.contents.length} | Paid: ${fm$(lot.price)}`);
  console.log(`  Actual value: ${fm$(totalValue)} (${totalValue>=lot.price?'📈':'📉'} ${fm$(totalValue-lot.price)})`);
  console.log(`${'─'.repeat(52)}`);
  console.log(`  Contents:`);
  for(const item of lot.contents){
    const te=TIER_EMOJI[item.starTier]||'';
    console.log(`  ${te} #${item.num} ${item.name} [${item.starTier}]`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdLotHistory(){
  const lots=loadLots();
  if(!lots.soldLots.length){console.log('\n  📜 No lot purchases yet.\n');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📜 LOT PURCHASE HISTORY`);
  console.log(`${'═'.repeat(52)}`);
  for(const lot of lots.soldLots.slice(-10).reverse()){
    const ts=lot.soldAt?new Date(lot.soldAt).toISOString().split('T')[0]:'?';
    console.log(`  ${ts} Lot #${lot.id} — ${lot.cardCount} cards from ${lot.seller} — ${fm$(lot.price)}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

// ── Consignment (Sell singles) ──
function tickListings(col,set,market){
  const listings=loadListings();
  const now=Date.now();
  const hrsSinceCheck=(now-(listings.lastChecked||0))/(1000*60*60);
  if(hrsSinceCheck<1||!listings.listings.length){listings.lastChecked=now;saveListings(listings);return}
  // Simulate ~1hr passing per check, check if any sold
  const toRemove=[];
  for(const listing of listings.listings){
    const mc=market.cards[listing.cardNum];
    if(!mc) continue;
    const marketPrice=mc.currentPrice;
    const priceRatio=listing.price/marketPrice;
    // Below market = higher sell chance. Above = lower.
    let sellChance=0;
    if(priceRatio<=0.8) sellChance=0.15;
    else if(priceRatio<=1.0) sellChance=0.08;
    else if(priceRatio<=1.2) sellChance=0.04;
    else sellChance=0.01;
    if(Math.random()<sellChance){
      const fee=listing.price*0.10;
      const net=listing.price-fee;
      const cfg=loadCfg();
      cfg.wallet+=net;saveCfg(cfg);col.wallet=cfg.wallet;
      // Remove card from collection
      const cardIdx=col.cards.findIndex(c=>c.id===listing.cardId);
      if(cardIdx>=0){
        const card=col.cards[cardIdx];
        col.cards.splice(cardIdx,1);
        col.stats.total--;
        col.stats.value-=(card.marketPrice||card.price);
        const pc=(col.pulls[listing.cardNum]||0);
        if(pc<=1) delete col.pulls[listing.cardNum]; else col.pulls[listing.cardNum]=pc-1;
      }
      listing.soldAt=now;listing.soldPrice=listing.price;listing.fee=fee;listing.net=net;
      listings.sold.push(listing);
      toRemove.push(listing);
      market.cards[listing.cardNum].supplyInMarket++;
      market.cards[listing.cardNum].salesHistory.push({tick:market.tick,price:listing.price,parallel:'Base'});
      logHistory('consignment-sold',`#${listing.cardNum} (${fm$(net)} after fee)`,cfg.wallet-net,cfg.wallet);
    }
  }
  if(toRemove.length>0){
    listings.listings=listings.listings.filter(l=>!toRemove.includes(l));
    rebuildPulls(col);
  }
  listings.lastChecked=now;saveListings(listings);
}

function cmdSellList(){
  const sub=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='sell-list');
  if(!sub){return cmdSellListings()} // default to showing listings
  if(sub==='instant') return cmdSellListInstant();
  if(sub==='listings') return cmdSellListings();
  if(sub==='cancel') return cmdSellListCancel();
  // sell-list <card-num> <price>
  const parts=process.argv.slice(2);
  const priceIdx=parts.indexOf(sub)+1;
  const price=parseFloat(parts[priceIdx]);
  const cardNum=sub;
  if(isNaN(price)||price<=0){console.log('Usage: sell-list <card-num> <price>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No set/collection.');return}
  // Tick listings first
  tickListings(col,set,market);
  const card=col.cards.find(c=>c.cardNum===cardNum);
  if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}
  // Check not already listed
  const listings=loadListings();
  if(listings.listings.some(l=>l.cardId===card.id)){console.log(`\n  ❌ This copy is already listed.\n`);return}
  const mc=market.cards[cardNum];
  const marketPrice=mc?mc.currentPrice:card.basePrice;
  const listingId=String(listings.nextId++);
  listings.listings.push({
    id:listingId,cardId:card.id,cardNum,name:card.name,parallel:card.parallel,
    starTier:card.starTier,price,listedAt:Date.now(),marketPrice
  });
  saveListings(listings);saveCol(col);
  const diff=price-marketPrice;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📋 LISTED FOR SALE`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  ${card.name} (#${cardNum}) ${card.parallel}`);
  console.log(`  Market: ${fm$(marketPrice)} | Your price: ${fm$(price)} (${diff>=0?'+':''}${fm$(diff)})`);
  console.log(`  Fee: 10% (${fm$(price*0.10)}) | You get: ${fm$(price*0.90)}`);
  console.log(`  Listing #${listingId} — card is locked until sold or cancelled`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdSellListInstant(){
  const cardNum=process.argv.slice(2).find(a=>a!=='sell-list'&&a!=='instant');
  if(!cardNum){console.log('Usage: sell-list instant <card-num>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No set/collection.');return}
  tickListings(col,set,market);
  const card=col.cards.find(c=>c.cardNum===cardNum);
  if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}
  const mc=market.cards[cardNum];
  const marketPrice=mc?mc.currentPrice:card.basePrice;
  const fee=marketPrice*0.10;
  const net=marketPrice-fee;
  const before=cfg.wallet;
  const idx=col.cards.indexOf(card);
  col.cards.splice(idx,1);col.stats.total--;col.stats.value-=(card.marketPrice||card.price);
  const pc=(col.pulls[cardNum]||0);
  if(pc<=1) delete col.pulls[cardNum]; else col.pulls[cardNum]=pc-1;
  cfg.wallet+=net;saveCfg(cfg);col.wallet=cfg.wallet;
  rebuildPulls(col);saveCol(col);
  if(mc){mc.supplyInMarket++;mc.salesHistory.push({tick:market.tick,price:marketPrice,parallel:'Base'});}
  logHistory('instant-sell',`#${cardNum} ${card.name} (${fm$(net)})`,before,cfg.wallet);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  💸 INSTANT SELL — ${card.name} (#${cardNum})`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Market: ${fm$(marketPrice)} | Fee: ${fm$(fee)} | You get: ${fm$(net)}`);
  console.log(`  Wallet: ${fm$(cfg.wallet)}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdSellListings(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No set/collection.');return}
  tickListings(col,set,market);
  const listings=loadListings();
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📋 ACTIVE LISTINGS (${listings.listings.length})`);
  console.log(`${'═'.repeat(52)}`);
  if(!listings.listings.length){console.log('  No active listings.\n');return}
  for(const l of listings.listings){
    const mc=market.cards[l.cardNum];
    const mktPrice=mc?mc.currentPrice:l.marketPrice;
    const diff=l.price-mktPrice;
    console.log(`  #${l.id} #${l.cardNum} ${pR(l.name,22)} ${l.parallel} ${fm$(l.price)} (${diff>=0?'+':''}${fm$(diff)} vs market)`);
  }
  console.log(`\n  Use "sell-list cancel <listing-id>" to cancel`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdSellListCancel(){
  const listingId=process.argv.slice(2).find(a=>a!=='sell-list'&&a!=='cancel');
  if(!listingId){console.log('Usage: sell-list cancel <listing-id>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  tickListings(col,set,market);
  const listings=loadListings();
  const listing=listings.listings.find(l=>l.id===listingId);
  if(!listing){console.log(`\n  ❌ Listing #${listingId} not found.\n`);return}
  listings.listings=listings.listings.filter(l=>l.id!==listingId);
  saveListings(listings);
  console.log(`\n  ✅ Listing #${listingId} cancelled — #${listing.cardNum} ${listing.name} is unlocked.\n`);
}

// ── Advanced Market Extensions ──
function cmdMarketDemand(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const m=initMarket(set);
  if(!set||!m){console.log('No set/market.');return}
  const cards=getMarketCardList(m);
  const avgDemand=cards.length>0?cards.reduce((s,c)=>s+c.demandScore,0)/cards.length:0;
  const avgSentiment=m.sentiment;
  let sentimentLabel=avgSentiment>1.1?'📈 Bullish':avgSentiment<0.9?'📉 Bearish':'➡️ Neutral';
  const tierOrder=['Legendary','Superstar','Star','Uncommon','Common'];
  const tierBuckets=Object.fromEntries(tierOrder.map(t=>[t,{count:0,sum:0}]));
  for(const c of cards){
    const bucket=tierBuckets[c.starTier];
    if(bucket){
      bucket.count++;
      bucket.sum+=c.demandScore;
    }
  }
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 MARKET SENTIMENT`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Overall Sentiment: ${sentimentLabel} (${avgSentiment.toFixed(2)})`);
  console.log(`  Average Demand:    ${avgDemand.toFixed(2)}`);
  console.log(`${'─'.repeat(52)}`);
  console.log(`  Per-tier demand:`);
  for(const tier of tierOrder){
    const bucket=tierBuckets[tier];
    const avg=bucket.count>0?(bucket.sum/bucket.count):0;
    const bar='█'.repeat(Math.round(avg*10))+'░'.repeat(10-Math.round(avg*10));
    console.log(`  ${pR(tier,12)} ${bar} ${avg.toFixed(2)}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdMarketSupply(){
  const cardNum=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='market'&&a!=='supply');
  if(!cardNum){console.log('Usage: market supply <card-num>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const m=initMarket(set);
  if(!set||!m){console.log('No set/market.');return}
  const mc=m.cards[cardNum];
  if(!mc){console.log(`\n  ❌ Card #${cardNum} not found.\n`);return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📦 SUPPLY — #${cardNum} ${mc.name} [${mc.starTier}]`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Current Supply:   ${mc.supplyInMarket}`);
  console.log(`  Total Pulled:     ${mc.totalPulled}`);
  console.log(`  Sales (24h):      ${mc.sales24h}`);
  console.log(`  Avg Sale (7d):    ${fm$(mc.avgSold7d)}`);
  console.log(`  Demand Score:     ${mc.demandScore.toFixed(2)}`);
  console.log(`  Price:            ${fm$(mc.currentPrice)}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdMarketEvents(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const m=initMarket(set);
  if(!set||!m){console.log('No set/market.');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  ⚡ MARKET EVENTS`);
  console.log(`${'═'.repeat(52)}`);
  if(m.events&&m.events.length){
    console.log(`  Active:`);
    for(const e of m.events){
      const remaining=e.duration-(m.tick-e.tick);
      console.log(`  • ${e.desc} (${remaining}d left)`);
    }
  } else { console.log('  No active events.'); }
  if(m.eventLog&&m.eventLog.length){
    console.log(`\n  History (last 10):`);
    for(const e of m.eventLog.slice(-10).reverse()){
      console.log(`  Day ${e.tick} — ${e.desc}`);
    }
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdMarketLeaderboard(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const m=initMarket(set);
  if(!set||!col||!m){console.log('No data.');return}
  syncMarketToCollection(m,col);
  const owned=[...col.cards].sort((a,b)=>(b.marketPrice||b.price)-(a.marketPrice||a.price)).slice(0,15);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  👑 MOST VALUABLE IN COLLECTION`);
  console.log(`${'═'.repeat(52)}`);
  owned.forEach((c,i)=>{
    const te=TIER_EMOJI[c.starTier]||'';
    const pe=PAR_EMOJI[c.parallel]||'';
    console.log(`  ${String(i+1).padStart(2)}. ${te}${pe} ${pR(c.name,22)} ${pR(c.parallel,18)} ${fm$(c.marketPrice||c.price)}`);
  });
  console.log(`\n  Total collection value: ${fm$(col.stats.value)}`);
  console.log(`${'═'.repeat(52)}\n`);
}

// ── Auction System ──
function tickAuctions(col,set,market){
  const auctions=loadAuctions();
  const now=Date.now();
  const toResolve=[];
  for(const auction of auctions.auctions){
    const elapsedHrs=(now-auction.startedAt)/(1000*60*60);
    const durationHrs=(auction.durationDays||3)*24;
    if(elapsedHrs>=durationHrs){
      toResolve.push(auction);
    } else {
      // NPC bids: chance per check
      if(auction.bids.length>0&&auction.bids[auction.bids.length-1].bidder==='player') continue;
      const mc=market.cards[auction.cardNum];
      if(!mc) continue;
      const marketVal=mc.currentPrice*2; // NPC values card at 2x base
      const highestBid=auction.bids.length>0?Math.max(...auction.bids.map(b=>b.amount)):auction.minBid;
      const npcMaxBid=marketVal*0.8;
      if(highestBid<npcMaxBid&&Math.random()<0.15){
        const npcBid=Math.min(npcMaxBid,highestBid+marketVal*0.05*(1+Math.random()));
        const rounded=Math.round(npcBid*100)/100;
        const npcs=loadTraders();
        const npc=npcs[Math.floor(Math.random()*npcs.length)];
        auction.bids.push({bidder:npc.name,amount:rounded,time:Date.now()});
        auction.highestBid=rounded;
      }
    }
  }
  // Resolve expired auctions
  for(const auction of toResolve){
    if(auction.bids.length===0){
      // No bids — return card
      auction.status='expired';
      auctions.completed.push(auction);
    } else {
      const winningBid=auction.bids[auction.bids.length-1];
      const fee=auction.seller==='player'?winningBid.amount*0.05:0;
      const net=winningBid.amount-fee;
      auction.status='sold';auction.winningBid=winningBid;auction.net=net;
      if(auction.seller==='player'){
        // Remove card, add money
        const cardIdx=col.cards.findIndex(c=>c.id===auction.cardId);
        if(cardIdx>=0){
          col.cards.splice(cardIdx,1);col.stats.total--;
          col.stats.value-=(col.cards[cardIdx]?.marketPrice||0);
          const pc=(col.pulls[auction.cardNum]||0);
          if(pc<=1) delete col.pulls[auction.cardNum]; else col.pulls[auction.cardNum]=pc-1;
        }
        const cfg=loadCfg();cfg.wallet+=net;saveCfg(cfg);col.wallet=cfg.wallet;
        logHistory('auction-sold',`#${auction.cardNum} (${fm$(net)})`,cfg.wallet-net,cfg.wallet);
      } else if(winningBid.bidder==='player'){
        // Player won — add card, deduct money
        // Card already removed from col if player was seller
      }
      auctions.completed.push(auction);
    }
    auctions.auctions=auctions.auctions.filter(a=>a.id!==auction.id);
  }
  if(toResolve.length) rebuildPulls(col);
  auctions.lastChecked=now;saveAuctions(auctions);
  return toResolve;
}

function cmdAuction(){
  const sub=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='auction');
  if(sub==='list') return cmdAuctionList();
  if(sub==='browse'||!sub) return cmdAuctionBrowse();
  if(sub==='bid') return cmdAuctionBid();
  if(sub==='close') return cmdAuctionClose();
  console.log('Usage: auction [list|browse|bid|close]');
}

function cmdAuctionList(){
  const parts=process.argv.slice(2);
  const cardNum=parts[parts.indexOf('list')+1];
  const durationStr=parts[parts.indexOf('list')+2];
  if(!cardNum){console.log('Usage: auction list <card-num> [duration-days]');return}
  const durationDays=parseInt(durationStr)||3;
  if(durationDays<1||durationDays>7){console.log('Duration: 1-7 days');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No data.');return}
  tickAuctions(col,set,market);
  const card=col.cards.find(c=>c.cardNum===cardNum);
  if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}
  const minBid=parseFloat(process.argv.slice(2).find(a=>a!=='auction'&&a!=='list'&&a!==cardNum&&a!==durationStr&&isNaN(parseFloat(a))===false))||card.marketPrice*0.5;
  const mc=market.cards[cardNum];
  const mktPrice=mc?mc.currentPrice:card.basePrice;
  const auctions=loadAuctions();
  const auctionId=String(auctions.nextId++);
  auctions.auctions.push({
    id:auctionId,cardId:card.id,cardNum,name:card.name,parallel:card.parallel,
    starTier:card.starTier,minBid:Math.round(minBid*100)/100,marketPrice:mktPrice,
    durationDays,seller:'player',startedAt:Date.now(),bids:[],highestBid:minBid
  });
  saveAuctions(auctions);
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🏷️ AUCTION LISTED — #${cardNum} ${card.name}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Parallel: ${card.parallel} | Market: ${fm$(mktPrice)}`);
  console.log(`  Min bid: ${fm$(minBid)} | Duration: ${durationDays} day${durationDays>1?'s':''}`);
  console.log(`  Fee: 5% on sale | Card is locked until auction ends`);
  console.log(`  Auction #${auctionId}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdAuctionBrowse(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  tickAuctions(col,set,market);
  const auctions=loadAuctions();
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🏷️ ACTIVE AUCTIONS`);
  console.log(`${'═'.repeat(52)}`);
  if(!auctions.auctions.length){console.log('  No active auctions.\n');return}
  for(const a of auctions.auctions){
    const elapsedHrs=(Date.now()-a.startedAt)/(1000*60*60);
    const remaining=Math.max(0,a.durationDays*24-elapsedHrs);
    const remainingStr=remaining>=24?`${Math.ceil(remaining/24)}d`:`${Math.ceil(remaining)}h`;
    const yourBid=a.bids.some(b=>b.bidder==='player')?' 🔵your bid':'';
    const bids=a.bids.length;
    console.log(`  #${a.id} #${a.cardNum} ${pR(a.name,20)} ${pR(a.parallel,15)} Min: ${fm$(a.minBid)} Current: ${fm$(a.highestBid)} ${bids}bids ${remainingStr}${yourBid}`);
  }
  console.log(`\n  Use "auction bid <auction-id> <amount>" to bid`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdAuctionBid(){
  const parts=process.argv.slice(2);
  const auctionId=parts[parts.indexOf('bid')+1];
  const amount=parseFloat(parts[parts.indexOf('bid')+2]);
  if(!auctionId||isNaN(amount)){console.log('Usage: auction bid <auction-id> <amount>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  tickAuctions(col,set,market);
  const auctions=loadAuctions();
  const auction=auctions.auctions.find(a=>a.id===auctionId);
  if(!auction){console.log(`\n  ❌ Auction #${auctionId} not found.\n`);return}
  if(amount<=auction.highestBid){console.log(`\n  ❌ Bid must be higher than ${fm$(auction.highestBid)}.\n`);return}
  if(cfg.wallet<amount){console.log(`\n  ❌ Need ${fm$(amount)}, have ${fm$(cfg.wallet)}.\n`);return}
  const before=cfg.wallet;
  // If player had previous bid, refund it
  const prevBid=auction.bids.find(b=>b.bidder==='player');
  if(prevBid) cfg.wallet+=prevBid.amount;
  // Deduct new bid
  cfg.wallet-=amount;saveCfg(cfg);col.wallet=cfg.wallet;
  auction.bids.push({bidder:'player',amount,time:Date.now()});
  auction.highestBid=amount;
  saveAuctions(auctions);
  logHistory('auction-bid',`#${auctionId} ${fm$(amount)}`,before,cfg.wallet);
  console.log(`\n  ✅ Bid ${fm$(amount)} on auction #${auctionId} (${auction.name})`);
  console.log(`  ${auction.bids.length} bid${auction.bids.length>1?'s':''} | Highest: ${fm$(auction.highestBid)}\n`);
}

function cmdAuctionClose(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  const resolved=tickAuctions(col,set,market);
  if(!resolved.length){
    tickListings(col,set,market); // also tick listings
    console.log('\n  No auctions ready to resolve.\n');
    return;
  }
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🏷️ AUCTIONS RESOLVED (${resolved.length})`);
  console.log(`${'═'.repeat(52)}`);
  for(const a of resolved){
    if(a.status==='expired'){
      console.log(`  #${a.id} #${a.cardNum} ${a.name} — EXPIRED (no bids)`);
    } else {
      const wonBy=a.winningBid.bidder==='player'?'YOU':a.winningBid.bidder;
      console.log(`  #${a.id} #${a.cardNum} ${a.name} — SOLD for ${fm$(a.winningBid.amount)} to ${wonBy}`);
      if(a.seller==='player') console.log(`    You received ${fm$(a.net)} (after 5% fee)`);
    }
  }
  console.log(`${'═'.repeat(52)}\n`);
  rebuildPulls(col);saveCol(col);
}

// ─── AUCTION HOUSE SYSTEM (ENHANCED) ─────────────────────────────

const NPC_BIDDERS=[
  {name:'CardKing_Mike',style:'shill',aggression:0.8,maxMult:2.5,snipeChance:0.4},
  {name:'VintageVault',style:'genuine',aggression:0.5,maxMult:1.5,snipeChance:0.1},
  {name:'SlabHunter99',style:'genuine',aggression:0.6,maxMult:1.8,snipeChance:0.2},
  {name:'MysteryBidder',style:'shill',aggression:0.9,maxMult:3.0,snipeChance:0.5},
  {name:'RookieCollector',style:'genuine',aggression:0.3,maxMult:1.2,snipeChance:0.05},
  {name:'WhaleAlert',style:'genuine',aggression:0.7,maxMult:2.2,snipeChance:0.15},
  {name:'TheGrader',style:'shill',aggression:0.6,maxMult:2.0,snipeChance:0.3},
]

function tickAuctionsEnhanced(col,set,market){
  const auctions=loadAuctions();
  const now=Date.now();
  const toResolve=[];

  for(const auction of auctions.auctions){
    if(auction.status&&auction.status!=='active') continue;
    const elapsedHrs=(now-auction.startedAt)/(1000*60*60);
    const durationHrs=(auction.durationDays||3)*24;
    const timeLeftPct=Math.max(0,1-elapsedHrs/durationHrs);
    const isLastHour=timeLeftPct<0.05; // last 5%

    if(elapsedHrs>=durationHrs){
      toResolve.push(auction);
      continue;
    }

    const mc=market.cards[auction.cardNum];
    if(!mc) continue;
    const baseVal=mc.currentPrice;
    const highestBid=auction.bids.length>0?Math.max(...auction.bids.map(b=>b.amount)):auction.startingBid;
    const bidderSet=new Set(auction.bids.map(b=>b.bidder));

    // NPC bidding
    for(const npc of NPC_BIDDERS){
      if(bidderSet.has(npc.name)) continue;
      const npcMax=baseVal*npc.maxMult*(auction.isRare?1.3:1);
      if(highestBid>=npcMax) continue;
      let bidChance=npc.aggression*0.12;
      if(isLastHour&&Math.random()<npc.snipeChance) bidChance=0.8; // snipe!
      if(bidChance<Math.random()) continue;
      const increment=baseVal*0.05*(1+Math.random());
      const newBid=Math.round(Math.min(npcMax,highestBid+increment)*100)/100;
      auction.bids.push({bidder:npc.name,amount:newBid,time:Date.now(),style:npc.style});
      auction.highestBid=Math.max(auction.highestBid||0,newBid);
      auction.hot=auction.hot||npc.style==='shill';
      bidderSet.add(npc.name);
      break; // one NPC per check per auction
    }

    // NPC shill escalation (drive up price near end)
    if(isLastHour&&auction.hot&&Math.random()<0.3){
      const shill=NPC_BIDDERS.filter(n=>n.style==='shill'&&!bidderSet.has(n.name));
      if(shill.length){
        const s=shill[0];
        const snipe=baseVal*2.2*(1+Math.random()*0.3);
        if(snipe>auction.highestBid){
          const amt=Math.round(snipe*100)/100;
          auction.bids.push({bidder:s.name,amount:amt,time:Date.now(),style:'shill'});
          auction.highestBid=amt;
          bidderSet.add(s.name);
        }
      }
    }

    // Buy-it-now check
    if(auction.buyItNow&&highestBid>=auction.buyItNow){
      toResolve.push(auction);
      auction.buyNowTriggered=true;
    }
  }

  // Resolve
  for(const auction of toResolve){
    if(auction.bids.length===0){
      auction.status='expired';auction.resolvedAt=Date.now();
      auctions.completed.push(auction);
      // Return card
      if(auction.seller==='player'){
        // Card stays in collection (was never removed)
      }
    } else {
      const winningBid=auction.bids[auction.bids.length-1];
      // Check reserve
      const reserveMet=!auction.reserve||winningBid.amount>=auction.reserve;
      const fee=winningBid.amount*0.05;

      if(!reserveMet&&auction.seller==='player'){
        auction.status='reserve-not-met';auction.resolvedAt=Date.now();
        auctions.completed.push(auction);
        // Card returned (stays in collection)
      } else {
        auction.status='sold';auction.winningBid=winningBid;
        auction.net=winningBid.amount-fee;auction.fee=fee;
        auction.resolvedAt=Date.now();
        auctions.completed.push(auction);

        if(auction.seller==='player'){
          const cardIdx=col.cards.findIndex(c=>c.id===auction.cardId);
          if(cardIdx>=0){
            const card=col.cards[cardIdx];
            col.cards.splice(cardIdx,1);col.stats.total--;
            col.stats.value-=(card.marketPrice||card.price);
            const pc=(col.pulls[auction.cardNum]||0);
            if(pc<=1) delete col.pulls[auction.cardNum]; else col.pulls[auction.cardNum]=pc-1;
          }
          const cfg=loadCfg();cfg.wallet+=auction.net;saveCfg(cfg);col.wallet=cfg.wallet;
          logHistory('auction-sold',`#${auction.cardNum} ${auction.name} (${fm$(auction.net)})`,cfg.wallet-auction.net,cfg.wallet);
        } else if(winningBid.bidder==='player'){
          // Player won from NPC auction
          const cfg=loadCfg();
          if(cfg.wallet>=winningBid.amount){
            cfg.wallet-=winningBid.amount;saveCfg(cfg);col.wallet=cfg.wallet;
            const baseCard=set.cards.find(c=>c.num===auction.cardNum);
            if(baseCard){
              const par=PARALLELS[0];const grade=rollGrade();const quality=generateQuality(grade);
              const price=winningBid.amount;const id=`${set.code}-${auction.cardNum}-Base-0-G${grade.grade}`;
              const catLine=CAT.fmtCardCategoryLine(baseCard,set.setCategory);
              const newCard={id,cardNum:auction.cardNum,name:baseCard.name,subset:baseCard.subset,
                starTier:baseCard.starTier,stats:baseCard.stats||{},parallel:'Base',sn:null,
                serStr:'',plate:null,special:'None',specialDesc:'',quality,grade:grade.grade,
                gradeName:grade.name,price,isHit:false,marketPrice:price,
                popScore:0,demandScore:0,cardFormat:'standard',cardTypeId:null,cardTypeName:null,
                _categoryLine:catLine,source:'auction',auctionId:auction.id,auctionPrice:winningBid.amount};
              col.cards.push(newCard);col.pulls[auction.cardNum]=(col.pulls[auction.cardNum]||0)+1;
              col.stats.total++;col.stats.value+=price;
              if(!col.bestPull||price>col.bestPull.price)col.bestPull=newCard;
              logHistory('auction-won',`#${auction.cardNum} ${baseCard.name} (${fm$(winningBid.amount)})`,cfg.wallet+winningBid.amount,cfg.wallet);
            }
          }
        }

        // Record sale in market
        if(mc){
          mc.salesHistory.push({tick:market.tick,price:winningBid.amount,parallel:auction.parallel||'Base'});
          mc.sales24h++;
        }
      }
    }
    auctions.auctions=auctions.auctions.filter(a=>a.id!==auction.id);
  }
  if(toResolve.length) rebuildPulls(col);
  auctions.lastChecked=now;saveAuctions(auctions);
  return toResolve;
}

// Generate NPC auctions to bid on
function ensureNpcAuctions(set,market){
  const auctions=loadAuctions();
  const playerAuctions=auctions.auctions.filter(a=>a.seller==='player');
  const npcAuctions=auctions.auctions.filter(a=>a.seller!=='player');
  if(npcAuctions.length>=3) return;
  const needed=3-npcAuctions.length;
  for(let i=0;i<needed;i++){
    const card=set.cards[Math.floor(Math.random()*set.cards.length)];
    const mc=market.cards[card.num];
    if(!mc) continue;
    const isRare=card.starTier==='Legendary'||card.starTier==='Superstar';
    const startBid=Math.round(mc.currentPrice*(isRare?0.8:0.5)*100)/100;
    const reserve=isRare?Math.round(startBid*1.2*100)/100:null;
    const buyNow=isRare?Math.round(mc.currentPrice*2.5*100)/100:null;
    const npc=NPC_BIDDERS[Math.floor(Math.random()*NPC_BIDDERS.length)];
    const id=String(auctions.nextId++);
    auctions.auctions.push({
      id,cardId:`npc-${id}`,cardNum:card.num,name:card.name,parallel:'Base',
      starTier:card.starTier,startingBid:startBid,reserve,buyItNow:buyNow,
      marketPrice:mc.currentPrice,durationDays:[1,3,7][Math.floor(Math.random()*3)],
      seller:npc.name,startedAt:Date.now()-Math.random()*48*60*60*1000,
      bids:[{bidder:'CardKing_Mike',amount:startBid,time:Date.now()-Math.random()*24*60*60*1000,style:'genuine'}],
      highestBid:startBid,isRare,hot:false,status:'active',
    });
  }
  saveAuctions(auctions);
}

function cmdAuctionEnhanced(){
  const sub=process.argv.slice(2)[1];
  if(sub==='sell') return cmdAuctionSell();
  if(sub==='view') return cmdAuctionView();
  if(sub==='bid') return cmdAuctionBidEnhanced();
  if(sub==='close') return cmdAuctionCloseEnhanced();
  if(sub==='history') return cmdAuctionHistory();
  if(sub==='relist') return cmdAuctionRelist();
  return cmdAuctionListEnhanced();
}

function cmdAuctionListEnhanced(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No data.');return}
  tickAuctionsEnhanced(col,set,market);
  ensureNpcAuctions(set,market);
  const auctions=loadAuctions();
  const filter=process.argv.slice(2)[2];
  let list=auctions.auctions;
  if(filter==='ending') list=[...list].sort((a,b)=>{
    const la=(a.durationDays*24)-(Date.now()-a.startedAt)/(1000*60*60);
    const lb=(b.durationDays*24)-(Date.now()-b.startedAt)/(1000*60*60);
    return la-lb;
  });
  else if(filter==='hot') list=list.filter(a=>a.hot||a.bids.length>3);
  else if(filter==='new') list=[...list].sort((a,b)=>b.startedAt-a.startedAt);
  else list=[...list].sort((a,b)=>b.highestBid-a.highestBid);

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏷️ AUCTION HOUSE (${list.length} active)`);
  console.log(`${'═'.repeat(56)}`);
  if(!list.length){console.log('  No active auctions.\n');return}
  console.log(`  Filters: auction list [ending|hot|new]\n`);
  for(const a of list){
    const elapsedHrs=(Date.now()-a.startedAt)/(1000*60*60);
    const remaining=Math.max(0,a.durationDays*24-elapsedHrs);
    const timeStr=remaining>=24?`${Math.ceil(remaining/24)}d`:`${Math.ceil(remaining)}h`;
    const sellerTag=a.seller==='player'?'⭐YOU':'📦'+a.seller;
    const yourBid=a.bids.some(b=>b.bidder==='player')?' 🔵':'';
    const reserveTag=a.reserve?` R:${fm$(a.reserve)}`:'';
    const binTag=a.buyItNow?` BIN:${fm$(a.buyItNow)}`:'';
    const hotTag=a.hot?' 🔥':'';
    const bids=a.bids.length;
    console.log(`  #${a.id} ${sellerTag} #${a.cardNum} ${pR(a.name,20)} ${fm$(a.highestBid).padStart(8)} ${bids}bids ${timeStr}${reserveTag}${binTag}${hotTag}${yourBid}`);
  }
  console.log(`\n  auction view <id> | auction bid <id> <amount> | auction sell <card-num>`);
  console.log(`  R=reserve BIN=buy-it-now 🔥=shill activity 🔵=your bid`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdAuctionView(){
  const auctionId=process.argv.slice(2)[2];
  if(!auctionId){console.log('Usage: auction view <auction-id>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  tickAuctionsEnhanced(col,set,market);
  const auctions=loadAuctions();
  const auction=auctions.auctions.find(a=>a.id===auctionId);
  if(!auction){console.log(`\n  ❌ Auction #${auctionId} not found.\n`);return}
  const mc=market.cards[auction.cardNum];
  const elapsedHrs=(Date.now()-auction.startedAt)/(1000*60*60);
  const remaining=Math.max(0,auction.durationDays*24-elapsedHrs);
  const timeStr=remaining>=24?`${Math.ceil(remaining/24)}d ${Math.ceil(remaining%24)}h`:`${Math.ceil(remaining)}h`;

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏷️ AUCTION #${auctionId} — ${auction.name} (#${auction.cardNum})`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  Seller: ${auction.seller==='player'?'YOU':auction.seller}`);
  console.log(`  Parallel: ${auction.parallel} | Tier: ${auction.starTier}`);
  console.log(`  Market Price: ${fm$(auction.marketPrice)}`);
  console.log(`  Starting Bid: ${fm$(auction.startingBid)}`);
  if(auction.reserve) console.log(`  Reserve: ${fm$(auction.reserve)} ${auction.highestBid>=auction.reserve?'✅ MET':'❌ NOT MET'}`);
  if(auction.buyItNow) console.log(`  Buy-It-Now: ${fm$(auction.buyItNow)}`);
  console.log(`  Time Left: ${timeStr}`);
  console.log(`  Current Bid: ${fm$(auction.highestBid)} (${auction.bids.length} bids)`);

  if(auction.bids.length>0){
    console.log(`\n  📋 BID HISTORY:`);
    for(const b of auction.bids.slice(-10)){
      const ago=Math.floor((Date.now()-b.time)/(1000*60*60));
      const agoStr=ago<1?'just now':ago<24?`${ago}h ago`:`${Math.floor(ago/24)}d ago`;
      const styleTag=b.style==='shill'?' 🤖':'';
      const youTag=b.bidder==='player'?' 👤':'';
      console.log(`    ${fm$(b.amount).padStart(8)} by ${b.bidder}${styleTag}${youTag} (${agoStr})`);
    }
  }
  if(auction.hot) console.log(`\n  ⚠️  Shill activity detected — prices may be inflated!`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdAuctionSell(){
  const parts=process.argv.slice(2);
  const cardNum=parts.find(a=>/^\d+$/.test(a));
  if(!cardNum){console.log('Usage: auction sell <card-num> [--start $X] [--reserve $X] [--duration N] [--bin $X]');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  if(!set||!col){console.log('No data.');return}
  tickAuctionsEnhanced(col,set,market);
  const card=col.cards.find(c=>c.cardNum===cardNum);
  if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}
  const mc=market.cards[cardNum];
  const mktPrice=mc?mc.currentPrice:card.basePrice;
  const startIdx=parts.indexOf('--start');
  const reserveIdx=parts.indexOf('--reserve');
  const durationIdx=parts.indexOf('--duration');
  const binIdx=parts.indexOf('--bin');
  const startingBid=startIdx>=0?parseFloat(parts[startIdx+1]):Math.round(mktPrice*0.6*100)/100;
  const reserve=reserveIdx>=0?parseFloat(parts[reserveIdx+1]):null;
  const durationDays=durationIdx>=0?parseInt(parts[durationIdx+1]):3;
  const buyItNow=binIdx>=0?parseFloat(parts[binIdx+1]):null;

  if(isNaN(startingBid)||startingBid<=0){console.log('Invalid starting bid.');return}
  if(reserve!==null&&(isNaN(reserve)||reserve<=0)){console.log('Invalid reserve.');return}
  if(isNaN(durationDays)||durationDays<1||durationDays>7){console.log('Duration: 1-7 days.');return}

  const isRare=card.starTier==='Legendary'||card.starTier==='Superstar';
  const auctions=loadAuctions();
  const auctionId=String(auctions.nextId++);
  auctions.auctions.push({
    id:auctionId,cardId:card.id,cardNum,name:card.name,parallel:card.parallel,
    starTier:card.starTier,startingBid,reserve,buyItNow,marketPrice:mktPrice,
    durationDays,seller:'player',startedAt:Date.now(),bids:[],highestBid:startingBid,
    isRare,hot:false,status:'active'
  });
  saveAuctions(auctions);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏷️ AUCTION LISTED — #${cardNum} ${card.name}`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  ${card.parallel} | Market: ${fm$(mktPrice)} | Tier: ${card.starTier}`);
  console.log(`  Starting Bid: ${fm$(startingBid)}`);
  if(reserve) console.log(`  Reserve: ${fm$(reserve)}`);
  if(buyItNow) console.log(`  Buy-It-Now: ${fm$(buyItNow)}`);
  console.log(`  Duration: ${durationDays}d | Fee: 5% on sale`);
  console.log(`  Auction #${auctionId} — card is locked`);
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdAuctionBidEnhanced(){
  const parts=process.argv.slice(2);
  const bidIdx=parts.indexOf('bid');
  const auctionId=parts[bidIdx+1];
  const amount=parseFloat(parts[bidIdx+2]);
  if(!auctionId||isNaN(amount)){console.log('Usage: auction bid <auction-id> <amount>');return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  tickAuctionsEnhanced(col,set,market);
  const auctions=loadAuctions();
  const auction=auctions.auctions.find(a=>a.id===auctionId);
  if(!auction){console.log(`\n  ❌ Auction #${auctionId} not found.\n`);return}
  const minIncrement=0.50;
  if(amount<=auction.highestBid){console.log(`\n  ❌ Bid must exceed ${fm$(auction.highestBid)} (min +${fm$(minIncrement)}).\n`);return}
  if(amount<auction.highestBid+minIncrement){console.log(`\n  ❌ Minimum increment is ${fm$(minIncrement)}.\n`);return}
  // Buy-it-now shortcut
  if(auction.buyItNow&&amount>=auction.buyItNow){
    if(cfg.wallet<auction.buyItNow){console.log(`\n  ❌ Need ${fm$(auction.buyItNow)} for BIN.\n`);return}
    const before=cfg.wallet;
    const prevBid=auction.bids.find(b=>b.bidder==='player');
    if(prevBid) cfg.wallet+=prevBid.amount;
    cfg.wallet-=auction.buyItNow;saveCfg(cfg);col.wallet=cfg.wallet;
    auction.bids.push({bidder:'player',amount:auction.buyItNow,time:Date.now()});
    auction.highestBid=auction.buyItNow;auction.buyNowTriggered=true;
    saveAuctions(auctions);
    console.log(`\n  🏷️ BUY-IT-NOW! ${fm$(auction.buyItNow)} on #${auctionId}\n`);
    // Resolve immediately
    tickAuctionsEnhanced(col,set,market);
    return;
  }
  if(cfg.wallet<amount){console.log(`\n  ❌ Need ${fm$(amount)}, have ${fm$(cfg.wallet)}.\n`);return}
  const before=cfg.wallet;
  const prevBid=auction.bids.find(b=>b.bidder==='player');
  if(prevBid) cfg.wallet+=prevBid.amount;
  cfg.wallet-=amount;saveCfg(cfg);col.wallet=cfg.wallet;
  auction.bids.push({bidder:'player',amount,time:Date.now()});
  auction.highestBid=amount;
  saveAuctions(auctions);
  logHistory('auction-bid',`#${auctionId} ${auction.name} ${fm$(amount)}`,before,cfg.wallet);
  const shillWarning=auction.hot?'\n  ⚠️  Shill activity on this auction — bid carefully!':'';
  console.log(`\n  ✅ Bid ${fm$(amount)} on #${auctionId} (${auction.name})`);
  console.log(`  ${auction.bids.length} bids | Highest: ${fm$(auction.highestBid)}${shillWarning}\n`);
}

function cmdAuctionCloseEnhanced(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set);
  const resolved=tickAuctionsEnhanced(col,set,market);
  if(!resolved.length){console.log('\n  No auctions ready to resolve.\n');return}
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🏷️ AUCTIONS RESOLVED (${resolved.length})`);
  console.log(`${'═'.repeat(56)}`);
  for(const a of resolved){
    if(a.status==='expired') console.log(`  #${a.id} #${a.cardNum} ${a.name} — ❌ EXPIRED (no bids)`);
    else if(a.status==='reserve-not-met') console.log(`  #${a.id} #${a.cardNum} ${a.name} — ⚠️ RESERVE NOT MET (${fm$(a.winningBid.amount)} < ${fm$(a.reserve)})`);
    else {
      const wonBy=a.winningBid.bidder==='player'?'👤 YOU':'📦'+a.winningBid.bidder;
      console.log(`  #${a.id} #${a.cardNum} ${a.name} — ✅ SOLD ${fm$(a.winningBid.amount)} to ${wonBy}`);
      if(a.seller==='player') console.log(`    Net: ${fm$(a.net)} (5% fee: ${fm$(a.fee)})`);
    }
  }
  console.log(`${'═'.repeat(56)}\n`);
  rebuildPulls(col);saveCol(col);
}

function cmdAuctionHistory(){
  const auctions=loadAuctions();
  if(!auctions.completed.length){console.log('\n  📜 No completed auctions.\n');return}
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  📜 AUCTION HISTORY (${auctions.completed.length})`);
  console.log(`${'═'.repeat(56)}`);
  for(const a of auctions.completed.slice(-15).reverse()){
    const ts=a.resolvedAt?new Date(a.resolvedAt).toISOString().split('T')[0]:'?';
    const sellerTag=a.seller==='player'?'⭐':'📦';
    if(a.status==='expired') console.log(`  ${ts} ${sellerTag} #${a.id} #${a.cardNum} ${a.name} — EXPIRED`);
    else if(a.status==='reserve-not-met') console.log(`  ${ts} ${sellerTag} #${a.id} #${a.cardNum} ${a.name} — RNM ${fm$(a.highestBid)}`);
    else console.log(`  ${ts} ${sellerTag} #${a.id} #${a.cardNum} ${a.name} — ${fm$(a.winningBid?.amount||a.highestBid)}`);
  }
  console.log(`${'═'.repeat(56)}\n`);
}

function cmdAuctionRelist(){
  const auctionId=process.argv.slice(2)[2];
  if(!auctionId){console.log('Usage: auction relist <completed-auction-id>');return}
  const auctions=loadAuctions();
  const completed=auctions.completed.find(a=>a.id===auctionId&&(a.status==='expired'||a.status==='reserve-not-met')&&a.seller==='player');
  if(!completed){console.log(`\n  ❌ No relistable auction found for #${auctionId}.\n`);return}
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();
  const card=col.cards.find(c=>c.id===completed.cardId);
  if(!card){console.log(`\n  ❌ Card no longer in collection.\n`);return}
  const newId=String(auctions.nextId++);
  auctions.auctions.push({
    id:newId,cardId:completed.cardId,cardNum:completed.cardNum,name:completed.name,
    parallel:completed.parallel,starTier:completed.starTier,
    startingBid:Math.round(completed.startingBid*0.8*100)/100,
    reserve:completed.reserve?Math.round(completed.reserve*0.8*100)/100:null,
    buyItNow:null,marketPrice:completed.marketPrice,durationDays:3,
    seller:'player',startedAt:Date.now(),bids:[],highestBid:completed.startingBid*0.8,
    isRare:completed.isRare,hot:false,status:'active'
  });
  saveAuctions(auctions);
  console.log(`\n  ✅ Relisted as auction #${newId} (20% price cut, 3 day duration)\n`);
}

// ─── GRADING ECONOMY EXPANSION ────────────────────────────────────

const POPULATION_FILE=path.join(DATA_DIR,'grading-population.json')
function loadPopulation(){
  return rJ(POPULATION_FILE)||{}
}
function savePopulation(p){wJ(POPULATION_FILE,p)}

function simNpcPopulationGrowth(setKey,cardNum){
  const pop=loadPopulation();
  if(!pop[setKey]) pop[setKey]={}
  if(!pop[setKey][cardNum]) pop[setKey][cardNum]={totalGraded:0}
  const cardPop=pop[setKey][cardNum]
  // Simulate NPC grading (gradeflation)
  for(const comp of['PSA','BGS','SGC']){
    if(!cardPop[comp]) cardPop[comp]={}
    // Chance of new graded copies appearing (simulates other collectors)
    const newGrades=Math.floor(Math.random()*3)
    for(let i=0;i<newGrades;i++){
      // Weight towards lower grades (bell curve centered around 8)
      const r=Math.random()
      let grade
      if(r<0.01) grade=10
      else if(r<0.05) grade=9.5
      else if(r<0.20) grade=9
      else if(r<0.35) grade=8.5
      else if(r<0.55) grade=8
      else grade=7
      cardPop[comp][grade]=(cardPop[comp][grade]||0)+1
      cardPop.totalGraded++
    }
  }
  savePopulation(pop)
}

function bumpPopulation(setKey,cardNum,company,grade){
  const pop=loadPopulation()
  if(!pop[setKey]) pop[setKey]={}
  if(!pop[setKey][cardNum]) pop[setKey][cardNum]={totalGraded:0}
  if(!pop[setKey][cardNum][company]) pop[setKey][cardNum][company]={}
  pop[setKey][cardNum][company][grade]=(pop[setKey][cardNum][company][grade]||0)+1
  pop[setKey][cardNum].totalGraded++
  savePopulation(pop)
}

function gradeRarityBonus(cardNum,starTier,grade,set){
  const pop=loadPopulation()
  const setKey=set.code+'-'+set.year
  const cardPop=pop[setKey]?.[cardNum]
  if(!cardPop||cardPop.totalGraded===0) return{bonus:1.5,label:'First graded!'}
  const gradeCount=cardPop.PSA?.[grade]||0
  const total=cardPop.totalGraded
  if(grade===10){
    if(gradeCount===0) return{bonus:starTier==='Legendary'?5.0:starTier==='Superstar'?3.5:starTier==='Star'?2.5:1.8,label:'First PSA 10!'}
    if(gradeCount<=3) return{bonus:starTier==='Legendary'?4.0:starTier==='Superstar'?3.0:starTier==='Star'?2.2:1.5,label:'Ultra rare (≤3)'}
    if(gradeCount<=10) return{bonus:starTier==='Legendary'?3.0:starTier==='Superstar'?2.0:1.3,label:'Rare (≤10)'}
    if(gradeCount<=30) return{bonus:1.5,label:'Uncommon (≤30)'}
    // Gradeflation: diminishing returns
    const dilution=Math.max(1.1, 2.0-gradeCount/100)
    return{bonus:dilution,label:`Diluted (${gradeCount} exist)`}
  }
  if(grade===9){
    if(gradeCount<=5) return{bonus:1.3,label:'Low pop 9'}
    const dilution=Math.max(1.05, 1.3-gradeCount/200)
    return{bonus:dilution,label:`${gradeCount} PSA 9s exist`}
  }
  return{bonus:1.0,label:'Common grade'}
}

function gradeflationPressure(cardNum,company,grade,set){
  const pop=loadPopulation()
  const setKey=set.code+'-'+set.year
  const cardPop=pop[setKey]?.[cardNum]
  if(!cardPop) return{pressure:'none',premium:0}
  const total=cardPop.totalGraded
  if(total<10) return{pressure:'none',premium:100}
  const highGrades=(cardPop[company]?.[10]||0)+(cardPop[company]?.[9.5]||0)+(cardPop[company]?.[9]||0)
  const ratio=highGrades/total
  if(ratio>0.3) return{pressure:'high',premium:Math.round((1-ratio)*100)}
  if(ratio>0.15) return{pressure:'medium',premium:Math.round((1-ratio)*100)}
  return{pressure:'low',premium:Math.round((1-ratio)*100)}
}

function cmdGradePopReport(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet()
  const a=process.argv.slice(3)
  const num=a.find(x=>/^\d+$/.test(x))
  if(!num){console.log('Usage: card-engine grade pop-report <card-num>');return}
  const card=col.cards.find(c=>c.cardNum===num)
  const baseCard=set.cards.find(c=>c.num===num)
  if(!card&&!baseCard){console.log(`\n  ❌ Card #${num} not found.\n`);return}
  simNpcPopulationGrowth(col.setKey,num)
  const pop=loadPopulation()
  const cardPop=pop[col.setKey]?.[num]
  const name=card?.name||baseCard?.name||num
  const tier=card?.starTier||baseCard?.starTier||'Common'

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  📋 POPULATION REPORT — #${num} ${name}`)
  console.log(`  Tier: ${tier}`)
  console.log(`${'═'.repeat(56)}`)
  if(!cardPop||cardPop.totalGraded===0){
    console.log(`\n  No graded examples in the population database.\n`)
    return;
  }
  const grades=[10,'9.5',9,'8.5',8,7]
  const companies=['PSA','BGS','SGC']
  // Header
  const header='  Grade      '+companies.map(c=>c.padEnd(8)).join('')+'Pop%'
  console.log(header)
  console.log(`  ${'─'.repeat(50)}`)
  for(const g of grades){
    const row=[`  ${String(g).padEnd(10)}`]
    let gradeTotal=0
    for(const c of companies){
      const cnt=cardPop[c]?.[g]||0
      row.push(String(cnt).padEnd(8))
      gradeTotal+=cnt
    }
    const pct=cardPop.totalGraded>0?(gradeTotal/cardPop.totalGraded*100).toFixed(1):'0.0'
    row.push(pct+'%')
    console.log(row.join(''))
  }
  const totals=companies.map(c=>Object.values(cardPop[c]||{}).reduce((s,v)=>s+v,0))
  console.log(`  ${'─'.repeat(50)}`)
  console.log(`  Total:     ${totals.join('    ')}   100%`)
  console.log(`  Grand total: ${cardPop.totalGraded}`)

  // Gradeflation analysis
  const pressure=gradeflationPressure(num,'PSA',10,set)
  const psa10=cardPop.PSA?.[10]||0
  const psa9=cardPop.PSA?.[9]||0
  const ratio=cardPop.totalGraded>0?(psa10+psa9)/cardPop.totalGraded:0

  console.log(`\n  📊 GRADING ANALYSIS:`)
  const pressureBar={'none':'█░░░░░░░░░ low','low':'███░░░░░░░ low-med','medium':'█████░░░░░ medium','high':'████████░░ HIGH'}[pressure.pressure]
  console.log(`  Gradeflation:  ${pressureBar}`)
  console.log(`  PSA 9+ ratio:   ${(ratio*100).toFixed(1)}% of total graded`)
  console.log(`  Grade premium:  ${pressure.premium}% (${pressure.pressure} pressure)`)

  // Rarity bonuses
  for(const g of[10,9]){
    const rb=gradeRarityBonus(num,tier,g,set)
    const cnt=cardPop.PSA?.[g]||0
    console.log(`  PSA ${g}: ${cnt} copies — ${rb.label} (${rb.bonus.toFixed(1)}× bonus)`)
  }

  // Your copies
  const myGraded=col.cards.filter(c=>c.cardNum===num&&c.gradingResult&&!c.gradingResult.cracked)
  if(myGraded.length){
    console.log(`  Your copies: ${myGraded.map(c=>gradeLabel(c.gradingResult.grade,c.gradingResult.company,c.gradingResult.condition)).join(', ')}`)
  }
  console.log(`${'═'.repeat(56)}\n`)
}

function cmdGradeValueAdd(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet()
  const a=process.argv.slice(3)
  const num=a.find(x=>/^\d+$/.test(x))
  if(!num){console.log('Usage: card-engine grade value-add <card-num>');return}
  const card=col.cards.find(c=>c.cardNum===num)
  const baseCard=set.cards.find(c=>c.num===num)
  if(!card&&!baseCard){console.log(`\n  ❌ Card #${num} not found.\n`);return}
  const rawValue=card?(card.gradingResult?.originalPrice||card.price):(baseCard?.basePrice||10)
  const tier=card?.starTier||baseCard?.starTier||'Common'
  const name=card?.name||baseCard?.name||num

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  💰 VALUE ANALYSIS — #${num} ${name}`)
  console.log(`${'═'.repeat(56)}`)
  console.log(`  Raw value: ${fm$(rawValue)}`)
  console.log(`  Tier: ${tier}\n`)

  const scenarios=[
    {grade:7,label:'PSA 7',mult:0.9},
    {grade:8,label:'PSA 8',mult:1.1},
    {grade:9,label:'PSA 9',mult:1.5},
    {grade:'9.5',label:'PSA 9.5',mult:2.5},
    {grade:10,label:'PSA 10',mult:4.0},
  ]

  console.log(`  ${'Grade'.padEnd(12)} ${'Base Mult'.padEnd(12)} ${'Rarity Bonus'.padEnd(14)} ${'Final Mult'.padEnd(12)} ${'Value'.padEnd(10)} ${'Value Add'}`)
  console.log(`  ${'─'.repeat(70)}`)

  for(const s of scenarios){
    const rb=gradeRarityBonus(num,tier,s.grade,set)
    const finalMult=s.mult*rb.bonus
    const finalValue=Math.round(rawValue*finalMult*100)/100
    const add=finalValue-rawValue
    console.log(`  ${s.label.padEnd(12)} ${s.mult.toFixed(1)}×`.padEnd(12)+' '+`${rb.bonus.toFixed(1)}× ${rb.label}`.padEnd(14)+' '+`${finalMult.toFixed(1)}×`.padEnd(12)+' '+fm$(finalValue).padStart(8)+' '+`${add>=0?'+':''}${fm$(add)}`)
  }

  // Gradeflation warning
  const pressure=gradeflationPressure(num,'PSA',10,set)
  if(pressure.pressure!=='none'){
    console.log(`\n  ⚠️  Gradeflation ${pressure.pressure.toUpperCase()}: grade premiums compressed by ${100-pressure.premium}%`)
  }
  console.log(`${'═'.repeat(56)}\n`)
}

function cmdGradeCrackRisk(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();const set=loadSet()
  const a=process.argv.slice(3)
  const num=a.find(x=>/^\d+$/.test(x))
  if(!num){console.log('Usage: card-engine grade crack-risk <card-num>');return}
  const card=col.cards.find(c=>c.cardNum===num&&c.gradingResult&&!c.gradingResult.cracked)
  if(!card){
    const ungraded=col.cards.find(c=>c.cardNum===num&&!c.gradingResult)
    if(ungraded){console.log(`\n  ℹ️  Card #${num} is ungraded. Use "grade submit" first.\n`);return}
    console.log(`\n  ❌ No graded slab found for #${num}.\n`);return
  }
  const gr=card.gradingResult
  const label=gradeLabel(gr.grade,gr.company,gr.condition)
  const currentValue=card.price
  const originalValue=gr.originalPrice||currentValue/gr.mult||currentValue*0.5

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  💥 CRACK RISK — #${num} ${card.name} (${label})`)
  console.log(`${'═'.repeat(56)}`)
  console.log(`  Current slab value: ${fm$(currentValue)}`)
  console.log(`  Original raw value:  ${fm$(originalValue)}`)
  console.log(`  Value at risk:       ${fm$(currentValue-originalValue)}\n`)

  // Crack scenarios
  const degradeChance=0.20
  const cond=gr.condition||{centering:90,corners:9,edges:9,surface:9}
  console.log(`  Crack outcomes:`)
  console.log(`  ${'─'.repeat(50)}`)

  // Preserve (80%)
  console.log(`  ✅ Condition preserved (80%):`)
  console.log(`     Card returns at ~${fm$(originalValue)}`)
  console.log(`     Loss: ${fm$(currentValue-originalValue)}`)

  // Degrade (20%)
  const degradedCond={
    centering:clamp(cond.centering-Math.round(Math.random()*8),50,100),
    corners:Math.round(clamp(cond.corners-1.5,1,10)*10)/10,
    edges:Math.round(clamp(cond.edges-1.0,1,10)*10)/10,
    surface:Math.round(clamp(cond.surface-2.0,1,10)*10)/10,
  }
  const degradedGrade=conditionToGrade(degradedCond,gr.company)
  const degradedMult=gradeMultiplier(degradedGrade,gr.company,degradedCond)
  const degradedValue=Math.round(originalValue*degradedMult*100)/100
  console.log(`\n  ❌ Condition degraded (20%):`)
  console.log(`     New grade estimate: ${gr.company} ${degradedGrade}`)
  console.log(`     New value: ~${fm$(degradedValue)}`)
  console.log(`     Loss: ${fm$(currentValue-degradedValue)}`)

  // EV
  const ev=currentValue*0.80*0+currentValue*0.20*(currentValue-degradedValue)
  const evPct=currentValue>0?(ev/currentValue*100).toFixed(1):'?'
  console.log(`\n  📊 Expected loss from crack: ${fm$(ev)} (${evPct}%)`)
  console.log(`  💡 Only crack if you plan to resubmit and think condition improved`)
  console.log(`${'═'.repeat(56)}\n`)
}

// ─── SUPPLY CHAIN / PROVENANCE ────────────────────────────────────

const ORIGIN_PRESETS=[
  {type:'retail-blaster',label:'Pulled from retail blaster',mult:1.0,emoji:'🏪'},
  {type:'hobby-box',label:'Pulled from hobby box',mult:1.05,emoji:'📦'},
  {type:'hobby-pack',label:'Pulled from hobby pack',mult:1.0,emoji:'🃏'},
  {type:'jumbo-box',label:'Pulled from jumbo box',mult:1.02,emoji:'🎁'},
  {type:'store-bought',label:'Store bought (LCS)',mult:1.05,emoji:'🏪'},
  {type:'auction-won',label:'Won at auction',mult:1.0,emoji:'🏷️'},
  {type:'trade',label:'Acquired via trade',mult:0.98,emoji:'🤝'},
  {type:'lot-pull',label:'Pulled from collection lot',mult:0.97,emoji:'🎁'},
  {type:'first-pack',label:'First pack of set (collector premium!)',mult:1.15,emoji:'⭐'},
  {type:'viral-break',label:'Pulled during viral break',mult:1.20,emoji:'🔥'},
  {type:'marketplace',label:'Purchased from marketplace',mult:1.0,emoji:'🛒'},
]

function assignOrigin(card,source){
  const preset=ORIGIN_PRESETS.find(p=>p.type===source)||ORIGIN_PRESETS[0]
  // Rare chance of special origin
  if(Math.random()<0.02) return ORIGIN_PRESETS.find(p=>p.type==='viral-break')
  if(Math.random()<0.01) return ORIGIN_PRESETS.find(p=>p.type==='first-pack')
  return preset
}

function cmdOrigin(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const col=loadCol();if(!col||!col.cards.length){console.log('Collection is empty.');return}
  const set=loadSet()
  const num=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='origin')

  if(!num){
    // Summary of all origins
    console.log(`\n${'═'.repeat(56)}`)
    console.log(`  🔗 PROVENANCE SUMMARY`)
    console.log(`${'═'.repeat(56)}`)
    const originCounts={}
    for(const c of col.cards){
      const o=c.origin||assignOrigin(c,c.source||'hobby-pack')
      if(!c.origin) c.origin=o // backfill
      originCounts[o.type]=(originCounts[o.type]||0)+1
    }
    saveCol(col)
    for(const[type,count]of Object.entries(originCounts).sort((a,b)=>b[1]-a[1])){
      const preset=ORIGIN_PRESETS.find(p=>p.type===type)||ORIGIN_PRESETS[0]
      console.log(`  ${preset.emoji} ${preset.label.padEnd(40)} ${count} cards`)
    }
    console.log(`${'═'.repeat(56)}\n`)
    return
  }

  // Specific card
  const cards=col.cards.filter(c=>c.cardNum===num)
  if(!cards.length){console.log(`\n  ❌ Card #${num} not in collection.\n`);return}
  const baseCard=set.cards.find(c=>c.num===num)

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  🔗 PROVENANCE — #${num} ${baseCard?.name||'Unknown'}`)
  console.log(`${'═'.repeat(56)}`)
  for(let i=0;i<cards.length;i++){
    const c=cards[i]
    const o=c.origin||assignOrigin(c,c.source||'hobby-pack')
    if(!c.origin) c.origin=o
    const premium=o.mult>1?`+${((o.mult-1)*100).toFixed(0)}%`:''
    console.log(`  Copy ${i+1}: ${o.emoji} ${o.label}${premium?' ('+premium+' value)':''}`)
    if(c.purchaseDate) console.log(`    Acquired: ${new Date(c.purchaseDate).toISOString().split('T')[0]}`)
    if(c.auctionId) console.log(`    Auction #${c.auctionId} — ${fm$(c.auctionPrice||0)}`)
    if(c.lotId) console.log(`    Lot #${c.lotId} from ${c.lotSeller||'?'}`)
    if(c.tradeWith) console.log(`    Traded with NPC: ${c.tradeWith}`)
    if(c.source) console.log(`    Source: ${c.source}`)
  }
  saveCol(col)
  console.log(`${'═'.repeat(56)}\n`)
}

// ─── MARKET DEPTH / ORDER BOOK ────────────────────────────────────

const ORDERBOOK_DIR=path.join(DATA_DIR,'orderbook')
function loadOrderBook(setKey){
  return rJ(path.join(ORDERBOOK_DIR,setKey+'.json'))||{bids:[],asks:[],lastUpdate:0}
}
function saveOrderBook(setKey,ob){
  const dir=ORDERBOOK_DIR
  if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true})
  wJ(path.join(dir,setKey+'.json'),ob)
}

function generateOrderBook(setKey,market){
  const ob=loadOrderBook(setKey)
  const now=Date.now()
  if(now-ob.lastUpdate<3600000&&ob.bids.length>0) return ob // cache 1hr

  const cards=getMarketCardList(market)
  const marketMakers=[
    {name:'DeepLiquidity_LLC',style:'tight',spread:0.03,depth:5},
    {name:'CardMarket_Maker',style:'wide',spread:0.06,depth:4},
    {name:'WhaleDesk',style:'tight',spread:0.04,depth:3},
  ]

  const newBids=[]
  const newAsks=[]

  for(const mc of cards){
    const price=mc.currentPrice
    const vol=mc.demandScore

    // Market maker orders
    for(const mm of marketMakers){
      for(let i=0;i<mm.depth;i++){
        const offset=price*mm.spread*(i+1)*(0.8+Math.random()*0.4)
        const bidPrice=Math.round((price-offset)*100)/100
        const askPrice=Math.round((price+offset)*100)/100
        const qty=Math.max(1,Math.floor(Math.random()*3*vol*5))
        newBids.push({cardNum:mc.num,name:mc.name,price:bidPrice,qty,maker:mm.name,orderType:'limit'})
        newAsks.push({cardNum:mc.num,name:mc.name,price:askPrice,qty,maker:mm.name,orderType:'limit'})
      }
    }

    // Random retail orders
    if(Math.random()<0.3){
      const qty=Math.floor(Math.random()*2)+1
      const bidPrice=Math.round(price*(0.85+Math.random()*0.1)*100)/100
      newBids.push({cardNum:mc.num,name:mc.name,price:bidPrice,qty,maker:'retail',orderType:'limit'})
    }
    if(Math.random()<0.3){
      const qty=Math.floor(Math.random()*2)+1
      const askPrice=Math.round(price*(1.05+Math.random()*0.15)*100)/100
      newAsks.push({cardNum:mc.num,name:mc.name,price:askPrice,qty,maker:'retail',orderType:'limit'})
    }
  }

  ob.bids=newBids
  ob.asks=newAsks
  ob.lastUpdate=now
  saveOrderBook(setKey,ob)
  return ob
}

function cmdMarketBook(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const market=initMarket(set)
  if(!set||!market){console.log('No set/market.');return}
  const cardNum=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='market'&&a!=='book')
  if(!cardNum){console.log('Usage: market book <card-num>');return}
  const mc=market.cards[cardNum]
  if(!mc){console.log(`\n  ❌ Card #${cardNum} not found.\n`);return}
  const ob=generateOrderBook(set.code+'-'+set.year,market)
  const bids=ob.bids.filter(b=>b.cardNum===cardNum).sort((a,b)=>b.price-a.price)
  const asks=ob.asks.filter(a=>a.cardNum===cardNum).sort((a,b)=>a.price-b.price)
  const bestBid=bids[0]?.price||0
  const bestAsk=asks[0]?.price||0
  const spread=bestAsk>0&&bestBid>0?(bestAsk-bestBid).toFixed(2):'?'
  const mid=bestAsk>0&&bestBid>0?((bestAsk+bestBid)/2).toFixed(2):'?'

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  📊 ORDER BOOK — #${cardNum} ${mc.name}`)
  console.log(`  Market: ${fm$(mc.currentPrice)} | Spread: $${spread} | Mid: $${mid}`)
  console.log(`${'═'.repeat(56)}`)

  console.log(`\n  🟢 ASKS (sell orders):`)
  for(const a of asks.slice(0,8)){
    const bar='█'.repeat(Math.min(a.qty,10))
    console.log(`    ${fm$(a.price).padStart(8)} ×${a.qty} ${bar.padEnd(12)} ${a.maker}`)
  }
  if(asks.length>8) console.log(`    ... +${asks.length-8} more`)

  console.log(`\n  ─── SPREAD $${spread} ───\n`)

  console.log(`  🔴 BIDS (buy orders):`)
  for(const b of bids.slice(0,8)){
    const bar='█'.repeat(Math.min(b.qty,10))
    console.log(`    ${fm$(b.price).padStart(8)} ×${b.qty} ${bar.padEnd(12)} ${b.maker}`)
  }
  if(bids.length>8) console.log(`    ... +${bids.length-8} more`)

  // Liquidity summary
  const totalBidQty=bids.reduce((s,b)=>s+b.qty,0)
  const totalAskQty=asks.reduce((s,a)=>s+a.qty,0)
  console.log(`\n  Total depth: ${totalBidQty} bids / ${totalAskQty} asks`)
  console.log(`${'═'.repeat(56)}\n`)
}

function cmdMarketOrder(){
  const parts=process.argv.slice(2)
  const orderIdx=parts.indexOf('order')
  const cardNum=parts[orderIdx+1]
  const side=parts[orderIdx+2] // buy or sell
  const qty=parseInt(parts[orderIdx+3])||1
  const limitIdx=parts.indexOf('--limit')
  const isMarket=parts.includes('--market')
  const limitPrice=limitIdx>=0?parseFloat(parts[limitIdx+1]):null

  if(!cardNum||!side||!['buy','sell'].includes(side)){
    console.log('Usage: market order <card-num> <buy|sell> <qty> [--limit $X|--market]');return
  }
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();const col=loadCol();const market=initMarket(set)
  if(!set||!col){console.log('No data.');return}
  const mc=market.cards[cardNum]
  if(!mc){console.log(`\n  ❌ Card #${cardNum} not found.\n`);return}

  const ob=generateOrderBook(set.code+'-'+set.year,market)

  if(side==='buy'){
    const asks=ob.asks.filter(a=>a.cardNum===cardNum).sort((a,b)=>a.price-b.price)
    if(!asks.length){console.log(`\n  ❌ No asks for #${cardNum}.\n`);return}
    let totalCost=0;let filled=0;const fills=[]
    for(const ask of asks){
      if(filled>=qty) break
      if(limitPrice&&ask.price>limitPrice) break
      const take=Math.min(qty-filled,ask.qty)
      // Slippage for large orders
      const slipMult=take>2?1+(take-2)*0.02:1
      const fillPrice=Math.round(ask.price*slipMult*100)/100
      totalCost+=fillPrice*take;filled+=take
      fills.push({price:fillPrice,qty:take,maker:ask.maker,slip:slipMult>1?`+${((slipMult-1)*100).toFixed(0)}%`:''})
    }
    if(filled===0){console.log(`\n  ❌ No orders filled. Limit too low?\n`);return}
    const avgPrice=totalCost/filled
    const buyerPremium=Math.round(totalCost*0.05*100)/100
    const grandTotal=totalCost+buyerPremium
    if(cfg.wallet<grandTotal){console.log(`\n  ❌ Need ${fm$(grandTotal)}, have ${fm$(cfg.wallet)}.\n`);return}
    const before=cfg.wallet
    cfg.wallet-=grandTotal;saveCfg(cfg);col.wallet=cfg.wallet

    // Add cards
    const baseCard=set.cards.find(c=>c.num===cardNum)
    for(let i=0;i<filled;i++){
      const par=PARALLELS[0];const grade=rollGrade();const quality=generateQuality(grade)
      const price=avgPrice*par.pm*grade.mult
      const id=`${set.code}-${cardNum}-Base-0-G${grade.grade}`
      const catLine=CAT.fmtCardCategoryLine(baseCard,set.setCategory)
      const newCard={id,cardNum,name:baseCard.name,subset:baseCard.subset,
        starTier:baseCard.starTier,stats:baseCard.stats||{},parallel:'Base',sn:null,
        serStr:'',plate:null,special:'None',specialDesc:'',quality,grade:grade.grade,
        gradeName:grade.name,price,isHit:false,marketPrice:price,
        popScore:0,demandScore:0,cardFormat:'standard',cardTypeId:null,cardTypeName:null,
        _categoryLine:catLine,source:'order-book',orderAvgPrice:avgPrice}
      col.cards.push(newCard);col.pulls[cardNum]=(col.pulls[cardNum]||0)+1
      col.stats.total++;col.stats.value+=price
    }
    rebuildPulls(col);saveCol(col)
    logHistory('market-buy',`${filled}× #${cardNum} @${fm$(avgPrice)} (${fm$(grandTotal)})`,before,cfg.wallet)

    console.log(`\n${'═'.repeat(56)}`)
    console.log(`  🛒 MARKET BUY — ${filled}× #${cardNum} ${baseCard?.name}`)
    console.log(`${'═'.repeat(56)}`)
    for(const f of fills) console.log(`  ${fm$(f.price).padStart(8)} ×${f.qty} from ${f.maker} ${f.slip}`)
    console.log(`  Avg price: ${fm$(avgPrice)} | Premium: ${fm$(buyerPremium)}`)
    console.log(`  Total: ${fm$(grandTotal)} | Wallet: ${fm$(cfg.wallet)}`)
    console.log(`${'═'.repeat(56)}\n`)
  } else {
    // Sell
    const card=col.cards.find(c=>c.cardNum===cardNum)
    if(!card){console.log(`\n  ❌ Card #${cardNum} not in collection.\n`);return}
    const bids=ob.bids.filter(b=>b.cardNum===cardNum).sort((a,b)=>b.price-a.price)
    if(!bids.length){console.log(`\n  ❌ No bids for #${cardNum}.\n`);return}
    let totalRevenue=0;let filled=0;const fills=[]
    for(const bid of bids){
      if(filled>=qty) break
      if(limitPrice&&bid.price<limitPrice) break
      const take=Math.min(qty-filled,bid.qty)
      const slipMult=take>2?1-(take-2)*0.02:1
      const fillPrice=Math.round(bid.price*slipMult*100)/100
      totalRevenue+=fillPrice*take;filled+=take
      fills.push({price:fillPrice,qty:take,maker:bid.maker,slip:slipMult<1?`-${((1-slipMult)*100).toFixed(0)}%`:''})
    }
    if(filled===0){console.log(`\n  ❌ No orders filled.\n`);return}
    const fee=Math.round(totalRevenue*0.05*100)/100
    const net=totalRevenue-fee
    const before=cfg.wallet
    const idx=col.cards.indexOf(card)
    col.cards.splice(idx,1);col.stats.total--;col.stats.value-=(card.marketPrice||card.price)
    const pc=(col.pulls[cardNum]||0)
    if(pc<=1) delete col.pulls[cardNum]; else col.pulls[cardNum]=pc-1
    cfg.wallet+=net;saveCfg(cfg);col.wallet=cfg.wallet
    rebuildPulls(col);saveCol(col)
    logHistory('market-sell',`${filled}× #${cardNum} @${fm$(totalRevenue/filled)} (${fm$(net)})`,before,cfg.wallet)

    console.log(`\n${'═'.repeat(56)}`)
    console.log(`  💸 MARKET SELL — ${filled}× #${cardNum} ${card.name}`)
    console.log(`${'═'.repeat(56)}`)
    for(const f of fills) console.log(`  ${fm$(f.price).padStart(8)} ×${f.qty} to ${f.maker} ${f.slip}`)
    console.log(`  Gross: ${fm$(totalRevenue)} | Fee: ${fm$(fee)} | Net: ${fm$(net)}`)
    console.log(`  Wallet: ${fm$(cfg.wallet)}`)
    console.log(`${'═'.repeat(56)}\n`)
  }
}

// Main
const args=process.argv.slice(2);const cmd=args[0];
{
  const cfg=loadCfg();
  if(cfg.activeSet){
    const set=loadSet();
    const market=set?loadMarket(cfg.activeSet):null;
    if(set&&market&&cmd!=='flopps-wildcard') maybeAnnounceFloppsNews(set,market,cmd||'');
  }
}
switch(cmd){
  case'generate-set':case'gen-set':cmdGenSet();break;
  case'open-pack':cmdOpenPack(args[1]);break;
  case'open-box':cmdOpenBox(args[1]);break;
  case'portfolio':cmdPortfolio();break;
  case'collection':cmdCollection();break;
  case'checklist':cmdChecklist();break;
  case'set-info':cmdSetInfo();break;
  case'card-types':cmdCardTypes();break;
  case'new-season':cmdNewSeason();break;
  case'list-sets':cmdListSets();break;
  case'remove-money':cmdRemoveMoney();break;
  case'add-money':cmdAddMoney();break;
  case'wallet':cmdWallet();break;
  case'set-money':cmdSetMoney();break;
  case'duplicates':case'dups':cmdDuplicates();break;
  case'top-cards':cmdTopCards();break;
  case'pack-stats':cmdPackStats();break;
  case'history':cmdHistory();break;
  case'undo':cmdUndo(args[1]);break;
  case'reset-collection':cmdResetCollection();break;
  case'grade-card':cmdGradeCard();break;
  case'grade':cmdGrade();break;
  case'market':
    if(args[1]==='scalpers'||args[1]==='scalper'){cmdMarketScalpers();break}
    if(args[1]==='scalper-log'){cmdScalperLog();break}
    if(args[1]==='macro'){cmdMarketMacro();break}
    if(args[1]==='book'){cmdMarketBook();break}
    if(args[1]==='order'){cmdMarketOrder();break}
    cmdMarket();break;
  case'origin':cmdOrigin();break;
  case'flag':cmdFlag();break;
  case'revalue':cmdRevalue();break;
  case'sell':cmdSell();break;
  case'buy':case'buy-single':cmdBuySingle();break;
  case'trade':cmdTrade();break;
  case'lot':cmdLot();break;
  case'sell-list':cmdSellList();break;
  case'auction':cmdAuctionEnhanced();break;
  case'store':cmdStore();break;
  case'flopps-status':cmdFloppsStatus();break;
  case'flopps-day':cmdFloppsDay(args[1]);break;
  case'flopps-today':cmdFloppsToday();break;
  case'flopps-wildcard':cmdFloppsWildcard();break;
  case'flopps':case'flopps-launch':
    const{execFileSync:execFileSyncFlopps}=require('child_process');
    execFileSyncFlopps(process.execPath,[path.join(__dirname,'ai-set-generator.js'),'--flopps',...process.argv.slice(3)],{stdio:'inherit',cwd:DATA_DIR});
    break;
  case'generate-set-ai':case'gen-ai':
    const{execFileSync}=require('child_process');
    execFileSync(process.execPath,[path.join(__dirname,'ai-set-generator.js'),...process.argv.slice(3)],{stdio:'inherit',cwd:DATA_DIR});
    break;
  default:console.log(`Usage: card-engine <command> [options]
  Commands: generate-set [--category <type>] [--sport <sport>] [--cards N] [--theme <theme>],
            generate-set-ai [--category <type>] [--sport <sport>] [--model MODEL] [--theme THEME] [--cards N] [--set-code CODE],
            open-pack [type] [--real], open-box [type] [--real],
            portfolio, collection [set-code|name], checklist [set-code|name],
            sell <card-num>, set-info, card-types, new-season, list-sets, wallet,
            add-money [amount], set-money <amount>,
            grade-card <card-num>|--all|--dups,
            grade submit|status|history|pop|cost|crack|stats,
            market [card-num], market macro, market scalpers, market scalper <id>,
            flag [card-num|owned|movers|gainers|losers], revalue,
            store list, store visit <id>, store buy <id> <product> [qty], store stock <id>, store pressure <id>, store restock <id>, store trade <id> <card-num> <product>, store reputation,
            flopps-status, flopps-day <day|today>, flopps-today, flopps-wildcard,
            duplicates, top-cards [--grade], pack-stats, history [--all|--count N],
            undo [n], reset-collection --confirm,

  Pack types: hobby ($120), blaster ($50), retail ($5), jumbo ($30)

  Modes:
    Default  = virtual (dry-run) — simulate breaks, no cards saved, no wallet spent
    --real   = commit to collection — cards saved as personal assets, wallet deducted
               Also advances the secondary market by elapsed 12-hour ticks since the last operation.

  Secondary Market (auto-advances on any inventory change):
    market                # read-only dashboard (top movers, trends, events, book vs market)
    market <card-num>     # individual card detail with price chart, your copies, recent sales
    market macro          # real-world macro signal snapshot and freshness
    flag                  # per-set overview: sentiment, tier breakdown, top movers, price index
    flag <card-num>       # per-card sparkline chart + sales history + owned copies
    flag owned            # market tracker for only your owned cards + portfolio trend
    flag movers           # top 10 absolute movers
    flag gainers          # top 10 gainers
    flag losers           # top 10 losers
    revalue               # recalculate collection from current market prices, save

    Market advances automatically when:
      • You open a real pack or box (time-based: elapsed 12-hour ticks since the last operation)
      • You sell a card (+1 tick, sold cards increase market supply)
      • You sell duplicates in bulk (+1 tick, all sold cards increase supply)

  Selling & Buying:
    sell <card-num>       # sell cheapest copy of card #007
    sell --best <num>     # sell most valuable copy instead
    sell dups             # sell all duplicates in the collection (cheapest first, keep 1 best)
    sell dups --pack      # sell only duplicates from the latest opened pack/box batch
    sell pack-dups        # alias for sell dups --pack
    buy <card-num> [--best] [--max-price $X]  # buy from market (5% premium)
    sell-list <card-num> <price>  # consign a card at your price (10% fee)
    sell-list instant <card-num>  # instant sell at market price (10% fee)
    sell-list listings             # view active consignment listings
    sell-list cancel <listing-id>  # cancel a consignment listing
    auction list <card-num> [days] # list card for auction (1-7 days)
    auction browse                 # view active auctions
    auction bid <id> <amount>      # place a bid
    auction close                  # resolve expired auctions
    Sell price = market price (not book price). Check "market" first.

  Trading & Lots:
    trade browse [<npc-id>]        # view NPC traders and inventories
    trade offer <npc> <your-card> for <their-card>  # propose a trade
    trade counter <trade-id> <card>  # accept counter-offer
    trade history                  # view trade history
    lot browse                     # browse collection lots for sale
    lot buy <lot-id>               # buy a lot (contents revealed!)

  Other:
    grade-card <card-num> # submit to PSA grading (cost by card value)
    portfolio             # financial overview + set completion

  Examples:
    card-engine open-pack retail              # dry-run a retail pack ($5)
    card-engine open-pack retail --real       # buy pack, advance market, cards saved
    card-engine market                       # market dashboard
    card-engine market 039                   # card #039 market detail with chart
    card-engine revalue                      # sync collection to current market
    card-engine sell 007                     # sell cheapest copy of card #007
    card-engine grade-card <card-num>        # submit card to PSA grading
    card-engine flopps-status               # show the fake FLPS stock price and latest bulletin
    card-engine flopps-day <day|today>      # show Flopps actions on a specific simulation day
    card-engine flopps-today                # show Flopps actions for today
    card-engine flopps-wildcard             # force a surprise AI-written Flopps event

  Stores:
    store list                            # list all stores with relationship tier
    store visit <store-id>                # browse store inventory & prices
    store buy <store-id> <product> [qty]  # buy sealed product into inventory
    store stock <store-id>                # show detailed stock levels
    store pressure <store-id>             # show store pressure / restock factors
    store restock <store-id>              # run restock check and report change
    store reputation                      # relationship status with all stores

  Scalpers:
    market scalpers                       # scalper activity log (buys, listings)
    market scalper <id>                   # detailed view of specific scalper
    market scalper-log                    # scrolling feed of all scalper activities

  AI generation (requires OPENROUTER_API_KEY):
    generate-set-ai                                # default: google/gemini-2.0-flash-001
    generate-set-ai --model meta-llama/llama-4-maverick:free
    generate-set-ai --category sports --sport basketball
    generate-set-ai --category movie --cards 150
    generate-set-ai --theme "Cyberpunk Street Racing"
    generate-set-ai --cards 200 --set-code DRG
    generate-set-ai --flopps --theme "Arena of Broken Promises"
    flopps --theme "Arena of Broken Promises" --set-code FPP`);break;
}
