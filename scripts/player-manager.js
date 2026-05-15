#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {execSync,execFileSync}=require('child_process');
const {createTradingLogger,summarize:logSummarize}=require('./trading-logger.js');
const {applyStipendSweep,resolvePlayerId:resolveSweepPlayerId,resolveDefaultStipendAmount}=require('./stipend-sweeper.js');

// ─── CONFIG ──────────────────────────────────────────────────
const BASE_DIR=process.env.TRADING_CARDS_DATA_DIR?path.resolve(process.env.TRADING_CARDS_DATA_DIR):path.join(__dirname,'..','data');
const PLAYERS_FILE=path.join(BASE_DIR,'players.json');
const TRADES_FILE=path.join(BASE_DIR,'trades.json');
const PLAYERS_DIR=path.join(BASE_DIR,'players');
const SHARED_DATA=['sets','flopps','flopps-state.json','market-macro.json','scalpers','npcs','stores','store-reviews','grading-population.json'];
const DEFAULT_PLAYER_ID='player1';
const DEFAULT_PLAYER_PROFILE={
  name:'player1',
  displayName:'Player One',
  aliases:['player1','playerone'],
  createdAt:Date.now(),
};
const KNOWN_PLAYER_ALIASES={
  default:DEFAULT_PLAYER_ID,
  player1:DEFAULT_PLAYER_ID,
  playerone:DEFAULT_PLAYER_ID,
  player2:'player2',
};

