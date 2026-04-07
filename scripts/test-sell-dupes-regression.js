#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');

function readJson(file){
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

function writeJson(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2));
}

function cents(n){
  return Math.round(n*100);
}

function sumCardValue(cards){
  return cards.reduce((sum,c)=>sum+(c.marketPrice||c.price||0),0);
}

function prepareRepo(){
  const repoRoot=path.resolve(__dirname,'..');
  const tmpRoot=fs.mkdtempSync(path.join(os.tmpdir(),'trading-cards-sell-regression-'));
  fs.cpSync(repoRoot,tmpRoot,{recursive:true});

  const cfgPath=path.join(tmpRoot,'data','config.json');
  const cfg=readJson(cfgPath);
  const setKey=cfg.activeSet||'BOC-2026';
  cfg.activeSet=setKey;
  cfg.wallet=10;
  cfg.mode='real';
  writeJson(cfgPath,cfg);

  return {tmpRoot,setKey,cfgPath};
}

function seedCollection(tmpRoot,setKey,{cards,pulls,wallet=10,statsValue}){
  const colPath=path.join(tmpRoot,'data','collections',`${setKey}.json`);
  const fixtureCol={
    setKey,
    cards,
    pulls,
    stats:{
      total:cards.length,
      value:statsValue!=null?statsValue:sumCardValue(cards),
      spent:0,
      boxes:0,
      packs:0,
      hits:0,
      oneOfOnes:0,
    },
    bestPull:null,
    parallelCounts:{},
    wallet,
    sealedInventory:{},
  };
  writeJson(colPath,fixtureCol);
  return colPath;
}

function runCardEngine(tmpRoot,args){
  return execFileSync('node',['scripts/card-engine.js',...args],{
    cwd:tmpRoot,
    encoding:'utf8',
    env:process.env,
  });
}

function assertCounts(cards,expected){
  const counts=cards.reduce((acc,c)=>(acc[c.cardNum]=(acc[c.cardNum]||0)+1,acc),{});
  assert.deepStrictEqual(counts,expected);
}

function scenarioBulkDuplicates(){
  const {tmpRoot,setKey}=prepareRepo();
  const cards=[
    {cardNum:'101',name:'Alpha One',parallel:'Base',price:1.00,marketPrice:1.00,condition:'NM'},
    {cardNum:'102',name:'Beta One',parallel:'Base',price:2.00,marketPrice:2.00,condition:'NM'},
    {cardNum:'101',name:'Alpha Two',parallel:'Base',price:0.50,marketPrice:0.50,condition:'NM'},
    {cardNum:'103',name:'Gamma One',parallel:'Base',price:3.00,marketPrice:3.00,condition:'NM'},
    {cardNum:'102',name:'Beta Two',parallel:'Base',price:0.75,marketPrice:0.75,condition:'NM'},
  ];
  seedCollection(tmpRoot,setKey,{
    cards,
    pulls:{101:2,102:2,103:1},
    wallet:10,
  });

  const output=runCardEngine(tmpRoot,['sell','dups']);
  const after=readJson(path.join(tmpRoot,'data','collections',`${setKey}.json`));

  assert.deepStrictEqual(after.cards.map(c=>c.cardNum),['101','102','103'],`unexpected cards left after sell dups:\n${output}`);
  assertCounts(after.cards,{101:1,102:1,103:1});
  assert.strictEqual(after.stats.total,3);
  assert.strictEqual(cents(after.stats.value),cents(sumCardValue(after.cards)));
  assert.strictEqual(cents(after.wallet),1125);
  assert.strictEqual(after.pulls['101'],1);
  assert.strictEqual(after.pulls['102'],1);
  assert.strictEqual(after.pulls['103'],1);
}

