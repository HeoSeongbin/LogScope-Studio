export function validateZoneInput(zone:string){
  const value=zone.trim();if(!value)return;
  if(value.length>128)throw new Error('시간대는 128자 이내로 입력하세요.');
  if(/^[+-]\d{2}:\d{2}$/.test(value)){
    if(Number(value.slice(1,3))<=23&&Number(value.slice(4))<=59)return;
  }else try{new Intl.DateTimeFormat('en-US',{timeZone:value});return;}catch{/* report below */}
  throw new Error('유효한 IANA 시간대 또는 고정 오프셋을 입력하세요. 예: Asia/Seoul, UTC, +09:00');
}
