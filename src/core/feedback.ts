import type { SourceFile } from '../types/log';
export const parsePhaseNames:Record<NonNullable<SourceFile['phase']>,string>={queued:'분석 대기',scan:'원본 스캔',parse:'이벤트 분석',fallback:'행 단위 복구'};
export function recoveryHint(message:string){
  if(/PARSE_LIMIT|EXPORT_LIMIT|한도|제한.*MiB/.test(message))return '파일을 나누거나 파일·기간·레벨 조건을 좁혀 다시 시도하세요.';
  if(/Worker|제한 시간|45초|5초|3분/.test(message))return '최신 브라우저에서 다시 시도하세요. 계속 실패하면 파일을 나눠 분석하세요.';
  if(/encoding|encoded|UTF|TEXT_BINARY|바이너리|압축/i.test(message))return 'UTF-8 또는 BOM이 있는 UTF-16 텍스트로 변환한 파일을 추가하세요.';
  return '입력과 파일 설정을 확인한 뒤 다시 시도하세요. 자세한 파싱 진단은 이벤트 상세에서 확인할 수 있습니다.';
}
