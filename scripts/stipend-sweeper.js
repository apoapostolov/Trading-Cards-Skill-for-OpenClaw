'use strict';

const fs=require('fs');
const path=require('path');

const DEFAULT_TIME_ZONE='Europe/Sofia';
const DEFAULT_STIPEND_AMOUNT=5;
const DAY_MS=24*60*60*1000;

function normalizeKey(name){
  return String(name||'').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g,'_').replace(/^_+|_+$/g,'');
}

function readJson(file){
  try{
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }catch{
    return null;
  }
}

function writeJson(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2));
  fs.renameSync(tmp,file);
}

function localDateString(date=new Date(),timeZone=DEFAULT_TIME_ZONE){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(date);
  const map=Object.fromEntries(parts.map((part)=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function localDateToUtcMs(dateStr){
  if(!dateStr) return null;
  const match=String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;
  const [,year,month,day]=match;
  return Date.UTC(Number(year),Number(month)-1,Number(day));
}

function calendarDaysBetween(startDate,endDate){
  const start=localDateToUtcMs(startDate);
  const end=localDateToUtcMs(endDate);
  if(start===null||end===null) return 0;
  return Math.max(0,Math.floor((end-start)/DAY_MS));
}

function findRootDir(startDir){
  let dir=path.resolve(startDir||process.cwd());
  while(true){
    if(fs.existsSync(path.join(dir,'players.json'))){
      return dir;
    }
    const parent=path.dirname(dir);
    if(parent===dir) return path.resolve(startDir||process.cwd());
    dir=parent;
  }
}

function resolvePlayerId(input,reg){
  const key=normalizeKey(input);
  if(!key) return null;
  const players=reg?.players||{};
  if(players[key]) return key;
  if(key==='default'&&players.apo) return 'apo';
  for(const [id,player] of Object.entries(players)){
    const aliases=new Set([
      normalizeKey(id),
      normalizeKey(player.name),
      normalizeKey(player.displayName),
      ...(player.aliases||[]).map(normalizeKey),
    ]);
    if(aliases.has(key)) return id;
  }
  return null;
}

function resolveDefaultStipendAmount(registry,fallback=DEFAULT_STIPEND_AMOUNT){
  const value=registry?.defaultStipendAmount;
  return Number.isFinite(value)&&value>0?value:fallback;
}

function resolvePlayerStipendAmount(registry,player,fallback=DEFAULT_STIPEND_AMOUNT){
  const value=player?.stipendAmount;
  return Number.isFinite(value)&&value>0?value:resolveDefaultStipendAmount(registry,fallback);
}

function syncWalletToCollections(playerDir,wallet){
  const collectionsDir=path.join(playerDir,'collections');
  if(!fs.existsSync(collectionsDir)) return;
  for(const fileName of fs.readdirSync(collectionsDir)){
    if(!fileName.endsWith('.json')) continue;
    const file=path.join(collectionsDir,fileName);
    const col=readJson(file);
    if(!col||col.wallet===undefined) continue;
    col.wallet=wallet;
    writeJson(file,col);
  }
}

function getPlayerAnchorDate(player,timeZone){
  if(player?.lastStipend) return String(player.lastStipend);
  if(player?.createdAt){
    const createdAt=new Date(player.createdAt);
    if(!Number.isNaN(createdAt.getTime())){
      return localDateString(createdAt,timeZone);
    }
  }
  return localDateString(new Date(),timeZone);
}

function applyStipendSweep({
  dataDir=process.cwd(),
  playerId=null,
  amount=null,
  now=new Date(),
  timeZone=DEFAULT_TIME_ZONE,
  syncCollections=true,
}={}){
  const rootDir=findRootDir(dataDir);
  const playersFile=path.join(rootDir,'players.json');
  const registry=readJson(playersFile);
  if(!registry||!registry.players){
    return {rootDir,playersFile,today:localDateString(now,timeZone),grants:[],total:0};
  }

  const today=localDateString(now,timeZone);
  const resolvedId=playerId?resolvePlayerId(playerId,registry):null;
  const ids=playerId?[resolvedId].filter(Boolean):Object.keys(registry.players);
  const grants=[];
  let dirty=false;

  for(const id of ids){
    const player=registry.players[id];
    if(!player) continue;
    const daysDue=calendarDaysBetween(getPlayerAnchorDate(player,timeZone),today);
    if(daysDue<=0) continue;

    const playerDir=path.join(rootDir,'players',id);
    const cfgPath=path.join(playerDir,'config.json');
    const cfg=readJson(cfgPath);
    if(!cfg||typeof cfg.wallet!=='number') continue;

    const walletBefore=cfg.wallet;
    const stipendAmount=Number.isFinite(amount)&&amount>0?amount:resolvePlayerStipendAmount(registry,player,DEFAULT_STIPEND_AMOUNT);
    const payout=daysDue*stipendAmount;
    cfg.wallet=Math.round((cfg.wallet+payout)*100)/100;
    writeJson(cfgPath,cfg);
    if(syncCollections) syncWalletToCollections(playerDir,cfg.wallet);

    player.lastStipend=today;
    registry.players[id]=player;
    grants.push({
      playerId:id,
      displayName:player.displayName||id,
      days:daysDue,
      stipendAmount,
      amount:payout,
      walletBefore,
      walletAfter:cfg.wallet,
    });
    dirty=true;
  }

  if(dirty){
    writeJson(playersFile,registry);
  }

  return {
    rootDir,
    playersFile,
    today,
    grants,
    total:grants.reduce((sum,grant)=>sum+grant.amount,0),
  };
}

module.exports={
  applyStipendSweep,
  calendarDaysBetween,
  findRootDir,
  localDateString,
  resolvePlayerId,
  resolveDefaultStipendAmount,
  resolvePlayerStipendAmount,
};
