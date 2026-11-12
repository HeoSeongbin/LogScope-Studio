import type { LogEvent, LogException } from '../../types/log';

export interface ExceptionGroup {
  fingerprint:string; type?:string; message?:string; events:LogEvent[];
  firstSeen:number|null; lastSeen:number|null; untimedCount:number;
  files:string[]; services:string[]; representative:LogEvent;
}
function signature(exception:LogException,depth=0):unknown {
  if(depth>=16)return ['depth-limit',exception.stackTrace??null];
  return [exception.type??null,exception.message??null,(exception.frames??[]).slice(0,5).map(frame=>[frame.className??null,frame.methodName??null,frame.fileName??null,frame.lineNumber??null,frame.module??null]),exception.elidedFrames??null,
    (exception.causeChain??[]).map(cause=>signature(cause,depth+1)),(exception.suppressed??[]).map(cause=>signature(cause,depth+1)),exception.incomplete||(!exception.type&&!exception.frames?.length)?exception.stackTrace??null:null];
}
export function exceptionFingerprint(event:LogEvent):string|undefined {
  const exception=event.exception;if(!exception)return;
  // Unparsed exception text is kept distinct rather than grouped by empty fields.
  const limited=event.parseWarnings?.some(warning=>/STACK_LIMIT:|EXCEPTION_LIMIT:/.test(warning));
  const fallback=limited?event.rawText:!exception.type&&!exception.frames?.length?exception.stackTrace??event.rawText:null;
  return 'v1:'+JSON.stringify([event.service??null,event.logger??null,signature(exception),fallback]);
}
export function groupExceptions(events:LogEvent[]):ExceptionGroup[]{
  const groups=new Map<string,ExceptionGroup>();const seen=new Set<string>();
  for(const event of events){
    if(seen.has(event.id))continue;seen.add(event.id);
    const fingerprint=exceptionFingerprint(event);if(!fingerprint)continue;
    let group=groups.get(fingerprint);
    if(!group){group={fingerprint,type:event.exception?.type,message:event.exception?.message,events:[],firstSeen:null,lastSeen:null,untimedCount:0,files:[],services:[],representative:event};groups.set(fingerprint,group);}
    group.events.push(event);
    if(event.timestamp===null)group.untimedCount++;else{group.firstSeen=group.firstSeen===null?event.timestamp:Math.min(group.firstSeen,event.timestamp);group.lastSeen=group.lastSeen===null?event.timestamp:Math.max(group.lastSeen,event.timestamp);}
    if(!group.files.includes(event.sourceFileName))group.files.push(event.sourceFileName);
    if(event.service&&!group.services.includes(event.service))group.services.push(event.service);
  }
  return [...groups.values()].sort((a,b)=>b.events.length-a.events.length||(a.fingerprint<b.fingerprint?-1:a.fingerprint>b.fingerprint?1:0));
}
