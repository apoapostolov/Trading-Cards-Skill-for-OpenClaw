#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {execSync,execFileSync}=require('child_process');
const crypto=require('crypto');
const {createTradingLogger,summarize:logSummarize}=require('./trading-logger.js');
const CAT = require('./categories.js');

const {
  getDataDir, CARD_FORMATS, AUTO_TYPES, AUTO_VARIANTS, RELIC_TYPES, RELIC_QUALITY,
  composeAuto, composeRelic, mulberry32, ENGINE_BASE_SEED, GLOBAL_RNG, RNG, pwK,
  PACK_CONFIG_PATH, loadPackConfig, getDefaultParallels, PACKS, DEFAULT_PARALLELS,
  PARALLELS, DEFAULT_CARD_TYPES, SPECIALS, resolveParallels, resolveCardTypes,
  resolveInserts, TIERS, SUBS, GRADES, PSA_TIERS, PLATES, GRADING_DIR,
  COMPANIES_FILE, GRADING_STATE_FILE, POP_FILE, TIER_EMOJI, TIER_COLOR, PAR_EMOJI,
  SUB_EMOJI, SP_EMOJI, FLOPPS_BULLETINS, FLOPPS_EXECUTIVES, FLOPPS_PRODUCT_LINES,
  FLOPPS_PARTNERS, FLOPPS_PHASES, FLOPPS_TREND_CANDIDATES, HINT_CENTERING,
  HINT_CORNERS, HINT_EDGES, HINT_SURFACE, HINT_APPEAL, CATS,
} = require('./lib/constants');
const {
  LOG, setEngineSeed, rJ, wJ, fm$, pR, ri,
  loadCfg, saveCfg, isPlayerScopedDataDir, requirePlayerContext,
  loadSet, createEmptyCollection, loadCol, saveCol, rebuildPulls,
  nextAcquisitionBatchId, createAcquisitionTracker, annotateAcquiredCard,
  setLastAcquisitionBatch, getLatestAcquisitionBatch,
  ensureSealedInventory, getSealedInventoryEntry, getSealedQty, addSealedProduct,
  consumeSealedProduct, getSealedInventoryValue, formatSealedInventorySummary,
  isReal, normalizeSeed, genCard, genSetCode, gaussRand, clamp,
  generateCondition, ensureCondition,
  FLOPPS_DIR, FLOPPS_STATE_FILE, FLOPPS_WILDCARD_DIR,
  loadCompanies, loadGradingState, saveGradingState, loadPopulation, savePopulation,
  psaTierForValue, conditionToGrade, isBlackLabel, gradeMultiplier,
  estimateGradeProbability, gradeLabel, progressStr, bumpPopulation,
  simNpcPopulationGrowth, rollGrade, generateQuality, getCond,
} = require('./lib/helpers');
const {
  rollParallel, rollSpecial, rollCardType, composeCardTypeResult,
  selectCard, calcPrice, fmtCard, pullCards, ensureSet,
} = require('./lib/pack-engine');
const {
  loadMarket, getMarketCardList, saveMarket, normalizeMarketEvents,
  getMacroState, loadMacroState, saveMacroState, fetchMacroState,
  MARKET_EVENT_TYPES, MARKET_EVENT_PROFILES,
  formatMarketEventDesc, getMarketEventProfile, isBullishMarketEvent, isBearishMarketEvent,
  pickMarketEventType, buildMarketEvent, applyMarketEvent, addMarketEvent,
  marketEventDemandMultiplier, activeMarketEvents,
  calcPendingTicks, runMarketTicks, resimulateMarketSnapshot, catchUpMarketToNow,
  getSimulationDay, computeSetAggregates, syncMarketToCollection,
  enforceTierOrdering, tickMarketOnChange,
  initMarket, assignChaseScore,
  weightedPick, getSpeculationWeight, clamp01, hashStringSeed,
} = require('./lib/market-engine');
const {
  floppsDefaultCorporation, ensureFloppsStateShape, loadFloppsState, saveFloppsState,
  slugifyFloppsText, getFloppsPriceForDay, getSimulationDate,
  buildFloppsReleaseCalendar, ensureFloppsReleaseCalendar, getFloppsReleaseWindow,
  scoreFloppsTrendCandidate, ensureFloppsTrendDesk, getFloppsEcosystemSnapshot,
  pickFloppsExecutive, advanceFloppsCorporationState, getFloppsSimulationContext,
  pickFloppsBulletin, pickFloppsBulletinByCategory, buildAnnouncementFromBulletin,
  buildQuarterlyFloppsAnnouncement, buildScheduledFloppsAnnouncement,
  buildExceptionalFloppsAnnouncement, daysSinceLastFloppsAnnouncement,
  updateFloppsStockPrice, getFloppsWildcardChance, normalizeFloppsWildcardEvent,
  saveFloppsWildcardArtifact, maybeGenerateFloppsWildcardBulletin,
  recordFloppsBulletin, formatFloppsNewsBlast, formatFloppsNewsSuffix,
  maybeAnnounceFloppsNews, getFloppsOverlayLines,
} = require('./lib/flopps-engine');
const {
  loadDefaultStores, loadStoreState, saveStoreState,
  loadDefaultScalpers, loadScalperState, saveScalperState,
  isSetHot, getDemandFactor,
  getRelationshipTier, getRelationshipDiscount, getRecentScalperBuyQty,
  getStoreInventoryProfile, calcStoreInventoryQty, ensureStoreInventory,
  calcStorePrice, restockIfNeeded,
  loadStoreSales, saveStoreSales, generateStoreSales, getStoreSaleDiscount,
  ensureFullInventory,
  simulateScalpersEnhanced, simulateScalpers,
  loadListings, saveListings, loadLots, saveLots,
  loadAuctions, saveAuctions, loadTraders, loadTradeHistory, saveTradeHistory,
  tickListings, tickAuctionsEnhanced, tickAuctions, ensureNpcAuctions,
  SUPPLIES, SALE_TYPES, ORIGIN_PRESETS, NPC_BIDDERS,
  assignOrigin,
} = require('./lib/economy-engine');
const {
  gradeRarityBonus, gradeflationPressure, processCompletedSubmissions,
} = require('./lib/grading-engine');

