#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {execSync,execFileSync}=require('child_process');

// ─── CONFIG ──────────────────────────────────────────────────
const BASE_DIR=process.env.TRADING_CARDS_DATA_DIR?path.resolve(process.env.TRADING_CARDS_DATA_DIR):path.join(__dirname,'..','data');
const PLAYERS_FILE=path.join(BASE_DIR,'players.json');
const TRADES_FILE=path.join(BASE_DIR,'trades.json');
const PLAYERS_DIR=path.join(BASE_DIR,'players');
const SHARED_DATA=['sets','flopps','flopps-state.json','market-macro.json','scalpers','npcs','stores','store-reviews','grading-population.json'];

// ─── HELPERS ──────────────────────────────────────────────────
function rJ(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function wJ(p,d){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2))}
function fm$(v){return'$'+v.toFixed(2)}

// ─── DAILY STIPEND ────────────────────────────────────────────
const STIPEND_AMOUNT=5;
function todayStr(){return new Date().toISOString().slice(0,10)}
function checkStipend(playerName){
  const reg=loadPlayers();
  const player=reg.players[playerName];
  if(!player)return null;
  const today=todayStr();
  if(player.lastStipend===today)return null; // already given today
  const cfgPath=path.join(playerDir(playerName),'config.json');
  const cfg=rJ(cfgPath);
  if(!cfg)return null;
  cfg.wallet+=STIPEND_AMOUNT;
  wJ(cfgPath,cfg);
  // Also sync wallet into all collection files so card-engine doesn't clobber it
  const colsDir=path.join(playerDir(playerName),'collections');
  try{for(const f of fs.readdirSync(colsDir)){if(!f.endsWith('.json'))continue;const col=JSON.parse(fs.readFileSync(path.join(colsDir,f),'utf8'));if(col.wallet!==undefined){col.wallet=cfg.wallet;fs.writeFileSync(path.join(colsDir,f),JSON.stringify(col,null,2))}}}catch{}
  player.lastStipend=today;
  savePlayers(reg);
  return STIPEND_AMOUNT;
}
// Call checkStipend before any card-engine action. Returns amount if stipend was given, null if not.
// Usage: node player-manager.js stipend <player>
function cmdCheckStipend(playerName){
  if(!playerName){console.log('Usage: player-manager stipend <player>');return}
  const safe=playerName.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  const given=checkStipend(safe);
  if(given!==null)console.log(`  💰 Daily stipend: +$${given.toFixed(2)} for ${safe}`);
  else console.log(`  ✅ No stipend needed (already received today)`);
}
// Check stipend for ALL registered players
function cmdStipendAll(){
  const reg=loadPlayers();
  let total=0;
  for(const[name]of Object.entries(reg.players)){
    const given=checkStipend(name);
    if(given!==null){
      console.log(`  💰 +$${given.toFixed(2)} → ${reg.players[name].displayName||name}`);
      total+=given;
    }
  }
  if(total===0)console.log('  ✅ All players have received their stipend today.');
  else console.log(`  📊 Total stipends given: $${total.toFixed(2)}`);
}

// ─── PLAYER REGISTRY ──────────────────────────────────────────
function loadPlayers(){
  let p=rJ(PLAYERS_FILE);
  if(!p)p={activePlayer:null,players:{}};
  if(!p.players)p.players={};
  if(!p.activePlayer)p.activePlayer=null;
  return p;
}
function savePlayers(p){wJ(PLAYERS_FILE,p)}

// ─── DATA DIR PER PLAYER ─────────────────────────────────────
function playerDir(name){
  if(!name)return null;
  // Sanitize: lowercase, strip special chars
  const safe=name.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  return path.join(PLAYERS_DIR,safe);
}

