import type { LogEvent, LogLevel } from '../types/log';
export function filterEvents(events: LogEvent[], selected: LogLevel[], fileId: string) {
  return events.filter(event=>(selected.length===0 || selected.includes(event.level)) && (!fileId || event.sourceFileId===fileId));
}