const {applyStipendSweep}=require('./stipend-sweeper.js');
// getDataDir() is called afresh each time — respects TRADING_CARDS_DATA_DIR set at runtime
const { buildRichSetMetadata } = require('./set-metadata.js');


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
  const cfg=loadCfg();
  console.log(`  Cards: ${s.cards.length}`);
  console.log(`  Wallet: ${typeof cfg.wallet==='number'?fm$(cfg.wallet):'n/a (shared set generation)'}`);
  const bt={};for(const c of s.cards)bt[c.starTier]=(bt[c.starTier]||0)+1;
  for(const t of TIERS)console.log(`    ${pR(t.name,12)} ${bt[t.name]||0}`);
  console.log(`${'═'.repeat(50)}\n`);
}

function cmdOpenPack(type){
  const set=ensureSet();if(!set)return;
  const pt=type||'hobby';if(!PACKS[pt]){console.log(`Unknown: ${pt}`);return}
  const real=isReal();
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
  let newCount=0,variantCount=0,dupCount=0;
  pack.forEach((c,i)=>{
    const isDup=Boolean(c.acquiredIsDuplicate);
    const isVariant=Boolean(c.acquiredIsVariant);
    if(isDup)dupCount++;
    else if(isVariant)variantCount++;
    else newCount++;
    console.log(fmtCard(c,i+1,set,isDup?c.acquiredCopyIndex:0));
    console.log('');
  });
  console.log(`${'─'.repeat(52)}`);
  console.log(`  Value: ${fm$(tv)} | Cost: ${fm$(cost)} | ROI: ${cost>0?(roi>=0?'+':'')+roi.toFixed(1)+'%':'n/a'}`);
  if(real){
    const totalNewCards = newCount + variantCount;
    console.log(`  New: ${totalNewCards} (${variantCount} variant${variantCount!==1?'s':''}) | Dupes: ${dupCount} | Wallet: ${fm$(cfg.wallet)}`);
    setLastAcquisitionBatch(col,packTracker,{newCount:totalNewCards,duplicateCount:dupCount,cardCount:pack.length});
    saveCol(col);
  } else {
    console.log(`  Wallet: untouched (virtual)`);
  }
  console.log(`${'─'.repeat(52)}\n`);
}

