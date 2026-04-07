#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARD_ENGINE="$SCRIPT_DIR/card-engine.js"
AI_SET_GENERATOR="$SCRIPT_DIR/ai-set-generator.js"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if ! grep -Fq "$needle" <<<"$haystack"; then
    printf 'Expected output to contain:\n%s\n\nActual output:\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

make_fixture() {
  local data_dir
  data_dir="$(mktemp -d "${TMPDIR:-/tmp}/trading-cards-flopps-XXXXXX")"
  node - "$data_dir" <<'NODE'
const fs=require('fs');
const path=require('path');

const dataDir=process.argv[2];
const daysAgo=14;
const createdAt=Date.now()-((daysAgo*24+3)*60*60*1000);

function writeJson(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2));
}

const setKey='TST-2026';
const set={
  code:'TST',
  name:'Test Flagship',
  year:2026,
  category:'character',
  cards:[
    {num:'001',name:'Alpha Prime',starTier:'Legendary',subset:'Legend',basePrice:5,currentPrice:6},
    {num:'002',name:'Beta Flux',starTier:'Superstar',subset:'AllStar',basePrice:2,currentPrice:2.4},
    {num:'003',name:'Gamma Echo',starTier:'Star',subset:'Base',basePrice:1,currentPrice:1.1},
  ],
};
const cards=Object.fromEntries(set.cards.map((card)=>[card.num,{
  ...card,
  avgSold7d:card.currentPrice,
  popScore:0.3,
  demandScore:0.4,
  salesHistory:[],
}]));
const market={
  setKey,
  tick:28,
  sentiment:1.08,
  createdAt,
  lastTickAt:new Date().toISOString(),
  events:[],
  history:{},
  cards,
  cardList:Object.values(cards),
  eventLog:[],
  setAggregates:{
    totalChangePct:3.2,
    priceIndex:[{tick:28,value:1.03}],
  },
};
const config={
  wallet:250,
  activeSet:setKey,
  archivedSets:[],
  mode:'real',
  pocketMoney:5,
};
const collection={
  setKey,
  cards:[],
  pulls:{},
  stats:{total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0},
  bestPull:null,
  parallelCounts:{},
  wallet:250,
  sealedInventory:{},
};
const macro={
  lastFetch:Date.now(),
  source:'fixture',
  label:'neutral',
  signal:0,
  weekPct:0,
  monthPct:0,
  compositePct:0,
  latest:{date:'2026-04-07',value:5000},
};
const wildcardFixture={
  title:'Warehouse Curiosity Program',
  summary:'Flopps announced a Warehouse Curiosity Program that lets select breakers bid on mystery pallets linked to overprint and damaged-pack inventory.',
  paraphrase:'They found a way to monetize leftovers, confusion, and gambling chemistry at the same time.',
  category:'marketplace',
  executive:'Lillian Mercer',
  executiveRole:'CFO',
  stockDelta:0.027,
  marketImpact:'Sealed product prices wobble as collectors speculate about hidden chase cards entering circulation through gray channels.',
  collectorImpact:'Breakers sprint toward the pallets while singles buyers panic about surprise supply and weird provenance.',
};
const setFixture=[
  {
    num:'001',
    name:'Launch Alpha',
    subset:'Legend',
    starTier:'Legendary',
    desc:'Flagship chase anchor.',
    stats:{power:95,speed:88,technique:92,endurance:90,charisma:86},
    basePrice:4.75,
    imagePrompt:'launch alpha front',
    imagePromptBack:'launch alpha back',
    imagePromptBackFlavor:'Launch alpha flavor text.',
  },
  {
    num:'002',
    name:'Launch Beta',
    subset:'AllStar',
    starTier:'Superstar',
    desc:'Second premium anchor.',
    stats:{power:84,speed:81,technique:79,endurance:83,charisma:80},
    basePrice:2.1,
    imagePrompt:'launch beta front',
    imagePromptBack:'launch beta back',
    imagePromptBackFlavor:'Launch beta flavor text.',
  },
  {
    num:'003',
    name:'Launch Gamma',
    subset:'Base',
    starTier:'Star',
    desc:'Core flagship card.',
    stats:{power:70,speed:68,technique:72,endurance:71,charisma:69},
    basePrice:1.05,
    imagePrompt:'launch gamma front',
    imagePromptBack:'launch gamma back',
    imagePromptBackFlavor:'Launch gamma flavor text.',
  }
];
const articleFixture=`# Flopps Fixture Launch

Short opening summary.

## What Changed
- Fixture bullet one
- Fixture bullet two

## Development Notes
- Fixture dev note

## What Collectors Should Expect
- Fixture collector expectation

## Market Note
Fixture market note.

## Next Drop
Fixture next drop teaser.

Closing line.`;

