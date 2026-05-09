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

function prepareRepo(){
  const repoRoot=path.resolve(__dirname,'..');
  const tmpRoot=fs.mkdtempSync(path.join(os.tmpdir(),'trading-cards-missing-set-'));
  fs.cpSync(repoRoot,tmpRoot,{recursive:true});
  return tmpRoot;
}

function runCardEngine(tmpRoot,args){
  return execFileSync('node',['scripts/card-engine.js',...args],{
    cwd:tmpRoot,
    encoding:'utf8',
    env:process.env,
  });
}

function scenarioMissingActiveSetDoesNotCreateState(){
  const tmpRoot=prepareRepo();
  const cfgPath=path.join(tmpRoot,'data','config.json');
  const cfg=readJson(cfgPath);
  cfg.activeSet='ZZZ-2099';
  writeJson(cfgPath,cfg);

  const setPath=path.join(tmpRoot,'data','sets','ZZZ-2099.json');
  const colPath=path.join(tmpRoot,'data','collections','ZZZ-2099.json');

  const output=runCardEngine(tmpRoot,['open-pack','retail']);

  assert.match(output,/No active set/i);
  assert.strictEqual(fs.existsSync(setPath),false,'open-pack should not create a missing set');
  assert.strictEqual(fs.existsSync(colPath),false,'open-pack should not create a missing collection');
}

function scenarioExplicitGenerationStillCreatesCollection(){
  const tmpRoot=prepareRepo();
  const output=runCardEngine(tmpRoot,['generate-set','--category','character','--seed','12345']);

  const cfgPath=path.join(tmpRoot,'data','config.json');
  const cfg=readJson(cfgPath);
  assert.ok(cfg.activeSet,'generate-set should activate a set');

  const setPath=path.join(tmpRoot,'data','sets',`${cfg.activeSet}.json`);
  const colPath=path.join(tmpRoot,'data','collections',`${cfg.activeSet}.json`);
  assert.strictEqual(fs.existsSync(setPath),true,'generate-set should create the set file');
  assert.strictEqual(fs.existsSync(colPath),true,'generate-set should create the collection file');

  const col=readJson(colPath);
  assert.strictEqual(col.setKey,cfg.activeSet);
  assert.deepStrictEqual(col.cards,[]);
  assert.strictEqual(col.wallet,cfg.wallet);
  assert.match(output,/NEW SET GENERATED/i);
}

scenarioMissingActiveSetDoesNotCreateState();
scenarioExplicitGenerationStillCreatesCollection();

console.log('missing-set regression suite passed');