// ─── MIGRATE OLD DATA ─────────────────────────────────────────
function migrateIfNeeded(){
  const reg=loadPlayers();
  const defaultDir=playerDir('default');
  const legacyCollections=path.join(BASE_DIR,'collections');
  const legacyConfig=path.join(BASE_DIR,'config.json');
  const legacyHistory=path.join(BASE_DIR,'history.jsonl');

  // Check if already migrated (default player dir has config.json)
  if(fs.existsSync(path.join(defaultDir,'config.json')))return;

  // Check if there's anything to migrate
  if(!fs.existsSync(legacyCollections)&&!fs.existsSync(legacyConfig)){
    // Fresh install, create empty default player
    createFreshPlayer('default');
    reg.players['default']={name:'default',displayName:'Default',createdAt:Date.now()};
    reg.activePlayer='default';
    savePlayers(reg);
    return;
  }

  // Migrate
  console.log('  📦 Migrating single-user data to multi-user format...');
  fs.mkdirSync(defaultDir,{recursive:true});
  fs.mkdirSync(path.join(defaultDir,'collections'),{recursive:true});
  fs.mkdirSync(path.join(defaultDir,'checklists'),{recursive:true});
  fs.mkdirSync(path.join(defaultDir,'grading'),{recursive:true});

  // Move collections
  if(fs.existsSync(legacyCollections)){
    const files=fs.readdirSync(legacyCollections);
    for(const f of files){
      const src=path.join(legacyCollections,f);
      const dst=path.join(defaultDir,'collections',f);
      fs.renameSync(src,dst);
    }
    // Remove empty dir
    try{fs.rmdirSync(legacyCollections)}catch{}
  }

  // Move checklists
  const legacyChecklists=path.join(BASE_DIR,'checklists');
  if(fs.existsSync(legacyChecklists)){
    const files=fs.readdirSync(legacyChecklists);
    for(const f of files){
      fs.renameSync(path.join(legacyChecklists,f),path.join(defaultDir,'checklists',f));
    }
    try{fs.rmdirSync(legacyChecklists)}catch{}
  }

  // Move grading
  const legacyGrading=path.join(BASE_DIR,'grading');
  if(fs.existsSync(legacyGrading)){
    const files=fs.readdirSync(legacyGrading);
    for(const f of files){
      fs.renameSync(path.join(legacyGrading,f),path.join(defaultDir,'grading',f));
    }
    try{fs.rmdirSync(legacyGrading)}catch{}
  }

  // Copy config (preserve activeSet and all fields)
  if(fs.existsSync(legacyConfig)){
    fs.copyFileSync(legacyConfig,path.join(defaultDir,'config.json'));
    // Ensure activeSet is preserved (migration should not lose it)
    const origCfg=rJ(legacyConfig);
    const newCfg=rJ(path.join(defaultDir,'config.json'));
    if(origCfg&&origCfg.activeSet&&(!newCfg||!newCfg.activeSet)){
      newCfg.activeSet=origCfg.activeSet;
      wJ(path.join(defaultDir,'config.json'),newCfg);
    }
  } else {
    createFreshPlayer('default');
  }

  // Copy/move history
  if(fs.existsSync(legacyHistory)){
    fs.copyFileSync(legacyHistory,path.join(defaultDir,'history.jsonl'));
    // Don't delete — keep as backup
  }

  // Move marketplace if exists
  const legacyMarketplace=path.join(BASE_DIR,'marketplace');
  if(fs.existsSync(legacyMarketplace)){
    const files=fs.readdirSync(legacyMarketplace);
    fs.mkdirSync(path.join(defaultDir,'marketplace'),{recursive:true});
    for(const f of files){
      fs.copyFileSync(path.join(legacyMarketplace,f),path.join(defaultDir,'marketplace',f));
    }
  }

  reg.players['default']={name:'default',displayName:'Default',createdAt:Date.now()};
  reg.activePlayer='default';
  savePlayers(reg);
  linkSharedData(defaultDir);
  console.log('  ✅ Migration complete. Default player created from existing data.');
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
  linkSharedData(dir);
}