writeJson(path.join(dataDir,'config.json'),config);
writeJson(path.join(dataDir,'collections',`${setKey}.json`),collection);
writeJson(path.join(dataDir,'sets',`${setKey}.json`),set);
writeJson(path.join(dataDir,'sets',setKey,'market.json'),market);
writeJson(path.join(dataDir,'market-macro.json'),macro);
writeJson(path.join(dataDir,'stores','default-stores.json'),[]);
writeJson(path.join(dataDir,'scalpers','default-scalpers.json'),[]);
writeJson(path.join(dataDir,'fixtures','wildcard-event.json'),wildcardFixture);
writeJson(path.join(dataDir,'fixtures','set-cards.json'),setFixture);
fs.writeFileSync(path.join(dataDir,'fixtures','launch-article.md'),articleFixture);
NODE
  printf '%s\n' "$data_dir"
}

run_card_engine() {
  local data_dir="$1"
  shift
  TRADING_CARDS_DATA_DIR="$data_dir" node "$CARD_ENGINE" "$@"
}

run_ai_set_generator() {
  local data_dir="$1"
  shift
  TRADING_CARDS_DATA_DIR="$data_dir" node "$AI_SET_GENERATOR" "$@"
}

scenario_scheduled_announcement() {
  local data_dir output
  data_dir="$(make_fixture)"
  output="$(run_card_engine "$data_dir" wallet)"
  assert_contains "$output" "Flopps desk note:"
  assert_contains "$output" "Sell-Through Update"
  node - "$data_dir" <<'NODE'
const fs=require('fs');
const path=require('path');
const dataDir=process.argv[2];
const state=JSON.parse(fs.readFileSync(path.join(dataDir,'flopps','state.json'),'utf8'));
if(state.latestNews.kind!=='sellthrough') throw new Error(`expected sellthrough news, got ${state.latestNews.kind}`);
if(state.latestNews.command!=='wallet') throw new Error(`expected wallet trigger, got ${state.latestNews.command}`);
if(state.latestNews.day!==14) throw new Error(`expected day 14, got ${state.latestNews.day}`);
if(!state.dayHistory.some((entry)=>entry.day===14)) throw new Error('missing day 14 snapshot');
if(!state.stock.history.some((entry)=>entry.day===14)) throw new Error('missing day 14 stock history');
NODE
}

scenario_wildcard_and_reports() {
  local data_dir fixture output status_output day_output
  data_dir="$(make_fixture)"
  fixture="$data_dir/fixtures/wildcard-event.json"
  run_card_engine "$data_dir" wallet >/dev/null
  output="$(FLOPPS_WILDCARD_FIXTURE="$fixture" run_card_engine "$data_dir" flopps-wildcard)"
  status_output="$(run_card_engine "$data_dir" flopps-status)"
  day_output="$(run_card_engine "$data_dir" flopps-day today)"
  assert_contains "$output" "Warehouse Curiosity Program"
  assert_contains "$output" "Collector effect: Breakers sprint toward the pallets while singles buyers panic about surprise supply and weird provenance."
  assert_contains "$status_output" "Warehouse Curiosity Program"
  assert_contains "$status_output" "Source: openrouter:kimi-k2.5"
  assert_contains "$status_output" "Market:"
  assert_contains "$status_output" "Collector effect:"
  assert_contains "$day_output" "Warehouse Curiosity Program"
  assert_contains "$day_output" "Triggered by: flopps-wildcard"
  assert_contains "$day_output" "Market:"
  assert_contains "$day_output" "Collector effect:"
  node - "$data_dir" <<'NODE'
const fs=require('fs');
const path=require('path');
const dataDir=process.argv[2];
const state=JSON.parse(fs.readFileSync(path.join(dataDir,'flopps','state.json'),'utf8'));
if(state.latestNews.kind!=='wildcard') throw new Error(`expected wildcard latest news, got ${state.latestNews.kind}`);
if(state.latestNews.command!=='flopps-wildcard') throw new Error(`expected flopps-wildcard command, got ${state.latestNews.command}`);
if(state.latestNews.source!=='openrouter:kimi-k2.5') throw new Error(`unexpected source ${state.latestNews.source}`);
if(!state.newsHistory.some((entry)=>entry.kind==='sellthrough')) throw new Error('scheduled bulletin should still be present in history');
const wildcardDir=path.join(dataDir,'flopps','wildcards');
const artifacts=fs.readdirSync(wildcardDir).filter((file)=>file.endsWith('.json')&&!file.startsWith('tmp-'));
if(!artifacts.length) throw new Error('expected wildcard artifact file');
const artifact=JSON.parse(fs.readFileSync(path.join(wildcardDir,artifacts.sort().slice(-1)[0]),'utf8'));
if(artifact.bulletin.title!=='Warehouse Curiosity Program') throw new Error(`unexpected artifact title ${artifact.bulletin.title}`);
NODE
}

