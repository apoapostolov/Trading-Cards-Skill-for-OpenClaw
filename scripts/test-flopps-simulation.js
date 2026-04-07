#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');

const SCRIPT_DIR=__dirname;
const CARD_ENGINE=path.join(SCRIPT_DIR,'card-engine.js');
const AI_SET_GENERATOR=path.join(SCRIPT_DIR,'ai-set-generator.js');

function readJson(file){
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

function writeJson(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2));
}

function makeTempDataDir(){
  return fs.mkdtempSync(path.join(os.tmpdir(),'trading-cards-flopps-'));
}

function isoDaysAgo(days){
  return Date.now()-((days*24+3)*60*60*1000);
}

function seedFloppsFixture(dataDir,{daysAgo=14}={}){
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
  const cardMap=Object.fromEntries(set.cards.map((card)=>[card.num,{
    ...card,
    currentPrice:card.currentPrice,
    avgSold7d:card.currentPrice,
    popScore:0.3,
    demandScore:0.4,
    salesHistory:[],
  }]));
  const market={
    setKey,
    tick:28,
    sentiment:1.08,
    createdAt:isoDaysAgo(daysAgo),
    lastTickAt:new Date().toISOString(),
    events:[],
    history:{},
    cards:cardMap,
    cardList:Object.values(cardMap),
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

  writeJson(path.join(dataDir,'config.json'),config);
  writeJson(path.join(dataDir,'collections',`${setKey}.json`),collection);
  writeJson(path.join(dataDir,'sets',`${setKey}.json`),set);
  writeJson(path.join(dataDir,'sets',setKey,'market.json'),market);
  writeJson(path.join(dataDir,'market-macro.json'),macro);
  writeJson(path.join(dataDir,'stores','default-stores.json'),[]);
  writeJson(path.join(dataDir,'scalpers','default-scalpers.json'),[]);
  writeJson(path.join(dataDir,'fixtures','wildcard-event.json'),wildcardFixture);

  return {setKey,wildcardFixture};
}

function runNode(script,args,dataDir,extraEnv={}){
  return execFileSync('node',[script,...args],{
    cwd:path.dirname(script),
    encoding:'utf8',
    env:{
      ...process.env,
      TRADING_CARDS_DATA_DIR:dataDir,
      ...extraEnv,
    },
  });
}

function runCardEngine(dataDir,args,extraEnv={}){
  return runNode(CARD_ENGINE,args,dataDir,extraEnv);
}

function runAiSetGenerator(dataDir,args,extraEnv={}){
  return runNode(AI_SET_GENERATOR,args,dataDir,extraEnv);
}

function latestWildcardArtifact(dataDir){
  const dir=path.join(dataDir,'flopps','wildcards');
  const files=fs.readdirSync(dir).filter((file)=>file.endsWith('.json')&&!file.startsWith('tmp-')).sort();
  assert(files.length>0,'expected at least one wildcard artifact');
  return path.join(dir,files[files.length-1]);
}

function scenarioAutomaticScheduledAnnouncement(){
  const dataDir=makeTempDataDir();
  seedFloppsFixture(dataDir,{daysAgo:14});

  const output=runCardEngine(dataDir,['wallet']);
  const state=readJson(path.join(dataDir,'flopps','state.json'));

  assert.match(output,/Flopps desk note:/);
  assert.match(output,/Sell-Through Update/);
  assert.strictEqual(state.latestNews.kind,'sellthrough');
  assert.strictEqual(state.latestNews.command,'wallet');
  assert.strictEqual(state.latestNews.day,14);
  assert(state.dayHistory.some((entry)=>entry.day===14),'expected day history snapshot for day 14');
  assert(state.stock.history.some((entry)=>entry.day===14),'expected stock history snapshot for day 14');
}

function scenarioWildcardCommandAndReports(){
  const dataDir=makeTempDataDir();
  const {wildcardFixture}=seedFloppsFixture(dataDir,{daysAgo:14});
  const fixturePath=path.join(dataDir,'fixtures','wildcard-event.json');

  runCardEngine(dataDir,['wallet']);
  const wildcardOutput=runCardEngine(dataDir,['flopps-wildcard'],{
    FLOPPS_WILDCARD_FIXTURE:fixturePath,
  });
  const state=readJson(path.join(dataDir,'flopps','state.json'));
  const statusOutput=runCardEngine(dataDir,['flopps-status']);
  const dayOutput=runCardEngine(dataDir,['flopps-day','today']);
  const artifact=readJson(latestWildcardArtifact(dataDir));

  assert.match(wildcardOutput,new RegExp(wildcardFixture.title));
  assert.match(wildcardOutput,new RegExp(wildcardFixture.marketImpact.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.strictEqual(state.latestNews.kind,'wildcard');
  assert.strictEqual(state.latestNews.command,'flopps-wildcard');
  assert.strictEqual(state.latestNews.source,'openrouter:kimi-k2.5');
  assert.strictEqual(state.latestNews.marketImpact,wildcardFixture.marketImpact);
  assert.strictEqual(state.latestNews.collectorImpact,wildcardFixture.collectorImpact);
  assert.strictEqual(artifact.bulletin.title,wildcardFixture.title);
  assert.match(statusOutput,new RegExp(wildcardFixture.title));
  assert.match(statusOutput,/Source: openrouter:kimi-k2\.5/);
  assert.match(statusOutput,/Market:/);
  assert.match(statusOutput,/Collector effect:/);
  assert.match(dayOutput,new RegExp(wildcardFixture.title));
  assert.match(dayOutput,/Triggered by: flopps-wildcard/);
  assert.match(dayOutput,/Market:/);
  assert.match(dayOutput,/Collector effect:/);
}

function scenarioAiWildcardHelperCommand(){
  const dataDir=makeTempDataDir();
  const {wildcardFixture}=seedFloppsFixture(dataDir,{daysAgo:14});
  const fixturePath=path.join(dataDir,'fixtures','wildcard-event.json');
  const outFile=path.join(dataDir,'out','wildcard.json');

  const output=runAiSetGenerator(dataDir,[
    '--flopps',
    '--flopps-mode','wildcard-event',
    '--wildcard-context',JSON.stringify({day:14}),
    '--wildcard-output-file',outFile,
    '--json-output',
  ],{
    FLOPPS_WILDCARD_FIXTURE:fixturePath,
  });

  const event=readJson(outFile);
  assert.match(output,new RegExp(wildcardFixture.title));
  assert.strictEqual(event.title,wildcardFixture.title);
  assert.strictEqual(event.marketImpact,wildcardFixture.marketImpact);
  assert.strictEqual(event.collectorImpact,wildcardFixture.collectorImpact);
}

scenarioAutomaticScheduledAnnouncement();
scenarioWildcardCommandAndReports();
scenarioAiWildcardHelperCommand();

console.log('flopps simulation regression suite passed');
