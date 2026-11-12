import { Temporal } from '@js-temporal/polyfill';
import type { LogEvent, ParseOptions } from '../types/log';

export function validateTimezone(zone:string){
  if(!zone.trim())return;
  if(zone.length>128)throw new Error('시간대는 128자 이내로 입력하세요.');
  try{Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone.trim());}
  catch{throw new Error('유효한 IANA 시간대 또는 고정 오프셋을 입력하세요. 예: Asia/Seoul, UTC, +09:00');}
}
export function applyFileContext(event:LogEvent,options:ParseOptions):LogEvent {
  const result={...event,parseWarnings:event.parseWarnings?.slice()};
  result.serviceSource=event.service!==undefined?'log':undefined;
  if(event.service===undefined&&options.serviceName?.trim()){result.service=options.serviceName.trim();result.serviceSource='file-setting';}
  if(options.correlationScope?.trim())result.correlationScope=options.correlationScope.trim();
  if(event.timestamp!==null){result.timeSource=event.parserId==='iis'?'format':'log';return result;}
  const zone=options.timezone?.trim();
  if(!zone||!event.rawTimestamp)return result;
  // Only a validated full date without an explicit log offset may be interpreted.
  const local=event.rawTimestamp.replace(' ','T').replace(',','.');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(local))return result;
  if(event.parseWarnings?.some(warning=>warning.startsWith('TIMESTAMP_INVALID:')))return result;
  result.parseWarnings=result.parseWarnings?.filter(warning=>!warning.startsWith('시간대 미지정:'));
  try{
    const exact=Temporal.PlainDateTime.from(local,{overflow:'reject'}).toZonedDateTime(zone,{disambiguation:'reject'});
    result.timestamp=exact.epochMilliseconds;result.timezone=zone;result.assumedTimezone=zone;result.timeSource='file-setting';
  }catch{(result.parseWarnings??=[]).push(`TIMEZONE_UNRESOLVED: ${zone} 설정으로 해석할 수 없는 시각입니다. DST 중복/누락 시각 또는 설정을 확인하세요.`);}
  return result;
}