scenario_ai_wildcard_helper() {
  local data_dir fixture out_file output
  data_dir="$(make_fixture)"
  fixture="$data_dir/fixtures/wildcard-event.json"
  out_file="$data_dir/out/wildcard.json"
  output="$(FLOPPS_WILDCARD_FIXTURE="$fixture" run_ai_set_generator "$data_dir" \
    --flopps \
    --flopps-mode wildcard-event \
    --wildcard-context '{"day":14}' \
    --wildcard-output-file "$out_file" \
    --json-output)"
  assert_contains "$output" "Warehouse Curiosity Program"
  node - "$out_file" <<'NODE'
const fs=require('fs');
const outFile=process.argv[2];
const event=JSON.parse(fs.readFileSync(outFile,'utf8'));
if(event.title!=='Warehouse Curiosity Program') throw new Error(`unexpected title ${event.title}`);
if(!event.marketImpact.includes('Sealed product prices wobble')) throw new Error('missing marketImpact');
if(!event.collectorImpact.includes('Breakers sprint')) throw new Error('missing collectorImpact');
NODE
}

scenario_launch_context_artifact() {
  local data_dir fixture_article fixture_cards output launch_dir
  data_dir="$(make_fixture)"
  fixture_article="$data_dir/fixtures/launch-article.md"
  fixture_cards="$data_dir/fixtures/set-cards.json"
  run_card_engine "$data_dir" wallet >/dev/null
  output="$(AI_SET_GENERATOR_FIXTURE_FILE="$fixture_cards" FLOPPS_ARTICLE_FIXTURE="$fixture_article" run_ai_set_generator "$data_dir" \
    --theme "Fixture Launch Theme" \
    --set-code FLX \
    --cards 3 \
    --flopps \
    --flopps-mode launch)"
  launch_dir="$data_dir/flopps/launches/FLX"
  assert_contains "$output" "Flopps Fixture Launch"
  [[ -f "$launch_dir/launch.json" ]] || fail "missing launch.json"
  [[ -f "$launch_dir/launch.md" ]] || fail "missing launch.md"
  [[ -f "$launch_dir/simulation-context.json" ]] || fail "missing simulation-context.json"
  node - "$launch_dir" <<'NODE'
const fs=require('fs');
const path=require('path');
const launchDir=process.argv[2];
const launch=JSON.parse(fs.readFileSync(path.join(launchDir,'launch.json'),'utf8'));
const context=JSON.parse(fs.readFileSync(path.join(launchDir,'simulation-context.json'),'utf8'));
if(launch.article.trim()!==fs.readFileSync(path.join(launchDir,'launch.md'),'utf8').trim()) throw new Error('launch markdown mismatch');
if(!launch.simulationContext) throw new Error('launch.json missing embedded simulationContext');
if(launch.simulationContext.architecture!=='simulation-first, writing-second') throw new Error('launch.json simulationContext missing architecture');
if(context.architecture!=='simulation-first, writing-second') throw new Error(`unexpected architecture ${context.architecture}`);
if(context.corporation.ticker!=='FLPS') throw new Error('missing FLPS ticker');
if(!context.latestBulletin || !context.latestBulletin.title || context.latestBulletin.day!==14) throw new Error('latest bulletin not preserved in context');
if(!context.trendDesk || !context.trendDesk.topPick) throw new Error('trend desk top pick missing');
if(context.set.setCode!=='FLX') throw new Error(`unexpected set code ${context.set.setCode}`);
if(context.set.cardCount!==3) throw new Error(`unexpected card count ${context.set.cardCount}`);
NODE
}

scenario_scheduled_announcement
scenario_wildcard_and_reports
scenario_ai_wildcard_helper
scenario_launch_context_artifact

printf 'flopps simulation regression suite passed\n'