function cmdOpenBox(type){
  const set=ensureSet();if(!set)return;
  const pt=type||'hobby';if(!PACKS[pt]){console.log(`Unknown: ${pt}`);return}
  const real=isReal();const cfg=loadCfg();const bp=PACKS[pt].price;
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
  const np=PACKS[pt].packs;let tv=0,th=0,boxBest=null,totalNew=0,totalVariant=0,totalDup=0;
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
      const isVariant=Boolean(c.acquiredIsVariant);
      if(isDup)totalDup++;
      else if(isVariant)totalVariant++;
      else totalNew++;
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
    const totalNewCards = totalNew + totalVariant;
    console.log(`  New: ${totalNewCards} (${totalVariant} variant${totalVariant!==1?'s':''}) | Dupes: ${totalDup} | 1/1s: ${col.stats.oneOfOnes}`);
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
  const colDir=path.join(getDataDir(),'collections');
  const files=fs.readdirSync(colDir).filter(f=>f.endsWith('.json'));
  let totalCards=0,totalValue=0,totalSpent=0,totalHits=0,totalOnes=0,setsInfo=[];
  for(const f of files){
    const col=rJ(path.join(colDir,f));if(!col)continue;
    const setPath=path.join(getDataDir(),'sets',col.setKey+'.json');
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
  const colDir=path.join(getDataDir(),'collections');
  const files=fs.readdirSync(colDir).filter(f=>f.endsWith('.json'));
  if(!files.length){console.log(`\n  ❌ No collections found.\n`);return}
  let shown=0;
  for(const f of files){
    const col=rJ(path.join(colDir,f));if(!col||!col.cards.length)continue;
    const setPath=path.join(getDataDir(),'sets',col.setKey+'.json');
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


function cmdCompare(){
  const globalData=path.join(__dirname,'..','data');
  const playersFile=path.join(globalData,'players.json');
  const playersReg=rJ(playersFile);
  if(!playersReg||!playersReg.players||!Object.keys(playersReg.players).length){
    console.log(`\n  \u26A0 No players found.\n`);
    return;
  }
  const rows=[];
  const playerIds=Object.keys(playersReg.players);
  for(const id of playerIds){
    const pDir=path.join(globalData,'players',id);
    const cfg=rJ(path.join(pDir,'config.json'));
    const colDir=path.join(pDir,'collections');
    let totalCards=0,totalValue=0,totalSlots=0,totalSetSize=0,totalHits=0,totalPacks=0;
    if(fs.existsSync(colDir)){
      const files=fs.readdirSync(colDir).filter(f=>f.endsWith('.json'));
      for(const f of files){
        const col=rJ(path.join(colDir,f));
        if(!col||!col.cards)continue;
        totalCards+=col.cards.length;
        totalValue+=col.stats?.value||0;
        totalHits+=col.stats?.hits||0;
        totalPacks+=col.stats?.packs||0;
        const setSlots=new Set(col.cards.map(c=>c.cardNum));
        totalSlots+=setSlots.size;
        const setPath=path.join(globalData,'sets',col.setKey+'.json');
        const set=rJ(setPath);
        if(set)totalSetSize+=set.cards.length;
      }
    }
    const wallet=cfg?.wallet||0;
    const variants=totalCards-totalSlots;
    const compPct=totalSetSize>0?((totalSlots/totalSetSize)*100).toFixed(1):'0.0';
    rows.push({id,displayName:playersReg.players[id].displayName||id,wallet,totalCards,totalSlots,totalSetSize,variants,totalValue,compPct,totalHits,totalPacks});
  }
  const colW=Math.max(...rows.map(r=>r.displayName.length))+2;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  \u{1F4CA} PLAYER COMPARISON`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Metric  ${rows.map(r=>r.displayName.padEnd(colW)).join('\u2502 ')}`);
  console.log('  '+['─'.repeat(8)].concat(rows.map(()=>'─'.repeat(colW))).join('─┼─'));
  const fields=[
    {label:'Wallet',fn:r=>`$${r.wallet.toFixed(2)}`},
    {label:'Cards',fn:r=>String(r.totalCards)},
    {label:'Slots',fn:r=>`${r.totalSlots}/${r.totalSetSize}`},
    {label:'Variants',fn:r=>String(r.variants)},
    {label:'Value',fn:r=>`$${r.totalValue.toFixed(2)}`},
    {label:'Completion',fn:r=>`${r.compPct}%`},
    {label:'Hits',fn:r=>String(r.totalHits)},
    {label:'Packs',fn:r=>String(r.totalPacks)},
  ];
  for(const f of fields){
    const vals=rows.map(r=>f.fn(r).padEnd(colW));
    console.log(`  ${f.label.padEnd(8)}${vals.join('\u2502 ')}`);
  }
  console.log(`${'═'.repeat(60)}\n`);
}

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
  const checklistDir=path.join(getDataDir(),'checklists');
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
  LOG.current?.debug('write-checklist',{setCode:set.code,setYear:set.year,path:fp});
  return fp;
}

function cmdChecklist(){
  const cfg=loadCfg();
  const filterArg=process.argv.slice(2).find(a=>!a.startsWith('-')&&a!=='checklist');
  const colDir=path.join(getDataDir(),'collections');
  const setDir=path.join(getDataDir(),'sets');
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
const HISTORY_FILE=path.join(getDataDir(),'history.jsonl');
function logHistory(action, details, walletBefore, walletAfter, extra){
  const entry={timestamp:new Date().toISOString(), action, details, walletBefore, walletAfter,...(extra||{})};
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry)+'\n');
  LOG.current?.log('history-entry',{action,details,walletBefore,walletAfter,extra:logSummarize(extra||{})});
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
    let set=rJ(path.join(getDataDir(),'sets',sk+'.json'));
    if(!set){const entries=fs.readdirSync(path.join(getDataDir(),'sets')).filter(f=>f.endsWith('.json'));const match=entries.find(f=>f.replace('.json','').startsWith(sk+'-'));if(match)set=rJ(path.join(getDataDir(),'sets',match))}
    if(!set){console.log(`  ⚠ Set not found: ${sk}`);continue}
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
  LOG.current?.debug('rewrite-history',{removedEntries:indices.length,remainingEntries:remaining.length});
  console.log(`${'═'.repeat(52)}\n`)
}

