import type { LogEvent } from '../types/log';

export function formatEvent(event:LogEvent):string {
  try{return JSON.stringify(event,null,2);}
  catch{return '중첩이 너무 깊어 정규화 데이터를 표시할 수 없습니다. 원본 로그를 확인하세요.';}
}
