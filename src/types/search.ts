export interface SearchOptions { query: string; mode: 'literal'|'regex'; caseSensitive: boolean; operator: 'AND'|'OR' }
export interface ExplorerFilters { from: string; to: string; includeUntimed: boolean; logger: string; thread: string; sort: 'source'|'oldest'|'newest' }
export type MatchRange = [number,number];
export interface SearchRow { id: string; fields: string[]; message: string }
export interface SearchResult { ids: string[]; messageRanges: Record<string,MatchRange[]>; rawRanges?: Record<string,MatchRange[]>; highlightLimited?: boolean }
export const defaultSearch: SearchOptions={query:'',mode:'literal',caseSensitive:false,operator:'AND'};
export const defaultFilters: ExplorerFilters={from:'',to:'',includeUntimed:true,logger:'',thread:'',sort:'source'};