function cmdRemoveMoney(){
  const sub=args.find(a=>!a.startsWith('-')&&a!=='remove-money');
  const cfg=loadCfg();
  if(typeof cfg.wallet!=='number'){console.log(`\n  No player wallet configured for this data directory. Use player-manager.js dir first.\n`);return;}
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
  if(typeof cfg.wallet!=='number'){console.log(`\n  No player wallet configured for this data directory. Use player-manager.js dir first.\n`);return;}
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
  if(typeof cfg.wallet!=='number'){console.log(`\n  No player wallet configured for this data directory. Use player-manager.js dir first.\n`);return;}
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

function cmdWishlist(){
  const cfg=loadCfg();if(!cfg.activeSet){console.log('No active set.');return}
  const set=loadSet();if(!set){console.log('Set not found.');return}
  const subCmd=process.argv.slice(2).find((a,i)=>i>0&&!a.startsWith('-'));
  if(!subCmd||subCmd==='list') return cmdWishlistList(cfg,set);
  if(subCmd==='add') return cmdWishlistAdd(cfg,set);
  if(subCmd==='remove') return cmdWishlistRemove(cfg,set);
  console.log('Usage: wishlist add <card-num>, wishlist remove <card-num>, wishlist list');
}
function cmdWishlistAdd(cfg,set){
  const cardNum=process.argv.slice(2).find((a,i)=>i>1&&!a.startsWith('-'));
  if(!cardNum){console.log('Usage: wishlist add <card-num>');return}
  if(!cfg.wishlist) cfg.wishlist=[];
  if(cfg.wishlist.includes(cardNum)){console.log(`\n  ⭐ Card #${cardNum} is already on your wishlist.\n`);return}
  const baseCard=set.cards.find(c=>c.num===cardNum);
  if(!baseCard){console.log(`\n  ❌ Card #${cardNum} not found in set.\n`);return}
  cfg.wishlist.push(cardNum);
  cfg.wishlist.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  saveCfg(cfg);
  console.log(`\n  ⭐ Added #${cardNum} ${baseCard.name} to wishlist.\n`);
}
function cmdWishlistRemove(cfg,set){
  const cardNum=process.argv.slice(2).find((a,i)=>i>1&&!a.startsWith('-'));
  if(!cardNum){console.log('Usage: wishlist remove <card-num>');return}
  if(!cfg.wishlist||!cfg.wishlist.includes(cardNum)){console.log(`\n  ⭐ Card #${cardNum} is not on your wishlist.\n`);return}
  cfg.wishlist=cfg.wishlist.filter(n=>n!==cardNum);
  saveCfg(cfg);
  const baseCard=set.cards.find(c=>c.num===cardNum);
  console.log(`\n  ⭐ Removed #${cardNum} ${baseCard?baseCard.name:''} from wishlist.\n`);
}
function cmdWishlistList(cfg,set){
  if(!cfg.wishlist||cfg.wishlist.length===0){console.log(`\n  📋 Wishlist is empty. Use 'wishlist add <card-num>' to add cards.\n`);return}
  const col=loadCol();
  const ownedNums=new Set();
  if(col) col.cards.forEach(c=>ownedNums.add(c.cardNum));
  let ownedCount=0,missingCount=0;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📋 WISHLIST (${cfg.wishlist.length} cards)`);
  console.log(`${'═'.repeat(52)}`);
  for(const num of cfg.wishlist){
    const baseCard=set.cards.find(c=>c.num===num);
    const name=baseCard?baseCard.name:'Unknown';
    const owned=ownedNums.has(num);
    if(owned) ownedCount++;else missingCount++;
    const status=owned?'✅ Owned':'❌ Missing';
    console.log(`  ${num} ${pR(name,30)} ${status}`);
  }
  console.log(`${'═'.repeat(52)}`);
  console.log(`  ${ownedCount} owned  ${missingCount} missing\n`);
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
  if(typeof cfg.wallet!=='number'){console.log(`\n  No player wallet configured for this data directory. Use player-manager.js dir first.\n`);return;}
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
  if(typeof cfg.wallet!=='number'){console.log('No player wallet configured for this data directory. Use player-manager.js dir first.');return;}
  if(!args.includes('--confirm')){
    console.log(`\n  ⚠️  This will WIPE all cards, stats, and reset wallet for: ${cfg.activeSet}`);
    console.log(`  Use: card-engine reset-collection --confirm\n`);return;
  }
  const col=loadCol();if(!col){console.log('No collection.');return}
  const before=cfg.wallet;
  col.cards=[];col.pulls={};col.parallelCounts={};col.stats={total:0,value:0,spent:0,boxes:0,packs:0,hits:0,oneOfOnes:0};col.bestPull=null;col.sealedInventory={};
  cfg.wallet=0;col.wallet=0;saveCfg(cfg);saveCol(col);
  logHistory('reset-collection',cfg.activeSet,before,cfg.wallet);
  const set=loadSet();if(set)updateChecklist(set,col);
  console.log(`\n  🔄 Collection reset. Wallet: ${fm$(cfg.wallet)}\n`);
}

function cmdListSets(){
  const cfg=loadCfg();const ar=cfg.archivedSets||[];
  console.log(`\n${'═'.repeat(50)}`);console.log(`  📁 SETS HISTORY`);console.log(`${'═'.repeat(50)}`);
  if(cfg.activeSet){const col=loadCol();const set=loadSet();
    if(set&&col)console.log(`  ⭐ ${set.name} (${set.code}) — ${col.stats.total} cards, ${fm$(col.stats.value)} [ACTIVE]`)}
  for(const a of ar){const s=rJ(path.join(getDataDir(),'sets',a.setKey+'.json'));
    console.log(`  📁 ${a.setKey} — ${a.totalCards||'?'} cards, ${fm$(a.stats?.value||0)} [${a.archivedAt?.split('T')[0]}]`)}
  console.log(`${'═'.repeat(50)}\n`);
}

// ─── STORE SYSTEM ──────────────────────────────────────────────────
const STORES_DIR=path.join(getDataDir(),'stores');
const SCALPERS_DIR=path.join(getDataDir(),'scalpers');

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
  const degrade=RNG()<0.2;
  let newCond;
  if(degrade){
    console.log(`  🎲 Result: Condition degraded!`);
    newCond={
      centering:clamp(gr.condition.centering-Math.round(RNG()*8),50,100),
      corners:Math.round(clamp(gr.condition.corners-RNG()*1.5,1,10)*10)/10,
      edges:Math.round(clamp(gr.condition.edges-RNG()*1.0,1,10)*10)/10,
      surface:Math.round(clamp(gr.condition.surface-RNG()*2.0,1,10)*10)/10,
    };
  } else {
    console.log(`  🎲 Result: Condition preserved!`);
    newCond={...gr.condition};
    // Tiny random variance even on success
    newCond.corners=Math.round(clamp(newCond.corners+(RNG()-0.5)*0.3,1,10)*10)/10;
    newCond.edges=Math.round(clamp(newCond.edges+(RNG()-0.5)*0.3,1,10)*10)/10;
    newCond.surface=Math.round(clamp(newCond.surface+(RNG()-0.5)*0.3,1,10)*10)/10;
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

const MARKETPLACE_DIR=path.join(getDataDir(),'marketplace');
const NPCS_DIR=path.join(getDataDir(),'npcs');

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
    let r=RNG()*bestPool.reduce((s,g)=>s+g.w,0)
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
  const shuffled=[...availCards].sort(()=>RNG()-0.5).slice(0,10);
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
    accepted=RNG()<acceptChance;
    reason=accepted?'Fair trade accepted!':'Trader wants slightly better value.';
  } else if(fairness>=0.7){
    // Slightly unfair to NPC
    const acceptChance=trader.tradeStyle==='generous'?0.4:trader.tradeStyle==='stingy'?0.05:0.2;
    accepted=RNG()<acceptChance;
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
  const count=3+Math.floor(RNG()*3);
  for(let i=0;i<count;i++){
    const seller=sellers[i%sellers.length];
    const cardCount=5+Math.floor(RNG()*10);
    const contents=[];
    const usedNums=new Set();
    let estValue=0;
    // Pick random cards from the set
    const allCards=[...set.cards].sort(()=>RNG()-0.5).slice(0,cardCount);
    // 15% chance of a hidden gem (high tier card)
    let hasGem=false;
    if(RNG()<0.15){
      const gems=set.cards.filter(c=>c.starTier==='Legendary'||c.starTier==='Superstar');
      if(gems.length){
        const gem=gems[Math.floor(RNG()*gems.length)];
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
    const discount=0.3+RNG()*0.2; // 30-50% off
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

const POPULATION_FILE=path.join(getDataDir(),'grading-population.json')
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
    centering:clamp(cond.centering-Math.round(RNG()*8),50,100),
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

const ORDERBOOK_DIR=path.join(getDataDir(),'orderbook')
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
let floppsSuffix='';
LOG.current=createTradingLogger({script:'card-engine',argv:args,verbose:args.includes('--verbose')||process.env.TRADING_CARDS_VERBOSE==='1',dataDir:getDataDir()});
process.on('uncaughtException',err=>{LOG.current?.error('uncaught-exception',{error:err});throw err;});
process.on('unhandledRejection',err=>{LOG.current?.error('unhandled-rejection',{error:err});});
{
  const seedArg=args.indexOf('--seed');
  const seed=seedArg>=0&&args[seedArg+1]?normalizeSeed(args[seedArg+1]):process.env.TRADING_CARDS_SEED;
  setEngineSeed(seed);
}
LOG.current?.log('process.start',{command:cmd||null,dataDir:getDataDir()});
const PLAYER_FREE_COMMANDS=new Set(['generate-set','gen-set','generate-set-ai','gen-ai','flopps','flopps-launch','flopps-status','flopps-day','flopps-today','flopps-wildcard','compare','list-sets']);
const isHelpOrVersion=cmd==='--help'||cmd==='-h'||cmd==='--version'||cmd==='-V';
if(cmd&&!isHelpOrVersion&&!PLAYER_FREE_COMMANDS.has(cmd)&&!requirePlayerContext(cmd)){
  process.exitCode=1;
  process.exit(1);
}
applyStipendSweep({dataDir:getDataDir(),amount:5,timeZone:'Europe/Sofia'});
{
  const cfg=loadCfg();
  if(cfg.activeSet){
    const set=loadSet();
    const market=set?loadMarket(cfg.activeSet):null;
    if(set&&market&&cmd!=='flopps-wildcard'){
      const bulletin=maybeAnnounceFloppsNews(set,market,cmd||'');
      if(bulletin) floppsSuffix=formatFloppsNewsSuffix(loadFloppsState());
    }
  }
}

// ─── Commander.js Argument Parsing ─────────────────────────────────
const { program } = require('commander');

const EXTENDED_HELP = `

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
      - You open a real pack or box (time-based: elapsed 12-hour ticks since the last operation)
      - You sell a card (+1 tick, sold cards increase market supply)
      - You sell duplicates in bulk (+1 tick, all sold cards increase supply)

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
    flopps --theme "Arena of Broken Promises" --set-code FPP`;

program
  .name('card-engine')
  .usage('<command> [options]')
  .addHelpText('after', EXTENDED_HELP)
  .showHelpAfterError()
  .configureHelp({ showGlobalOptions: true });

// Global options — isReal() and seed parsing still use process.argv directly
program
  .option('--real', 'Commit to collection — cards saved as personal assets, wallet deducted')
  .option('--seed <value>', 'Set RNG seed for deterministic outcomes')
  .option('--verbose', 'Enable verbose logging');

// ─── Command Definitions ────────────────────────────────────────────

program.command('generate-set').alias('gen-set')
  .description('Generate a new card set')
  .option('--category <type>', 'Set category (character, sports, movie, etc.)')
  .option('--sport <sport>', 'Sport for sports sets')
  .option('--cards <N>', 'Number of cards', parseInt)
  .option('--theme <theme>', 'Theme for the set')
  .action(cmdGenSet);

program.command('generate-set-ai').alias('gen-ai')
  .description('Generate a card set using AI (requires OPENROUTER_API_KEY)')
  .action(() => {
    const{execFileSync}=require('child_process');
    execFileSync(process.execPath,[path.join(__dirname,'ai-set-generator.js'),...process.argv.slice(3)],{stdio:'inherit',cwd:getDataDir()});
  });

program.command('open-pack')
  .argument('[type]', 'Pack type: hobby ($120), blaster ($50), retail ($5), jumbo ($30)')
  .description('Open a pack of cards')
  .action((type) => cmdOpenPack(type));

program.command('open-box')
  .argument('[type]', 'Box type: hobby box or retail box')
  .description('Open a box of cards')
  .action((type) => cmdOpenBox(type));

program.command('portfolio')
  .description('Financial overview + set completion')
  .action(cmdPortfolio);

program.command('compare')
  .description('Compare wallets and collections across all players')
  .action(cmdCompare);

program.command('collection')
  .argument('[set-code]', 'Set code or name filter')
  .description('Show collection')
  .action(cmdCollection);

program.command('checklist')
  .argument('[set-code]', 'Set code or name filter')
  .description('Show checklist')
  .action(cmdChecklist);

program.command('set-info')
  .description('Show active set information')
  .action(cmdSetInfo);

program.command('card-types')
  .description('Show card types')
  .action(cmdCardTypes);

program.command('new-season')
  .description('Start a new season (reset market, rollover set)')
  .action(cmdNewSeason);

program.command('list-sets')
  .description('List all generated sets')
  .action(cmdListSets);

program.command('remove-money')
  .argument('<amount>', 'Amount to remove (withdrawn)')
  .description('Remove money from wallet')
  .action(cmdRemoveMoney);

program.command('add-money')
  .argument('[amount]', 'Amount to add (default: pocketMoney from config)')
  .description('Add money to wallet')
  .action(cmdAddMoney);

program.command('wallet')
  .description('Show wallet balance')
  .action(cmdWallet);

program.command('set-money')
  .argument('<amount>', 'New wallet balance')
  .description('Set wallet balance')
  .action(cmdSetMoney);

program.command('duplicates').alias('dups')
  .description('Show duplicate cards in collection')
  .action(cmdDuplicates);

program.command('wishlist')
  .argument('[action]', 'add, remove, or list')
  .argument('[card-num]', 'Card number to add/remove')
  .description('Manage wishlist: add <num>, remove <num>, list')
  .action(cmdWishlist);

program.command('top-cards')
  .description('Show top cards by value [--grade]')
  .option('--grade', 'Sort by grade instead of value')
  .action(cmdTopCards);

program.command('pack-stats')
  .description('Show pack opening statistics')
  .action(cmdPackStats);

program.command('history')
  .description('Show transaction history [--all] [--count N]')
  .option('--all', 'Show all history entries')
  .option('--count <N>', 'Number of entries to show', parseInt)
  .action(cmdHistory);

program.command('undo')
  .argument('[n]', 'Number of operations to undo (default: 1)', parseInt)
  .description('Undo the last N transaction(s)')
  .action((n) => cmdUndo(n));

program.command('reset-collection')
  .description('Reset collection --confirm required')
  .option('--confirm', 'Confirm the reset')
  .action(cmdResetCollection);

program.command('grade-card')
  .argument('<target>', 'Card number, --all, or --dups')
  .description('Submit a card to PSA grading')
  .action(cmdGradeCard);

program.command('grade')
  .argument('[subcommand]', 'submit, status, history, pop, cost, crack, stats, pop-report, value-add, crack-risk')
  .description('Grading system: submit, status, history, pop, cost, crack, stats')
  .action(cmdGrade);

program.command('market')
  .argument('[args...]', 'Card number, macro, supply <num>, book <num>, events, demand, leaderboard, scalpers, or scalper-log')
  .description('Secondary market dashboard or card detail')
  .action(cmdMarket);

program.command('origin')
  .argument('[card-num]', 'Card number (omit for summary)')
  .description('Show card origin / acquisition history')
  .action(cmdOrigin);

program.command('flag')
  .argument('[query]', 'Card number, owned, movers, gainers, or losers')
  .description('Market heatmap: set overview, card detail, owned, movers, gainers, losers')
  .action(cmdFlag);

program.command('revalue')
  .description('Recalculate collection from current market prices')
  .action(cmdRevalue);

program.command('sell')
  .argument('[target]', 'Card number, dups, or pack-dups')
  .description('Sell a card: <card-num>, dups, pack-dups [--best] [--pack]')
  .action(cmdSell);

program.command('buy').alias('buy-single')
  .argument('[card-num]', 'Card number to buy')
  .description('Buy a single card from the market [--best] [--max-price $X]')
  .action(cmdBuySingle);

program.command('trade')
  .argument('[action]', 'browse, offer, counter, or history')
  .argument('[args...]', 'Additional arguments')
  .description('Trade with NPCs: browse, offer, counter, history')
  .action(cmdTrade);

program.command('lot')
  .argument('[action]', 'browse, buy, or history')
  .argument('[args...]', 'Lot ID for buy')
  .description('Browse and buy collection lots')
  .action(cmdLot);

program.command('sell-list')
  .argument('[subcommand]', 'Card number+price, instant, listings, or cancel')
  .argument('[args...]', 'Additional arguments')
  .description('Consignment listings: <card-num> <price>, instant, listings, cancel')
  .action(cmdSellList);

program.command('auction')
  .argument('[action]', 'list, browse, bid, sell, view, close, history, or relist')
  .argument('[args...]', 'Auction ID, card number, or amount')
  .description('Auction house: list, browse, bid, close')
  .action(cmdAuctionEnhanced);

program.command('store')
  .argument('[action]', 'list, visit, buy, stock, pressure, restock, trade, or reputation')
  .argument('[args...]', 'Store ID, product, or quantity')
  .description('Store system: list, visit, buy, stock, pressure, restock, trade, reputation')
  .action(cmdStore);

program.command('flopps-status')
  .description('Show the fake FLPS stock price and latest bulletin')
  .action(cmdFloppsStatus);

program.command('flopps-day')
  .argument('<day>', 'Simulation day to inspect')
  .description('Show Flopps actions on a specific simulation day')
  .action((day) => cmdFloppsDay(day));

program.command('flopps-today')
  .description('Show Flopps actions for today')
  .action(cmdFloppsToday);

program.command('flopps-wildcard')
  .description('Force a surprise AI-written Flopps event')
  .action(cmdFloppsWildcard);

program.command('flopps').alias('flopps-launch')
  .description('Launch a Flopps AI-generated set')
  .action(() => {
    const{execFileSync:execFileSyncFlopps}=require('child_process');
    execFileSyncFlopps(process.execPath,[path.join(__dirname,'ai-set-generator.js'),'--flopps',...process.argv.slice(3)],{stdio:'inherit',cwd:getDataDir()});
  });

program.parse(process.argv);

if(floppsSuffix) process.stdout.write(floppsSuffix+'\n');
LOG.current?.log('process.end',{command:cmd||null});
