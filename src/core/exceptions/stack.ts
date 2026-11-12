import type { LogException, StackFrame } from '../../types/log';

export const MAX_EXCEPTION_DEPTH=16;
export const MAX_EXCEPTION_NODES=128;
const typePattern='[A-Za-z_$][\\w$`+]*(?:\\.[A-Za-z_$][\\w$`+]*)*';
const headerPattern=new RegExp(`^(?:(Caused by:|Suppressed:|--->)\\s*)?(?:Exception in thread "[^"]+"\\s+)?(${typePattern})(?: \\(0x[0-9a-fA-F]+\\))?(?::(?: ?)(.*))?$`);
export interface ExceptionHeader { type:string; message?:string; relation?:LogException['relation']; indent:number }
export function exceptionHeader(raw:string):ExceptionHeader|undefined {
  const match=raw.trim().match(headerPattern);if(!match||!/(?:Exception|Error|Throwable)$/.test(match[2]))return;
  return {type:match[2],message:match[3],relation:match[1]==='Caused by:'?'cause':match[1]==='Suppressed:'?'suppressed':match[1]==='--->'?'inner':undefined,indent:(raw.match(/^\s*/)?.[0]??'').replace(/\t/g,'    ').length};
}
export function stackFrame(raw:string):StackFrame|undefined {
  const java=raw.match(/^\s*at\s+([^\s(]+)\(([^)]*)\)\s*$/);
  if(java&&/^(?:Native Method|Unknown Source|[^:]*\.(?:java|kt|scala|groovy|clj)(?::\d+)?)$/.test(java[2])){
    const moduleIndex=java[1].lastIndexOf('/');const call=java[1].slice(moduleIndex+1);const dot=call.lastIndexOf('.');const location=java[2].match(/^(.*):(\d+)$/);
    return {raw,module:moduleIndex>=0?java[1].slice(0,moduleIndex):undefined,className:dot>=0?call.slice(0,dot):undefined,methodName:dot>=0?call.slice(dot+1):call,fileName:location?.[1]??(/^(Native Method|Unknown Source)$/.test(java[2])?undefined:java[2]),lineNumber:location?Number(location[2]):undefined};
  }
  const dotnet=raw.match(/^\s*at\s+([^\s(]+)\(.*\)(?: in (.+):line (\d+))?\s*$/);
  if(dotnet){const dot=dotnet[1].lastIndexOf('.');return {raw,className:dot>=0?dotnet[1].slice(0,dot):undefined,methodName:dot>=0?dotnet[1].slice(dot+1):dotnet[1],fileName:dotnet[2],lineNumber:dotnet[3]?Number(dotnet[3]):undefined};}
}
export function stackMarker(raw:string){return /^\s*(?:\.\.\. \d+ (?:more|common frames omitted)|--- End of (?:inner exception stack trace|stack trace from previous location) ---|\[CIRCULAR REFERENCE:.*\])\s*$/.test(raw);}
export function isStackLine(raw:string){return !!exceptionHeader(raw)||!!stackFrame(raw)||stackMarker(raw);}

export interface StackAnalysis { exception?:LogException; warnings:string[] }
export function analyzeStack(text:string,explicit?:LogException):StackAnalysis {
  const lines=text.split(/\r\n|\n|\r/);const warnings:string[]=[];
  let root:LogException|undefined=explicit?{...explicit,frames:[],causeChain:explicit.causeChain?.slice(),suppressed:explicit.suppressed?.slice()}:undefined;
  let current=root;let nodes=root?1:0;
  const contexts:Array<{node:LogException;indent:number}>=root?[{node:root,indent:0}]:[];
  const innerParents:LogException[]=[];
  let hadHeader=false;let unknown=false;let structuralLimit=false;
  function acceptHeader(header:ExceptionHeader){
    if(structuralLimit)return;
    const node:LogException={type:header.type,message:header.message,frames:[],relation:header.relation};
    if(!root){root=node;current=node;contexts.push({node,indent:header.indent});nodes++;hadHeader=true;if(header.relation)warnings.push('STACK_FRAGMENT: 원인/내부 예외 표식부터 시작한 불완전한 Stack Trace입니다.');return;}
    if(!hadHeader&&!header.relation){
      if(root.type&&root.type!==header.type)warnings.push('EXCEPTION_TYPE_CONFLICT: 구조화 타입과 Stack Trace의 타입이 다릅니다. 구조화 필드를 유지합니다.');
      root.type??=header.type;root.message??=header.message;hadHeader=true;return;
    }
    if(!header.relation){unknown=true;return;}
    if(nodes>=MAX_EXCEPTION_NODES||contexts.length>=MAX_EXCEPTION_DEPTH){warnings.push('STACK_LIMIT: 예외 중첩 분석 한도를 초과했습니다. 전체 원문은 보존했습니다.');unknown=true;structuralLimit=true;current=undefined;return;}
    let parent=current??root;
    if(header.relation==='suppressed'){
      while(contexts.length>1&&contexts.at(-1)!.indent>=header.indent)contexts.pop();
      parent=contexts.at(-1)?.node??root;(parent.suppressed??=[]).push(node);
    }else if(header.relation==='cause'){
      // Java causes at an ancestor indentation leave a suppressed subtree.
      while(contexts.length>1&&contexts.at(-1)!.indent>header.indent)contexts.pop();
      parent=contexts.at(-1)?.node??root;(parent.causeChain??=[]).push(node);
    }else{(parent.causeChain??=[]).push(node);innerParents.push(parent);}
    current=node;contexts.push({node,indent:header.indent});nodes++;hadHeader=true;
  }
  for(const raw of lines){
    if(!raw.trim())continue;
    // Exception.ToString may put the first inner header on the same line.
    const parts=raw.split(/\s+(?=--->\s)/);
    const header=exceptionHeader(parts[0]);
    if(header){acceptHeader(header);for(const part of parts.slice(1)){const inner=exceptionHeader(part);if(inner)acceptHeader(inner);else unknown=true;}continue;}
    const frame=stackFrame(raw);
    if(frame){if(structuralLimit)continue;if(!root){root={frames:[],incomplete:true};current=root;contexts.push({node:root,indent:0});warnings.push('STACK_FRAGMENT: 예외 선언 없이 프레임만 있는 Stack Trace입니다.');}(current!.frames??=[]).push(frame);continue;}
    if(stackMarker(raw)){
      const elided=raw.match(/\.\.\. (\d+) (?:more|common frames omitted)/);if(elided&&current)current.elidedFrames=Number(elided[1]);
      if(/End of inner exception/.test(raw)){const parent=innerParents.pop();if(parent){current=parent;while(contexts.length>1&&contexts.at(-1)!.node!==parent)contexts.pop();}else{unknown=true;warnings.push('STACK_FRAGMENT: 대응되는 내부 예외 시작 표식이 없습니다.');}}
      if(raw.includes('CIRCULAR REFERENCE'))warnings.push('STACK_CIRCULAR: 순환 예외 참조 표식은 원문으로 보존했습니다.');
      continue;
    }
    unknown=true;
  }
  if(!root)return {warnings};
  root.stackTrace=text;
  const pending=[root];let hasFrame=false;
  while(pending.length){const node=pending.pop()!;hasFrame ||= !!node.frames?.length;pending.push(...node.causeChain??[],...node.suppressed??[]);}
  if(!hasFrame){root.incomplete=true;warnings.push('STACK_FRAMES_MISSING: 예외 타입은 확인되지만 기록된 프레임이 없습니다.');}
  if(unknown){root.incomplete=true;warnings.push('STACK_UNRECOGNIZED: 해석하지 못한 Stack Trace 구간은 원문으로 보존했습니다.');}
  return {exception:root,warnings:[...new Set(warnings)]};
}

export function structuredException(value:unknown):StackAnalysis {
  const warnings:string[]=[];let nodes=0;const visited=new Set<object>();
  function read(value:unknown,depth:number):LogException|undefined {
    if(value===null||value===undefined)return;
    if(depth>=MAX_EXCEPTION_DEPTH||nodes>=MAX_EXCEPTION_NODES){warnings.push('EXCEPTION_LIMIT: 구조화 예외 중첩 분석 한도를 초과했습니다. parsedFields 원문을 확인하세요.');return;}
    if(typeof value==='string'){nodes++;return {stackTrace:value};}
    if(typeof value!=='object'||Array.isArray(value))return;
    if(visited.has(value)){warnings.push('EXCEPTION_CIRCULAR: 순환 참조는 정규화하지 않았습니다.');return;}visited.add(value);nodes++;
    const object=value as Record<string,unknown>;
    const first=(keys:string[])=>{for(const key of keys)if(Object.hasOwn(object,key)&&object[key]!==null&&object[key]!==undefined)return object[key];};
    const string=(keys:string[])=>{const value=first(keys);return typeof value==='string'?value:undefined;};
    const exception:LogException={type:string(['type','Type','ClassName']),message:string(['message','Message']),stackTrace:string(['stackTrace','StackTrace','StackTraceString'])};
    const causes=first(['causeChain','cause','Cause','innerException','InnerException']);
    if(causes!==undefined){const children=Array.isArray(causes)?causes:[causes];exception.causeChain=children.map(child=>read(child,depth+1)).filter((child):child is LogException=>!!child);}
    const suppressed=first(['suppressed','Suppressed']);
    if(suppressed!==undefined){const children=Array.isArray(suppressed)?suppressed:[suppressed];exception.suppressed=children.map(child=>read(child,depth+1)).filter((child):child is LogException=>!!child);}
    if(!exception.type&&!exception.message&&!exception.stackTrace&&!exception.causeChain?.length&&!exception.suppressed?.length)warnings.push('EXCEPTION_FIELDS_MISSING: 알려진 구조화 예외 필드가 없습니다. parsedFields를 확인하세요.');
    return exception;
  }
  return {exception:read(value,0),warnings:[...new Set(warnings)]};
}

export function enrichException(exception:LogException):StackAnalysis {
  const warnings:string[]=[];let nodes=0;
  function visit(node:LogException,depth:number):LogException {
    nodes++;if(depth>=MAX_EXCEPTION_DEPTH||nodes>MAX_EXCEPTION_NODES){warnings.push('EXCEPTION_LIMIT: 예외 분석 한도를 초과했습니다.');return {...node,incomplete:true};}
    const result={...node,causeChain:node.causeChain?.map(child=>visit(child,depth+1)),suppressed:node.suppressed?.map(child=>visit(child,depth+1))};
    if(!node.stackTrace)return result;
    // Prefer explicit child fields to a second textual representation of a cause.
    const analysis=analyzeStack(node.stackTrace,{...result,causeChain:undefined,suppressed:undefined});
    warnings.push(...analysis.warnings);const parsed=analysis.exception??result;
    if(result.causeChain?.length)parsed.causeChain=result.causeChain;
    if(result.suppressed?.length)parsed.suppressed=result.suppressed;
    return parsed;
  }
  return {exception:visit(exception,0),warnings:[...new Set(warnings)]};
}
