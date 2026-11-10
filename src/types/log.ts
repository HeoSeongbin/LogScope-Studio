export const levels = ['TRACE','DEBUG','INFO','WARN','ERROR','FATAL','UNKNOWN'] as const;
export type LogLevel = typeof levels[number];
export interface LogException { type?: string; message?: string; stackTrace?: string }
export interface LogEvent {
  id: string; sourceFileId: string; sourceFileName: string;
  lineStart: number; lineEnd: number; timestamp: number | null;
  rawTimestamp?: string; timezone?: string; level: LogLevel;
  service?: string; host?: string; thread?: string; logger?: string;
  requestId?: string; traceId?: string; spanId?: string; correlationId?: string;
  message: string; exception?: LogException; rawText: string;
  parsedFields: Record<string, unknown>; parserId: string; parseWarnings?: string[]; parseErrors?: string[];
}
export type ParserChoice = 'auto'|'spring'|'java-pattern'|'dotnet'|'serilog'|'json'|'iis'|'generic';
export type MappingField = 'timestamp'|'level'|'message'|'requestId'|'traceId';
export interface ParseOptions { parser?: ParserChoice; fieldMapping?: Partial<Record<MappingField,string>> }
export interface LogInput { text: string; fileId: string; fileName: string }
export interface LogParser { id: Exclude<ParserChoice,'auto'>; name: string; detect(sample: string): number; parse(input: LogInput, options?: ParseOptions): LogEvent[] }
export interface SourceFile { id: string; name: string; size: number; status: 'reading'|'done'|'error'; parser?: string; parserChoice?: ParserChoice; fieldMapping?: ParseOptions['fieldMapping']; count: number; warnings: number; failures?: number; duration?: number; error?: string; encoding?: string; directives?: number }
