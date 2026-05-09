#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

function resolveDataDir(){
  return process.env.TRADING_CARDS_DATA_DIR
    ? path.resolve(process.env.TRADING_CARDS_DATA_DIR)
    : path.join(__dirname,'..','data');
}

function safeJson(value){
  const seen=new WeakSet();
  return JSON.stringify(value,(key,val)=>{
    if(typeof val==='bigint') return val.toString();
    if(typeof val==='function') return `[Function ${val.name||'anonymous'}]`;
    if(val instanceof Error){
      return {name:val.name,message:val.message,stack:val.stack};
    }
    if(val&&typeof val==='object'){
      if(seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

function summarize(value,maxLen=600){
  try{
    const raw=safeJson(value);
    if(raw.length<=maxLen) return JSON.parse(raw);
    return {truncated:true,preview:raw.slice(0,maxLen)};
  }catch{
    return String(value);
  }
}

function createTradingLogger({script,argv=[],verbose=false,dataDir=resolveDataDir()}={}){
  const logDir=path.join(dataDir,'logs');
  const logFile=path.join(logDir,`${script||'trading-cards'}.log`);
  fs.mkdirSync(logDir,{recursive:true});
  const base={
    script:script||'trading-cards',
    argv:[...argv],
    cwd:process.cwd(),
    dataDir,
    pid:process.pid,
  };

  function append(level,event,payload={}){
    const entry={
      timestamp:new Date().toISOString(),
      level,
      event,
      ...base,
      ...payload,
    };
    const line=safeJson(entry);
    fs.appendFileSync(logFile,line+'\n');
    if(verbose||level==='error'||level==='warn'){
      const prefix=`[${entry.timestamp}] ${base.script} ${level.toUpperCase()} ${event}`;
      const details=payload&&Object.keys(payload).length?safeJson(payload):'';
      process.stderr.write(details?`${prefix} ${details}\n`:`${prefix}\n`);
    }
    return entry;
  }

  function begin(command,payload={}){
    const startedAt=Date.now();
    append('info','command.start',{command,payload:summarize(payload)});
    return {
      end(status='ok',extra={}){
        append(status==='ok'?'info':'error','command.end',{
          command,
          status,
          durationMs:Date.now()-startedAt,
          extra:summarize(extra),
        });
      },
    };
  }

  return {
    log:(event,payload)=>append('info',event,payload),
    debug:(event,payload)=>append('debug',event,payload),
    warn:(event,payload)=>append('warn',event,payload),
    error:(event,payload)=>append('error',event,payload),
    begin,
    file:logFile,
    verbose,
    summarize,
  };
}

module.exports={createTradingLogger,resolveDataDir,summarize};
