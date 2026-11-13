export const levels = ['TRACE','DEBUG','INFO','WARN','ERROR','FATAL','UNKNOWN'] as const;
export type LogLevel = typeof levels[number];
export interface StackFrame { className?: string; methodName?: string; fileName?: string; lineNumber?: number; module?: string; raw: string }
export interface LogException {
  type?: string; message?: string; stackTrace?: string; frames?: StackFrame[];
  causeChain?: LogException[]; suppressed?: LogException[];
  relation?: 'cause'|'inner'|'suppressed'; elidedFrames?: number; incomplete?: boolean;
}
export interface LogEvent {
  id: string; sourceFileId: string; sourceFileName: string;
  lineStart: number; lineEnd: number; timestamp: number | null;
  rawTimestamp?: string; timezone?: string; level: LogLevel;
  service?: string; host?: string; thread?: string; logger?: string;
  requestId?: string; traceId?: string; spanId?: string; correlationId?: string;
  customId?: string; correlationScope?: string;
  serviceSource?: 'log'|'file-setting'; timeSource?: 'log'|'format'|'file-setting'; assumedTimezone?: string;
  message: string; exception?: LogException; rawText: string;
  parsedFields: Record<string, unknown>; parserId: string; parseWarnings?: string[]; parseErrors?: string[];
}
export type ParserChoice = 'auto'|'spring'|'java-pattern'|'dotnet'|'serilog'|'json'|'iis'|'generic';
export type IdentifierKind = 'requestId'|'traceId'|'correlationId'|'spanId'|'customId';
export type MappingField = 'timestamp'|'level'|'message'|IdentifierKind;
export interface ParseOptions { parser?: ParserChoice; fieldMapping?: Partial<Record<MappingField,string>>; timezone?:string; serviceName?:string; correlationScope?:string }
export interface LogInput { text: string; fileId: string; fileName: string }
export interface LogParser { id: Exclude<ParserChoice,'auto'>; name: string; detect(sample: string): number; parse(input: LogInput, options?: ParseOptions): LogEvent[] }
export interface SourceFile { id: string; name: string; size: number; status: 'reading'|'done'|'error'|'cancelled'; parser?: string; parserChoice?: ParserChoice; fieldMapping?: ParseOptions['fieldMapping']; timezone?:string; serviceName?:string; correlationScope?:string; color?:string; count: number; warnings: number; failures?: number; duration?: number; error?: string; encoding?: string; directives?: number; phase?:'queued'|'scan'|'parse'|'fallback'; progress?:number; estimatedBytes?:number; originalAvailable?:boolean; levelCounts?:Record<LogLevel,number> }
