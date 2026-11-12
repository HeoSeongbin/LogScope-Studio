# 개발 진행

현재 Phase: **Phase 6 다중 파일 및 요청 추적 구현·자동 검증 완료** (2026-11-12).
다음 Phase: **Phase 7 성능 최적화**. 실제 브라우저·Pages 배포·대용량/스트리밍 검증은 완료 처리하지 않았다.

## 시작 상태 확인

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 실제 소스·Git을 확인했다. Phase 5 코드와 기록이 일치했고 기존 11개 파일/115개 테스트가 통과했다. main은 Phase 3·4·5 로컬 커밋으로 origin/main보다 3개 앞섰으며 작업 트리는 깨끗했다. 이번에는 Phase 6만 구현하고 새 커밋/푸시는 수행하지 않았다.

이력: Phase 2 44e7b2f 게시 → Phase 3 1e7c9cd → Phase 4 b504c6c → Phase 5 1f5c9a5 로컬 커밋 → Phase 6 요청 추적.

## 구현 내용

- Request/Trace/Correlation/Span ID를 서로 구분해 실제 명시적 필드/이름 있는 key-value에서만 추출
- Spring MDC bracket에서 식별자를 읽되 Thread와 혼동하지 않도록 분리, Java 패턴의 명시적 MDC bracket 지원
- .NET/Serilog/Generic 첫 로그 헤더의 명시적 ID key-value 지원. Stack Trace 자식 행에서 다른 ID를 빌리지 않음
- JSON 별칭·Correlation/Span/custom ID 수동 매핑, own property 경로 및 배열 인덱스 경로 지원. 숫자를 ID로 강제 변환하지 않음
- IIS #Fields에 실제 선언된 request-id/trace-id/cs(X-Request-ID) 등 custom ID 컬럼 지원. HTTP 상태/IP를 ID로 추정하지 않음
- 같은 텍스트 타입의 여러 값이 충돌하거나 256자를 초과하면 ID를 선택/절단하지 않고 진단 보존
- 파일별 시간대/서비스명/식별자 연결 범위와 색상 설정. parser/JSON 매핑 변경 시 기존 파일 설정을 유지하고 빈 값으로 명시적 해제
- 시간대 없는 전체 날짜에만 사용자 IANA/고정 오프셋 적용. 원문 오프셋·실제 서비스·IIS UTC는 우선 보존
- Temporal polyfill 0.5.1로 DST 중복/누락 시각 reject. 잘못된 달력·부분 시각·날짜 부재를 임의 보정하지 않음
- serviceSource/timeSource/assumedTimezone로 로그/형식/파일 설정 근거를 분리. 원문·parsedFields 변경 없음
- 정확한 (ID 타입, 사용자 연결 범위, 값) 그룹. Span은 실제 Trace ID 문맥도 같아야 연결. 대소문자·다른 타입·범위를 임의 동치로 만들지 않음
- Request Trace Explorer: ID 타입/정확값 검색, 현재 공통 필터 또는 명시적 전체 세션, 서비스/파일별 관측 흐름, 오류 강조, 원본 선택
- 정규화 시각 순서와 동률 입력 순서, 미확인 시각의 별도 목록, 관측 간격만 계산하고 요청 처리시간/인과관계/완전한 Span 트리로 확정하지 않음
- 현재 검색이 pending/error여도 전체 세션 모드는 명시적으로 선택 가능. 선택했던 그룹 삭제 시 다른 ID로 몰래 대체하지 않음
- 가상 distributed-api.log / distributed-db.log 샘플 2종 추가

## 실제 검증 결과 (2026-11-12)

- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm test`: **13개 파일·136개 테스트 통과**, 기존 115개 회귀 포함
- `npm run build`: 통과. Temporal 추가로 메인 chunk 약 650 kB / gzip 약 206 kB, 500 kB 기준 경고 발생. 경고 한도를 높여 숨기지 않았음
- 실제 API 샘플 6줄 → 4개 이벤트, DB 샘플 5줄 → 3개 이벤트. req-demo-001은 파일 간 6개 이벤트
- DB 파일 UTC·서비스 설정 후 해당 요청의 시간순 5개 + 미확인 시각 1개, 최초~최종 관측 간격 4030ms, ERROR 2개. 누락/다른 request ID를 생성하지 않음
- MDC/Java/.NET/JSON/IIS 명시적 ID·충돌·긴 값·숫자·중첩 스택 비상속·타입/범위/대소문자 분리·Span Trace 문맥 검증
- 파일 IANA/고정 오프셋, 원문 오프셋 우선, IIS UTC, DST 중복/누락 거절, invalid zone/calendar, 부분/누락 시각 검증
- Node File 실제 업로드·재분석·설정 유지/해제·무효 설정 원자적 거절·색상 변경 시 이벤트 불변·제거·초기화 검증
- jsdom Trace Explorer의 파일 간 목록·시각 분리·원본 위치·ID 타입/정확값·전체 세션·공통 필터·설정 오류/적용·선택 그룹 삭제 검증
- 실제 브라우저 E2E·시각/모바일/접근성·IANA 환경 호환성 실측·Pages 배포·대용량/청크 경계 성능은 **미검증**

## 발견 및 해결한 문제

- 시간대 없는 로그를 파일 간 비교할 수 없었음 → 명시적 사용자 시간대 설정과 근거 표시, DST ambiguity reject
- 원문 서비스와 사용자 라벨을 섞을 위험 → 실제 로그 필드 우선·누락 시 fallback·serviceSource 표시
- MDC bracket이 Thread로 잘못 파싱될 위험 → 명시적 ID bracket 분리, 문맥이 과도하면 Thread 미확인 진단
- ID가 같은 문자열이라는 이유로 다른 타입/범위를 합칠 위험 → typed/scoped tuple 및 Span의 실제 Trace 문맥
- Stack Trace 자식의 ID가 부모에 붙을 위험 → 첫 root 로그 헤더만 텍스트 추출
- 재분석에서 파일 설정이 사라질 위험 → 기존 옵션과 변경 옵션을 합쳐 원문에서 재파싱
- DST 실패 후 기존 시간대 미지정 경고가 부정확해질 위험 → 해당 경고를 실제 설정 해석 불가 진단으로 교체
- 잘못된 시간대 설정은 원문/기존 이벤트/파일 메타데이터를 바꾸지 않고 거절

## 알려진 제약 / 미완료

- 텍스트의 명시적 key:value/key=value와 지원 MDC 패턴만 읽음. 이름 없는 MDC 값/임의 UUID·숫자는 의미를 추정하지 않음
- 같은 ID의 재사용/시계 오차/부분 로그만으로 인과관계·완전한 요청 수명·Span parent 구조를 보장하지 않음
- ID 값은 case-sensitive exact match. 타입 사이 전이 연결이나 자동 aliasing 없음. 환경/테넌트가 다르면 사용자가 파일 연결 범위를 지정해야 함
- 사용자 지정 ID는 JSON 명시적 필드 매핑으로만 지원. arbitrary regex/code 실행 없음
- 파일 서비스명은 로그에 service가 없을 때만 적용. 시간대는 full date의 오프셋 없는 값에만 적용. 날짜 없는 시각·유효하지 않은 시각은 null 유지
- IANA 해석은 실행 환경의 Intl 시간대 데이터에 의존. 대표 DST 사례는 Node 자동 검증했지만 모든 지역/역사 시각·브라우저를 실측하지 않음
- 시간대 설정은 정규화 가정이며 원문 변경/자동 서버 시계 보정이 아님. UTC 통계 버킷과 실제 프로세스의 현지 일/DST 정책은 별개
- ID/시간순/미확인 목록은 각각 50개 페이지. 처음에는 목록의 첫 그룹을 표시하며 명시적으로 고른 그룹이 사라지면 재선택 안내
- 추적 결과 다운로드는 Phase 8의 내보내기 범위로 남김. 현재 지원한다고 표시하지 않음
- 파싱/ID 색인/타임라인 계산은 메인 스레드. 파일당 2 MiB/세션 8 MiB 보호 한도 유지, 메모리/성능 한도 미측정
- Temporal 도입 후 bundle 크기 경고가 있음. 코드 분할/파싱 Worker·스트리밍·성능 측정은 Phase 7
- npm 설치 시 moderate 10건 보고. 상세 재감사/강제 의존성 변경은 미실행

## 변경 파일

- 모델/파서: src/types/log.ts, src/core/parsers.ts, src/core/parsing/json.ts, text.ts, src/core/search.ts
- 신규 엔진: src/core/file-context.ts, src/core/correlation/identifiers.ts, trace.ts
- 상태/UI: src/stores/workspace.ts, src/app/FileParserSettings.tsx, TraceExplorer.tsx, App.tsx, src/style.css
- 샘플: public/samples/distributed-api.log, distributed-db.log
- 테스트: src/tests/correlation.test.ts, trace-ui.test.tsx, workspace.test.ts
- 문서: README.md, docs/PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md
- 의존성/버전: @js-temporal/polyfill 0.5.1, package.json/package-lock.json → 0.6.0

## 다음 작업

Phase 7: 파싱 Worker와 청크 디코더, 행·Stack 상태 유지/청크 불변성, 진행률/취소/늦은 응답 무시, 이벤트/메모리 한도·검색/집계 비용 및 번들 분할, 1/10/50 MB 실제 성능 측정. 기존 파서·예외·검색·통계·추적의 원본/ID/타임존 정확성을 회귀 검증한다.