// ─── REGISTER ─────────────────────────────────────────────────
function cmdRegister(name,displayName){
  if(!name){console.log('Usage: player-manager register <name> [display-name]');return}
  const reg=loadPlayers();
  const safeName=name.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  if(reg.players[safeName]){console.log(`  ⚠ Player "${safeName}" already exists.`);return}

  const dir=playerDir(safeName);
  fs.mkdirSync(path.join(dir,'collections'),{recursive:true});
  fs.mkdirSync(path.join(dir,'checklists'),{recursive:true});
  fs.mkdirSync(path.join(dir,'grading'),{recursive:true});
  fs.mkdirSync(path.join(dir,'marketplace'),{recursive:true});

  // Create config with starting wallet
  wJ(path.join(dir,'config.json'),{wallet:5,activeSet:null,archivedSets:[],mode:'virtual',pocketMoney:5});
  fs.writeFileSync(path.join(dir,'history.jsonl'),'');

  // Copy active set from default if exists
  const defaultCfg=rJ(path.join(playerDir('default'),'config.json'));
  if(defaultCfg&&defaultCfg.activeSet){
    const cfg=rJ(path.join(dir,'config.json'));
    cfg.activeSet=defaultCfg.activeSet;
    wJ(path.join(dir,'config.json'),cfg);
    // Copy set's checklist
    const defaultChecklist=path.join(playerDir('default'),'checklists',defaultCfg.activeSet+'.json');
    if(fs.existsSync(defaultChecklist)){
      fs.copyFileSync(defaultChecklist,path.join(dir,'checklists',defaultCfg.activeSet+'.json'));
    }
  }

  reg.players[safeName]={name:safeName,displayName:displayName||name,createdAt:Date.now()};
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
  const safeName=name.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  if(!reg.players[safeName]){console.log(`  ⚠ Player "${safeName}" not found. Use 'register' first.`);return}
  reg.activePlayer=safeName;
  savePlayers(reg);
  console.log(`  ✅ Switched to player: ${reg.players[safeName].displayName} (${safeName})`);
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
    const active=p.safeName===reg.activePlayer?' 👈 ACTIVE':'';
    console.log(`  ${active?'👉':'  '} ${p.displayName} (${safe}) — Wallet: ${fm$(cfg?.wallet||0)} | Cards: ${cardCount}${active}`);
  }
  console.log(`${'═'.repeat(52)}\n`);
}

// ─── PLAYER WALLET/COLLECTION QUICK LOOK ──────────────────────
function cmdMe(){
  const reg=loadPlayers();
  if(!reg.activePlayer){console.log('  No active player.');return}
  console.log(`  👤 Active: ${reg.players[reg.activePlayer].displayName} (${reg.activePlayer})`);
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
  const colDir=path.join(playerDir(playerName),'collections');
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
  const otherPlayer=args[0].toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  const myCard=args[1];
  const theirCard=args[fromIdx+1];
  const reg=loadPlayers();
  const active=reg.activePlayer;

  if(!active){console.log('  ⚠ No active player.');return}
  if(active===otherPlayer){console.log('  ⚠ Cannot trade with yourself!');return}
  if(!reg.players[otherPlayer]){console.log(`  ⚠ Player "${otherPlayer}" not found.`);return}

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
  const safeName=playerName.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  if(!reg.players[safeName]){console.log(`  ⚠ Player "${safeName}" not found.`);return}
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
  const from=fromPlayer.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  const to=toPlayer.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
  if(!reg.players[from]){console.log(`  ⚠ Player "${fromPlayer}" not found.`);return}
  if(!reg.players[to]){console.log(`  ⚠ Player "${toPlayer}" not found.`);return}
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
      const matches=col.cards.filter(c=>String(c.cardNum)===String(cardNum));
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
migrateIfNeeded();

switch(cmd){
  case 'register':
    cmdRegister(args[1],args[2]);
    break;
  case 'stipend':
    if(args[1]==='all')cmdStipendAll();
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
    const pName=args[1]?.toLowerCase().replace(/[^a-z0-9_\-]/g,'_');
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
    dir                         Print active player data dir
    active                      Print active player name

  Integration:
    Set TRADING_CARDS_PLAYER env to override active player.
    The card-engine.js is invoked with TRADING_CARDS_DATA_DIR
    pointing to the active player's directory.
`);
}