function scenarioPackScopedDuplicates(){
  const {tmpRoot,setKey}=prepareRepo();
  const cards=[
    {cardNum:'101',name:'Old Alpha A',parallel:'Base',price:1.00,marketPrice:1.00,condition:'NM'},
    {cardNum:'101',name:'Old Alpha B',parallel:'Base',price:0.50,marketPrice:0.50,condition:'NM'},
    {cardNum:'102',name:'Old Beta A',parallel:'Base',price:2.00,marketPrice:2.00,condition:'NM'},
    {cardNum:'102',name:'Old Beta B',parallel:'Base',price:0.75,marketPrice:0.75,condition:'NM'},
    {cardNum:'201',name:'Pack Dup One',parallel:'Base',price:1.25,marketPrice:1.25,condition:'NM',acquiredBatchId:'batch-latest',acquiredIsDuplicate:true},
    {cardNum:'202',name:'Pack Dup Two',parallel:'Base',price:1.50,marketPrice:1.50,condition:'NM',acquiredBatchId:'batch-latest',acquiredIsDuplicate:true},
    {cardNum:'203',name:'Pack Unique',parallel:'Base',price:3.00,marketPrice:3.00,condition:'NM',acquiredBatchId:'batch-latest',acquiredIsDuplicate:false},
  ];
  seedCollection(tmpRoot,setKey,{
    cards,
    pulls:{101:2,102:2,201:1,202:1,203:1},
    wallet:10,
  });
  const colPath=path.join(tmpRoot,'data','collections',`${setKey}.json`);
  const col=readJson(colPath);
  col.lastAcquisitionBatch={id:'batch-latest',opType:'open-pack',packType:'retail',packIndex:1,openedAt:new Date().toISOString(),duplicateCount:2,newCount:1,cardCount:3};
  writeJson(colPath,col);

  const output=runCardEngine(tmpRoot,['sell','dups','--pack']);
  const after=readJson(colPath);

  assert.deepStrictEqual(after.cards.map(c=>c.cardNum),['101','101','102','102','203'],`unexpected cards left after pack sell dups:\n${output}`);
  assertCounts(after.cards,{101:2,102:2,203:1});
  assert.strictEqual(after.stats.total,5);
  assert.strictEqual(cents(after.stats.value),cents(sumCardValue(after.cards)));
  assert.strictEqual(cents(after.wallet),1275);
  assert.strictEqual(after.pulls['101'],2);
  assert.strictEqual(after.pulls['102'],2);
  assert.strictEqual(after.pulls['201'],undefined);
  assert.strictEqual(after.pulls['202'],undefined);
  assert.strictEqual(after.pulls['203'],1);
}

function scenarioSingleSell(){
  const {tmpRoot,setKey}=prepareRepo();
  const cards=[
    {cardNum:'201',name:'Single Alpha',parallel:'Base',price:1.50,marketPrice:1.50,condition:'NM'},
    {cardNum:'201',name:'Single Alpha Dup',parallel:'Base',price:0.40,marketPrice:0.40,condition:'NM'},
    {cardNum:'202',name:'Solo Beta',parallel:'Base',price:2.25,marketPrice:2.25,condition:'NM'},
  ];
  seedCollection(tmpRoot,setKey,{
    cards,
    pulls:{201:2,202:1},
    wallet:10,
  });

  const output=runCardEngine(tmpRoot,['sell','201']);
  const after=readJson(path.join(tmpRoot,'data','collections',`${setKey}.json`));

  assert.deepStrictEqual(after.cards.map(c=>c.cardNum),['201','202'],`unexpected cards left after sell 201:\n${output}`);
  assertCounts(after.cards,{201:1,202:1});
  assert.strictEqual(after.stats.total,2);
  assert.strictEqual(cents(after.stats.value),cents(sumCardValue(after.cards)));
  assert.strictEqual(cents(after.wallet),1040);
  assert.strictEqual(after.pulls['201'],1);
  assert.strictEqual(after.pulls['202'],1);
  assert.strictEqual(after.cards.find(c=>c.cardNum==='201').price,1.50);
}

function scenarioSellListInstant(){
  const {tmpRoot,setKey}=prepareRepo();
  const cards=[
    {cardNum:'301',name:'Listing Target',parallel:'Base',price:2.00,marketPrice:2.00,condition:'NM',basePrice:2.00},
  ];
  seedCollection(tmpRoot,setKey,{
    cards,
    pulls:{301:1},
    wallet:10,
  });

  const output=runCardEngine(tmpRoot,['sell-list','instant','301']);
  const after=readJson(path.join(tmpRoot,'data','collections',`${setKey}.json`));

  assert.deepStrictEqual(after.cards,[],`unexpected cards left after sell-list instant:\n${output}`);
  assert.strictEqual(after.stats.total,0);
  assert.strictEqual(cents(after.stats.value),0);
  assert.strictEqual(cents(after.wallet),1180);
  assert.strictEqual(after.pulls['301'],undefined);
}

scenarioBulkDuplicates();
scenarioPackScopedDuplicates();
scenarioSingleSell();
scenarioSellListInstant();

console.log('sell regression suite passed');