// ─── HELPERS ──────────────────────────────────────────────────
function rJ(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function wJ(p,d){
  fs.mkdirSync(path.dirname(p),{recursive:true});
  const tmp=`${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp,JSON.stringify(d,null,2));
  fs.renameSync(tmp,p);
  LOG?.debug('write',{path:p,data:logSummarize(d)});
}
function fm$(v){return'$'+v.toFixed(2)}
let LOG=null;
function normalizeKey(name){
  return String(name||'').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g,'_').replace(/^_+|_+$/g,'');
}
function normalizePlayerRecord(id,player={}){
  const canonicalId=normalizeKey(id);
  const aliases=new Set([canonicalId]);
  for(const alias of player.aliases||[]) aliases.add(normalizeKey(alias));
  if(player.displayName) aliases.add(normalizeKey(player.displayName));
  if(canonicalId===DEFAULT_PLAYER_ID){
    aliases.add('apo');
    aliases.add('apostol');
    aliases.add('apostolov');
  }
  return{
    ...player,
    name:canonicalId||player.name||id,
    displayName:player.displayName||canonicalId||id,
    aliases:[...aliases].filter(Boolean),
  };
}
function mergePlayerRecord(base,extra){
  const merged={...base,...extra};
  merged.aliases=[...(base.aliases||[]),...(extra.aliases||[])];
  merged.aliases=[...new Set(merged.aliases.map(normalizeKey).filter(Boolean))];
  merged.name=base.name||extra.name;
  merged.displayName=base.displayName||extra.displayName||merged.name;
  return merged;
}
function resolvePlayerId(input,reg=loadPlayers()){
  const key=normalizeKey(input);
  if(!key) return null;
  const mapped=KNOWN_PLAYER_ALIASES[key]||key;
  if(reg.players?.[mapped]) return mapped;
  for(const [id,player] of Object.entries(reg.players||{})){
    if(id===mapped) return id;
    const aliases=new Set([normalizeKey(id),...(player.aliases||[]).map(normalizeKey),normalizeKey(player.displayName)]);
    if(aliases.has(key)||aliases.has(mapped)) return id;
  }
  return null;
}
function getPlayerRecord(input,reg=loadPlayers()){
  const id=resolvePlayerId(input,reg);
  if(!id) return null;
  return {id,player:reg.players[id]};
}
function ensurePlayerEntry(reg,id,defaults={}){
  const canonical=normalizeKey(id);
  const existing=reg.players[canonical]||{};
  const next=normalizePlayerRecord(canonical,mergePlayerRecord({...defaults,name:canonical},{...existing}));
  reg.players[canonical]=next;
  return next;
}
function moveDirContents(srcDir,dstDir){
  if(!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir,{recursive:true});
  for(const entry of fs.readdirSync(srcDir)){
    const src=path.join(srcDir,entry);
    const dst=path.join(dstDir,entry);
    if(fs.existsSync(dst)) continue;
    fs.renameSync(src,dst);
  }
}

// ─── DAILY STIPEND ────────────────────────────────────────────
const STIPEND_AMOUNT=5;
const STIPEND_TIME_ZONE='Europe/Sofia';
function checkStipend(playerName){
  const sweep=applyStipendSweep({dataDir:BASE_DIR,playerId:playerName,amount:null,timeZone:STIPEND_TIME_ZONE});
  return sweep.grants[0]||null;
}
// Returns the stipend grant for one player, or null if they are already caught up.
// Usage: node player-manager.js stipend <player>
function cmdCheckStipend(playerName){
  if(!playerName){console.log('Usage: player-manager stipend <player>');return}
  const reg=loadPlayers();
  const id=resolveSweepPlayerId(playerName,reg)||normalizeKey(playerName);
  const grant=checkStipend(id);
  if(grant)console.log(`  💰 Daily stipend: +$${grant.amount.toFixed(2)} (${grant.days} day${grant.days===1?'':'s'}) for ${reg.players[id]?.displayName||id}`);
  else console.log(`  ✅ No stipend needed (already caught up)`);
}
// Check stipend for ALL registered players
function cmdStipendAll(){
  const reg=loadPlayers();
  const sweep=applyStipendSweep({dataDir:BASE_DIR,amount:null,timeZone:STIPEND_TIME_ZONE});
  for(const grant of sweep.grants){
    console.log(`  💰 +$${grant.amount.toFixed(2)} (${grant.days} day${grant.days===1?'':'s'} @ $${grant.stipendAmount.toFixed(2)}/day) → ${reg.players[grant.playerId]?.displayName||grant.playerId}`);
  }
  if(sweep.total===0)console.log('  ✅ All players are already caught up.');
  else console.log(`  📊 Total stipends given: $${sweep.total.toFixed(2)}`);
}

function cmdStipendDefault(amountArg){
  const reg=loadPlayers();
  if(typeof amountArg==='undefined'){
    const amount=resolveDefaultStipendAmount(reg,STIPEND_AMOUNT);
    console.log(`  💰 Default stipend: $${amount.toFixed(2)}/day`);
    return;
  }
  const amount=parseFloat(amountArg);
  if(!Number.isFinite(amount)||amount<=0){
    console.log('Usage: player-manager stipend default <amount>');
    return;
  }
  reg.defaultStipendAmount=amount;
  savePlayers(reg);
  console.log(`  ✅ Default stipend set to $${amount.toFixed(2)}/day`);
}

function cmdStipendSet(playerName,amountArg){
  if(!playerName||typeof amountArg==='undefined'){
    console.log('Usage: player-manager stipend set <player> <amount>');
    return;
  }
  const reg=loadPlayers();
  const id=resolveSweepPlayerId(playerName,reg);
  if(!id){
    console.log(`  ⚠ Player "${playerName}" not found.`);
    return;
  }
  const amount=parseFloat(amountArg);
  if(!Number.isFinite(amount)||amount<=0){
    console.log('Usage: player-manager stipend set <player> <amount>');
    return;
  }
  reg.players[id].stipendAmount=amount;
  savePlayers(reg);
  console.log(`  ✅ ${reg.players[id].displayName||id} stipend override set to $${amount.toFixed(2)}/day`);
}

function cmdStipendClear(playerName){
  if(!playerName){
    console.log('Usage: player-manager stipend clear <player>');
    return;
  }
  const reg=loadPlayers();
  const id=resolveSweepPlayerId(playerName,reg);
  if(!id){
    console.log(`  ⚠ Player "${playerName}" not found.`);
    return;
  }
  if(reg.players[id]&&Object.prototype.hasOwnProperty.call(reg.players[id],'stipendAmount')){
    delete reg.players[id].stipendAmount;
    savePlayers(reg);
    console.log(`  ✅ Cleared stipend override for ${reg.players[id].displayName||id}`);
  } else {
    console.log(`  ✅ ${reg.players[id].displayName||id} already uses the default stipend.`);
  }
}

// ─── PLAYER REGISTRY ──────────────────────────────────────────
function loadPlayers(){
  let p=rJ(PLAYERS_FILE);
  if(!p)p={activePlayer:DEFAULT_PLAYER_ID,players:{}};
  if(!p.players)p.players={};
  let dirty=false;
  for(const [id,player] of Object.entries(p.players)){
    const normalized=normalizePlayerRecord(id,player);
    if(JSON.stringify(normalized)!==JSON.stringify(player)) dirty=true;
    p.players[id]=normalized;
  }
  // Ensure default player exists
  if(!p.players[DEFAULT_PLAYER_ID]){
    p.players[DEFAULT_PLAYER_ID]=normalizePlayerRecord(DEFAULT_PLAYER_ID,DEFAULT_PLAYER_PROFILE);
    dirty=true;
  }
  // Ensure player2 exists (for demos/multiplayer)
  if(!p.players.player2){
    p.players.player2=normalizePlayerRecord('player2',{name:'player2',displayName:'Player Two',aliases:['player2'],createdAt:Date.now()});
    dirty=true;
  }
  const nextActive=resolvePlayerId(p.activePlayer,p)||DEFAULT_PLAYER_ID;
  if(p.activePlayer!==nextActive){
    p.activePlayer=nextActive;
    dirty=true;
  }
  if(dirty) savePlayers(p);
  return p;
}
function savePlayers(p){wJ(PLAYERS_FILE,p)}

// ─── DATA DIR PER PLAYER ─────────────────────────────────────
function playerDir(name){
  if(!name)return null;
  // Sanitize: lowercase, strip special chars
  const safe=normalizeKey(name);
  return path.join(PLAYERS_DIR,safe);
}

// ─── MIGRATE OLD DATA ─────────────────────────────────────────
function migrateIfNeeded(){
  const reg=loadPlayers();
  const defaultPlayerDir=playerDir(DEFAULT_PLAYER_ID);

  // Fresh install — create default player
  if(!fs.existsSync(path.join(defaultPlayerDir,'config.json'))){
    if(!reg.players[DEFAULT_PLAYER_ID]){
      reg.players[DEFAULT_PLAYER_ID]=normalizePlayerRecord(DEFAULT_PLAYER_ID,DEFAULT_PLAYER_PROFILE);
      reg.activePlayer=DEFAULT_PLAYER_ID;
      savePlayers(reg);
    }
    ensurePlayerDir(defaultPlayerDir,DEFAULT_PLAYER_ID);
    return;
  }

  // Already set up
  if(reg.players[DEFAULT_PLAYER_ID]){
    if(!reg.activePlayer||!reg.players[reg.activePlayer]) reg.activePlayer=DEFAULT_PLAYER_ID;
    savePlayers(reg);
  }
}

function linkSharedData(playerDirPath){
  // Symlink shared read-only data (sets, flopps, etc.) into player dir
  for(const item of SHARED_DATA){
    const src=path.join(BASE_DIR,item);
    const dst=path.join(playerDirPath,item);
    if(fs.existsSync(src)&&!fs.existsSync(dst)){
      fs.symlinkSync(src,dst);
    }
  }
}
function createFreshPlayer(name){
  const dir=playerDir(name);
  fs.mkdirSync(path.join(dir,'collections'),{recursive:true});
  fs.mkdirSync(path.join(dir,'checklists'),{recursive:true});
  fs.mkdirSync(path.join(dir,'grading'),{recursive:true});
  fs.mkdirSync(path.join(dir,'marketplace'),{recursive:true});
  wJ(path.join(dir,'config.json'),{wallet:50,activeSet:null,archivedSets:[],mode:'virtual',pocketMoney:5});
  fs.writeFileSync(path.join(dir,'history.jsonl'),'');
  LOG?.debug('create-history',{playerId:normalizeKey(name),path:path.join(dir,'history.jsonl')});
  linkSharedData(dir);
}

// ─── REGISTER ─────────────────────────────────────────────────
function cmdRegister(name,displayName){
  if(!name){console.log('Usage: player-manager register <name> [display-name]');return}
  const reg=loadPlayers();
  const safeName=normalizeKey(name);
  const existingId=resolvePlayerId(safeName,reg);
  if(existingId){
    console.log(`  ⚠ Player "${safeName}" already exists as ${existingId}.`);
    return;
  }

  const dir=playerDir(safeName);
  fs.mkdirSync(path.join(dir,'collections'),{recursive:true});
  fs.mkdirSync(path.join(dir,'checklists'),{recursive:true});
  fs.mkdirSync(path.join(dir,'grading'),{recursive:true});
  fs.mkdirSync(path.join(dir,'marketplace'),{recursive:true});

  // Create config with starting wallet
  wJ(path.join(dir,'config.json'),{wallet:5,activeSet:null,archivedSets:[],mode:'virtual',pocketMoney:5});
  fs.writeFileSync(path.join(dir,'history.jsonl'),'');
  LOG?.debug('create-history',{playerId:safeName,path:path.join(dir,'history.jsonl')});

  // Copy active set from main user if exists
  const mainCfg=rJ(path.join(playerDir(DEFAULT_PLAYER_ID),'config.json'));
  if(mainCfg&&mainCfg.activeSet){
    const cfg=rJ(path.join(dir,'config.json'));
    cfg.activeSet=mainCfg.activeSet;
    wJ(path.join(dir,'config.json'),cfg);
    // Copy set's checklist
    const mainChecklist=path.join(playerDir(DEFAULT_PLAYER_ID),'checklists',mainCfg.activeSet+'.json');
    if(fs.existsSync(mainChecklist)){
      fs.copyFileSync(mainChecklist,path.join(dir,'checklists',mainCfg.activeSet+'.json'));
    }
  }

  reg.players[safeName]={name:safeName,displayName:displayName||name,aliases:[safeName,normalizeKey(displayName||name)],createdAt:Date.now()};
  if(!reg.activePlayer)reg.activePlayer=safeName;
  savePlayers(reg);
  linkSharedData(dir);

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🎮 PLAYER REGISTERED`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  Name: ${displayName||name} (${safeName})`);
  console.log(`  Wallet: $5.00`);
  console.log(`  Cards: 0`);
  console.log(`${'═'.repeat(52)}\n`);
}

// ─── SWITCH PLAYER ────────────────────────────────────────────
function cmdSwitch(name){
  if(!name){console.log('Usage: player-manager player <name>');return}
  const reg=loadPlayers();
  const safeName=resolvePlayerId(name,reg);
  if(!safeName){console.log(`  ⚠ Player "${name}" not found. Use 'register' first.`);return}
  reg.activePlayer=safeName;
  savePlayers(reg);
  console.log(`  ✅ Switched to player: ${reg.players[safeName].displayName} (${safeName})`);
}

// ─── SET ANNOUNCEMENT ────────────────────────────────────────
function cmdAnnounceSet(setRef){
  if(!setRef){console.log('Usage: player-manager announce-set <setCode>');return}
  const reg=loadPlayers();
  const playerIds=Object.keys(reg.players||{});
  if(!playerIds.length){console.log('  No players registered.');return}

  const setDir=path.join(BASE_DIR,'sets');
  const candidate=setRef.endsWith('.json')
    ? path.join(setDir,setRef)
    : path.join(setDir,setRef+'.json');
  const setPath=fs.existsSync(candidate)?candidate:null;
  if(!setPath){console.log(`  \u26A0 Set "${setRef}" not found in ${setDir}`);return}
  const set=rJ(setPath);
  if(!set){console.log(`  \u26A0 Could not read set at ${setPath}`);return}

  const setName=set.officialName||set.name||setRef;
  const setCode=set.code||setRef;
  const year=set.year||'';
  const cards=set.cards?.length||0;
  const category=set.setCategory||set.category||'';
  const fullCode=setCode+(year?`-${year}`:'');

  const mentions=playerIds.map(id=>`@${reg.players[id]?.displayName||id}`).join(' ');

  console.log(`\n${'\u2500'.repeat(55)}`);
  console.log(`  \uD83D\uDCE2 NEW SET ANNOUNCEMENT`);
  console.log(`${'\u2500'.repeat(55)}`);
  console.log(`  ${setName}`);
  console.log(`  Code: ${fullCode}${category?`  |  ${category}`:''}`);
  console.log(`  Cards: ${cards}`);
  console.log(``);
  console.log(`  ${mentions} — a new set has landed! Time to rip some packs.`);
  console.log(`${'\u2500'.repeat(55)}`);
  console.log(`  Open packs: node card-engine.js open-box hobby\n`);
}

// ─── LIST PLAYERS ─────────────────────────────────────────────
function cmdListPlayers(){
  const reg=loadPlayers();
  const entries=Object.entries(reg.players);
  if(!entries.length){console.log('  No players registered yet.');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🎮 PLAYERS (${entries.length})`);
  console.log(`${'═'.repeat(52)}`);
  for(const[safe,p] of entries){
    const cfg=rJ(path.join(playerDir(safe),'config.json'));
    const colDir=path.join(playerDir(safe),'collections');
    let cardCount=0;
    if(fs.existsSync(colDir)){
      for(const f of fs.readdirSync(colDir)){
        if(f.endsWith('.json')){
          const col=rJ(path.join(colDir,f));
          if(col&&col.cards)cardCount+=col.cards.length;
        }
      }
    }
    const active=safe===reg.activePlayer?' 👈 ACTIVE':'';
    console.log(`  ${active?'👉':'  '} ${p.displayName} (${safe}) — Wallet: ${fm$(cfg?.wallet||0)} | Cards: ${cardCount}${active}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

// ─── PLAYER WALLET/COLLECTION QUICK LOOK ──────────────────────
function cmdMe(){
  const reg=loadPlayers();
  if(!reg.activePlayer){console.log('  No active player.');return}
  const player=reg.players[reg.activePlayer];
  console.log(`  👤 Active: ${player?.displayName||reg.activePlayer} (${reg.activePlayer})`);
}

// ─── TRADE SYSTEM ──────────────────────────────────────────────
function loadTrades(){
  let t=rJ(TRADES_FILE);
  if(!t)t={nextId:1,trades:[]};
  if(!t.trades)t.trades=[];
  if(!t.nextId)t.nextId=1;
  return t;
}
function saveTrades(t){wJ(TRADES_FILE,t)}

function findCardInPlayer(playerName,cardNum){
  const reg=loadPlayers();
  const resolved=resolvePlayerId(playerName,reg)||normalizeKey(playerName);
  const colDir=path.join(playerDir(resolved),'collections');
  if(!fs.existsSync(colDir))return null;
  for(const f of fs.readdirSync(colDir)){
    if(!f.endsWith('.json'))continue;
    const col=rJ(path.join(colDir,f));
    if(!col||!col.cards)continue;
    const card=col.cards.find(c=>c.cardNum===parseInt(cardNum)||c.cardNum===cardNum);
    if(card)return{collection:col,file:path.join(colDir,f),card};
  }
  return null;
}

function cmdTradeOffer(args){
  // trade offer <other_player> <my_card_num> for <their_card_num>
  const fromIdx=args.indexOf('for');
  if(fromIdx===-1||args.length<3){
    console.log('Usage: player-manager trade offer <player> <my_card#> for <their_card#>');
    return;
  }
  const reg=loadPlayers();
  const otherPlayer=resolvePlayerId(args[0],reg);
  const myCard=args[1];
  const theirCard=args[fromIdx+1];
  const active=reg.activePlayer;

  if(!active){console.log('  ⚠ No active player.');return}
  if(!otherPlayer){console.log(`  ⚠ Player "${args[0]}" not found.`);return}
  if(active===otherPlayer){console.log('  ⚠ Cannot trade with yourself!');return}

  const myFind=findCardInPlayer(active,myCard);
  const theirFind=findCardInPlayer(otherPlayer,theirCard);

  if(!myFind){console.log(`  ⚠ Card #${myCard} not found in your collection.`);return}
  if(!theirFind){console.log(`  ⚠ Card #${theirCard} not found in ${reg.players[otherPlayer].displayName}'s collection.`);return}

  const trades=loadTrades();
  const trade={
    id:String(trades.nextId++),
    from:active,
    to:otherPlayer,
    fromCard:myCard,
    toCard:theirCard,
    fromCardName:myFind.card.name||`#${myFind.card.cardNum}`,
    toCardName:theirFind.card.name||`#${theirFind.card.cardNum}`,
    status:'pending',
    createdAt:Date.now()
  };
  trades.trades.push(trade);
  saveTrades(trades);

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🤝 TRADE OFFERED #${trade.id}`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  ${reg.players[active].displayName} offers:`);
  console.log(`    → #${myCard} ${trade.fromCardName}`);
  console.log(`  ${reg.players[otherPlayer].displayName} offers:`);
  console.log(`    → #${theirCard} ${trade.toCardName}`);
  console.log(`  Status: Pending ${reg.players[otherPlayer].displayName}'s acceptance`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeAccept(tradeId){
  const trades=loadTrades();
  const trade=trades.trades.find(t=>t.id===tradeId&&t.status==='pending');
  if(!trade){console.log(`  ⚠ Trade #${tradeId} not found or not pending.`);return}
  const reg=loadPlayers();
  const active=reg.activePlayer;

  // Verify the active player is the recipient
  if(trade.to!==active&&trade.from!==active){
    console.log(`  ⚠ This trade is not for you.`);return;
  }
  if(trade.to!==active){
    console.log(`  ⚠ Waiting for ${reg.players[trade.to].displayName} to accept.`);return;
  }

  // Verify both cards still exist
  const fromFind=findCardInPlayer(trade.from,trade.fromCard);
  const toFind=findCardInPlayer(trade.to,trade.toCard);
  if(!fromFind){console.log(`  ⚠ Card #${trade.fromCard} no longer in ${reg.players[trade.from].displayName}'s collection. Trade cancelled.`);trade.status='cancelled';saveTrades(trades);return}
  if(!toFind){console.log(`  ⚠ Card #${trade.toCard} no longer in your collection. Trade cancelled.`);trade.status='cancelled';saveTrades(trades);return}

  // Execute swap
  const fromCard=fromFind.card;
  const toCard=toFind.card;

  // Remove from source collections
  const fromIdx=fromFind.collection.cards.indexOf(fromCard);
  if(fromIdx>-1)fromFind.collection.cards.splice(fromIdx,1);
  wJ(fromFind.file,fromFind.collection);

  const toIdx=toFind.collection.cards.indexOf(toCard);
  if(toIdx>-1)toFind.collection.cards.splice(toIdx,1);
  wJ(toFind.file,toFind.collection);

  // Add to destination collections
  fromFind.collection.cards.push(toCard);
  wJ(fromFind.file,fromFind.collection);

  toFind.collection.cards.push(fromCard);
  wJ(toFind.file,toFind.collection);

  trade.status='completed';
  trade.completedAt=Date.now();
  saveTrades(trades);

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  ✅ TRADE #${trade.id} COMPLETED`);
  console.log(`${'═'.repeat(52)}`);
  console.log(`  ${reg.players[trade.from].displayName} received: #${trade.toCard} ${trade.toCardName}`);
  console.log(`  ${reg.players[trade.to].displayName} received: #${trade.fromCard} ${trade.fromCardName}`);
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeReject(tradeId){
  const trades=loadTrades();
  const trade=trades.trades.find(t=>t.id===tradeId&&t.status==='pending');
  if(!trade){console.log(`  ⚠ Trade #${tradeId} not found or not pending.`);return}
  trade.status='rejected';
  trade.rejectedAt=Date.now();
  saveTrades(trades);
  console.log(`  ❌ Trade #${tradeId} rejected.`);
}

function cmdTradePending(){
  const trades=loadTrades();
  const reg=loadPlayers();
  const active=reg.activePlayer;
  const pending=trades.trades.filter(t=>t.status==='pending'&&(t.from===active||t.to===active));
  if(!pending.length){console.log('  No pending trades.');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🤝 PENDING TRADES`);
  console.log(`${'═'.repeat(52)}`);
  for(const t of pending){
    const direction=t.from===active?'→':'←';
    const action=t.to===active?'(accept/reject)':'(waiting)';
    console.log(`  #${t.id} ${direction} ${reg.players[t.from===active?t.to:t.from].displayName}: #${t.fromCard} ${t.fromCardName} for #${t.toCard} ${t.toCardName} ${action}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeHistory(){
  const trades=loadTrades();
  const reg=loadPlayers();
  const active=reg.activePlayer;
  const history=trades.trades.filter(t=>(t.from===active||t.to===active)&&t.status!=='pending');
  if(!history.length){console.log('  No trade history.');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📜 TRADE HISTORY`);
  console.log(`${'═'.repeat(52)}`);
  for(const t of history){
    const status=t.status==='completed'?'✅':'❌';
    console.log(`  ${status} #${t.id} ${reg.players[t.from].displayName} ↔ ${reg.players[t.to].displayName}: #${t.fromCard} for #${t.toCard}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdTradeBrowse(playerName){
  if(!playerName){console.log('Usage: player-manager trade list <player>');return}
  const reg=loadPlayers();
  const safeName=resolvePlayerId(playerName,reg);
  if(!safeName){console.log(`  ⚠ Player "${playerName}" not found.`);return}
  const colDir=path.join(playerDir(safeName),'collections');
  if(!fs.existsSync(colDir)){console.log('  No collection found.');return}
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📋 ${reg.players[safeName].displayName}'s COLLECTION`);
  console.log(`${'═'.repeat(52)}`);
  for(const f of fs.readdirSync(colDir)){
    if(!f.endsWith('.json'))continue;
    const col=rJ(path.join(colDir,f));
    if(!col||!col.cards)continue;
    // Deduplicate by card num, show best copy
    const byNum={};
    for(const c of col.cards){
      const num=c.cardNum;
      if(!byNum[num]||(c.parallel!=='Base'&&byNum[num].parallel==='Base')||(c.isHit&&!byNum[num].isHit)){
        byNum[num]=c;
      }
    }
    const sorted=Object.values(byNum).sort((a,b)=>a.cardNum-b.cardNum);
    for(const c of sorted){
      const star=c.isHit?'⭐':c.serialNumber?'🔢':'';
      const parallel=c.parallel!=='Base'?` ${c.parallel}`:'';
      console.log(`    #${String(c.cardNum).padStart(3)} ${c.name}${parallel} ${star}`);
    }
  }
  console.log(`${'═'.repeat(52)}\n`);
}

function cmdGift(fromPlayer, toPlayer, cardNumStr){
  const reg=loadPlayers();
  const from=resolvePlayerId(fromPlayer,reg);
  const to=resolvePlayerId(toPlayer,reg);
  if(!from){console.log(`  ⚠ Player "${fromPlayer}" not found.`);return}
  if(!to){console.log(`  ⚠ Player "${toPlayer}" not found.`);return}
  if(from===to){console.log(`  ⚠ Cannot gift to yourself.`);return}
  const cardNum=parseInt(cardNumStr);
  if(isNaN(cardNum)){console.log('  ⚠ Invalid card number.');return}

  // Find the card (prefer dupes, keep first copy)
  const fromDir=playerDir(from);
  const colDir=path.join(fromDir,'collections');
  let giftCard=null,giftCol=null,giftFile=null;
  if(fs.existsSync(colDir)){
    for(const f of fs.readdirSync(colDir)){
      if(!f.endsWith('.json'))continue;
      const col=rJ(path.join(colDir,f));
      if(!col||!col.cards)continue;
      const matches=col.cards.filter(c=>String(c.cardNum)===String(cardNum).padStart(3,'0'));
  if(!matches.length)matches.push(...col.cards.filter(c=>String(c.cardNum)===String(cardNum)));
      if(!matches.length)continue;
      // If multiple copies, gift the cheapest/dup; otherwise gift the only copy
      if(matches.length>1){
        matches.sort((a,b)=>a.price-b.price);
        giftCard=matches[0];giftCol=col;giftFile=path.join(colDir,f);
      }else if(!giftCard){
        giftCard=matches[0];giftCol=col;giftFile=path.join(colDir,f);
      }
    }
  }
  if(!giftCard){console.log(`  ⚠ Card #${cardNum} not found in ${reg.players[from].displayName}'s collection.`);return}

  // Remove from source
  const idx=giftCol.cards.indexOf(giftCard);
  giftCol.cards.splice(idx,1);
  wJ(giftFile,giftCol);

  // Add to target (create collection if needed)
  const toColDir=path.join(playerDir(to),'collections');
  fs.mkdirSync(toColDir,{recursive:true});
  let toColFile=path.join(toColDir,giftCard.setKey+'.json');
  let toCol=rJ(toColFile);
  if(!toCol){
    toCol={setKey:giftCard.setKey,cards:[],pulls:{},stats:{total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0},bestPull:null,parallelCounts:{},wallet:0,sealedInventory:{}};
  }
  giftCard.acquired=new Date().toISOString();
  giftCard.source=`gift from ${reg.players[from].displayName}`;
  toCol.cards.push(giftCard);
  wJ(toColFile,toCol);

  // Sync wallet from config
  const toCfg=rJ(path.join(playerDir(to),'config.json'));
  if(toCfg){toCol.wallet=toCfg.wallet;wJ(toColFile,toCol)}

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  🎁 GIFTED: #${giftCard.cardNum} ${giftCard.name}${giftCard.parallel&&giftCard.parallel!=='Base'?' '+giftCard.parallel:''}`);
  console.log(`  ${reg.players[from].displayName} → ${reg.players[to].displayName}`);
  console.log(`${'═'.repeat(52)}\n`);
}

// ─── MAIN ─────────────────────────────────────────────────────
const args=process.argv.slice(2);
const cmd=args[0];

// Auto-migrate on any command
LOG=createTradingLogger({script:'player-manager',argv:args,verbose:args.includes('--verbose')||process.env.TRADING_CARDS_VERBOSE==='1',dataDir:BASE_DIR});
LOG.log('process.start',{command:cmd||null,dataDir:BASE_DIR});
process.on('uncaughtException',err=>{LOG?.error('uncaught-exception',{error:err});throw err;});
process.on('unhandledRejection',err=>{LOG?.error('unhandled-rejection',{error:err});});
migrateIfNeeded();
if(cmd&&cmd!=='stipend'&&cmd!=='migrate'){
  applyStipendSweep({dataDir:BASE_DIR,amount:null,timeZone:STIPEND_TIME_ZONE});
}

switch(cmd){
  case 'register':
    cmdRegister(args[1],args[2]);
    break;
  case 'stipend':
    if(args[1]==='all')cmdStipendAll();
    else if(args[1]==='default')cmdStipendDefault(args[2]);
    else if(args[1]==='set')cmdStipendSet(args[2],args[3]);
    else if(args[1]==='clear')cmdStipendClear(args[2]);
    else cmdCheckStipend(args[1]);
    break;
  case 'player':
  case 'switch':
    cmdSwitch(args[1]);
    break;
  case 'players':
  case 'list':
    cmdListPlayers();
    break;
  case 'announce-set':
    cmdAnnounceSet(args[1]);
    break;
  case 'me':
    cmdMe();
    break;
  case 'trade':
    switch(args[1]){
      case 'offer':cmdTradeOffer(args.slice(2));break;
      case 'accept':cmdTradeAccept(args[2]);break;
      case 'reject':cmdTradeReject(args[2]);break;
      case 'pending':cmdTradePending();break;
      case 'history':cmdTradeHistory();break;
      case 'list':case'browse':cmdTradeBrowse(args[2]);break;
      default:
        console.log('Usage: player-manager trade <offer|accept|reject|pending|history|list>');
    }
    break;
  case 'dir':
    // Internal: return the active player's data dir for shell integration
    const r=loadPlayers();
    if(r.activePlayer)console.log(playerDir(r.activePlayer));
    else console.log(BASE_DIR);
    break;
  case 'active':
    const r2=loadPlayers();
    console.log(r2.activePlayer||'none');
    break;
  case 'set-money':
    // player-manager set-money <player> <amount> — admin
    const pName=resolvePlayerId(args[1],loadPlayers())||normalizeKey(args[1]);
    const amount=parseFloat(args[2]);
    if(!pName||isNaN(amount)){console.log('Usage: player-manager set-money <player> <amount>');break}
    const cfgPath=path.join(playerDir(pName),'config.json');
    const cfg=rJ(cfgPath);
    if(!cfg){console.log(`  ⚠ Player "${pName}" not found.`);break}
    cfg.wallet=amount;
    wJ(cfgPath,cfg);
    console.log(`  💰 ${pName}'s wallet set to ${fm$(amount)}`);
    break;
  case 'gift':
    if(args.length<4){console.log('Usage: player-manager gift <from> <to> <card#>');break}
    cmdGift(args[1],args[2],args[3]);
    break;
  case 'migrate':
    console.log('  Migration already handled automatically.');
    break;
  default:
    console.log(`
  🎮 PLAYER MANAGER — Multi-user Trading Cards

  Commands:
    register <name> [display]   Register a new player
    player <name>               Switch active player
    players                     List all players
    me                          Show active player
    trade offer <p> <card> for <card>   Propose trade
    trade accept <id>           Accept pending trade
    trade reject <id>           Reject pending trade
    trade pending               Show pending trades
    trade history               Show trade history
    trade list <player>         Browse player's collection
    set-money <player> <amt>    Set player wallet (admin)
    stipend default [amt]       Show or set the default daily stipend
    stipend set <player> <amt>   Override one player's daily stipend
    stipend clear <player>      Remove a player's stipend override
    announce-set <setCode>      Announce a new set with @-mentions to all players
    dir                         Print active player data dir
    active                      Print active player name

  Integration:
    Canonical players: player1 (Player One) and player2 (Player Two).
    The card-engine.js is invoked with TRADING_CARDS_DATA_DIR
    pointing to the active player's directory.
`);
}
LOG?.log('process.end',{command:cmd||null});
