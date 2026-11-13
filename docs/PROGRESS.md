# 개발 진행

현재 Phase: **Phase 7 성능 최적화 구현·정의된 Node 환경 자동 검증 완료** (2026-11-12).
다음 Phase: **Phase 8 UI/UX 및 내보내기**. 실제 브라우저 E2E·배포·저사양 환경 검증은 미완료다.

## 시작 상태와 범위

AGENTS.md, PROJECT.md, 이전 PROGRESS.md, DECISIONS.md, README.md 및 소스/Git을 비교했다. Phase 6 코드와 기록이 일치했고 기존 13개 파일·136개 테스트가 통과했다. main과 origin/main은 5af50f2로 같고 작업 트리는 깨끗했다. 이번 작업은 Phase 7만 구현했으며 커밋/푸시는 수행하지 않았다.

## 구현 내용

- 전용 파싱 Worker, 단일 활성 작업 큐, 실제 단계별 바이트 진행률, 취소/재시도 및 제한 시간
- 64 KiB 청크·fatal 스트리밍 UTF-8/UTF-16 BOM 디코더, CR/LF/CRLF와 Unicode/부분 행 보존
- 파일 전체 IIS #Fields 문맥 사전 스캔, JSON 문서 우선/배열 레코드 상태기계 및 실패 시 행 복구
- ILogger 다음 메시지·Java/.NET Stack Trace 상태를 청크 사이에 유지. 기존 공통 파서·예외/ID/시간대 정규화 재사용
- 원본 File/Blob과 분석 이벤트 분리. 512 KiB 이하 디코딩 캐시, 큰 원본의 제한된 미리보기
- 성공 시 해당 파일 결과/메타데이터 원자적 교체. 실패·취소 시 기존 결과 유지, 삭제/초기화 시 Worker 종료와 늦은 응답 차단
- 파일 50 MiB/원본 세션 64 MiB, 이벤트 파일 200,000/세션 250,000개, 행 1 Mi/레코드 2 Mi 문자 보호
- 추정 보관량 파일 640 MiB/세션 768 MiB 보호. 한도 초과는 명시적 PARSE_LIMIT 실패로 기록하고 결과를 몰래 자르지 않음
- 이벤트 검색 필드 WeakMap 재사용, 레벨 집계 단일 순회, 선택 이벤트 색인, 파일 결과 교체 시 반복 전체 필터 제거
- 파서 목록을 가벼운 모듈로 분리. Temporal과 실제 파싱 엔진은 Worker 번들로 이동
- 프로덕션 Worker를 Node worker_threads로 실행하는 테스트/측정 도구, 1/10/50 MiB 벤치마크

## 실제 검증 결과

- npm run typecheck: 통과
- npm run lint: 통과
- npm test: 15개 파일·162개 테스트 통과 (기존 기능 회귀 포함)
- npm run build: 통과, 메인 약 473 kB / gzip 154 kB, 파싱 Worker 약 189 kB. 기존 약 650 kB 경고 해소
- 모든 공개 샘플과 청크 1/2/3/7/31/65536 바이트에서 동기 기준 파서와 이벤트/원문/행/ID/진단/형식 이름 일치
- UTF BOM/문자 경계, CRLF/CR, JSON 같은 행의 여러 레코드·중첩·배열·깨진 문서 복구, 파싱 실패 원인 및 자원 한도 검증
- 실제 Worker 완료/진행률, 큐 직렬화·대기/실행 취소·늦은 응답·시작/유휴 제한·시작 실패 검증
- 원본 분리·큰 원본 미리보기·취소 후 기존 결과 보존/재시도·제거/초기화 중 응답 차단 검증
- Node 실측 1/10/50 MiB: 각각 1,023/10,230/51,150개 이벤트, 파싱 실패 0. 상세는 PERFORMANCE.md와 benchmarks/phase7.json

## 발견 및 해결한 문제

- IIS 문맥을 행 도착 시에만 판단하면 이전 행 해석이 바뀜 → 전체 사전 스캔
- JSON 배열을 행 단위로 자르면 원문 위치와 문서 우선순위가 달라짐 → 상태기계로 정확한 문자 오프셋 보존
- 재분석 완료 전 결과 교체/취소 후 늦은 커밋 위험 → 작업 토큰과 성공 시 교체
- 50 MiB 표준 합성 입력이 최초 512 MiB 추정 한도에 걸림 → 계산식/실제 RSS를 확인하고 파일 한도를 640 MiB로 조정. 실제 heap 보장으로 표현하지 않음
- 대형 원본 문자열 복제 및 DOM 렌더링 위험 → 원본 Blob 보관·512 KiB 미리보기
- 비동기 전환 후 기존 즉시 결과 테스트 → 실제 Worker 완료를 기다리며 동일 동작 검증

## 알려진 제약 / 미완료

- 벤치마크는 Windows x64/Node 24/Ryzen AI 7 350의 합성 Spring 로그 단일 실행. 브라우저 성능/FPS·실제 로그 분포·저사양·동시 다중 대용량 보장 없음
- 50 MiB 메시지 전달 때 메인 heartbeat 간격 약 112 ms. 일반 검색·필터·집계·추적·결과 복제는 메인 스레드에 남아 큰 결과에서 멈춤 가능
- 추정 보관량은 경험적 보호 값이며 RSS/heap 하드 상한이 아님. 특히 구조화 필드/문자열·예외 트리/GC·분석 색인에 따라 증가
- 짧은 행이 많은 파일/긴 단일 행/거대한 JSON 레코드는 파일 바이트 한도 전에도 거절. 임의 절단/정보 생성 없음
- 사전 스캔 + 파싱의 두 번 읽기, 깨진 JSON 후보는 복구를 위한 추가 읽기 가능
- 브라우저 E2E·시각/모바일/접근성·IANA 환경 호환성 실측·Pages 배포는 미검증
- 이전 설치에서 npm moderate 10건 보고. 상세 재감사/강제 의존성 변경은 이번 범위에 포함하지 않음

## 변경 파일

- 파싱: src/core/parsing/{policy,stream-reader,stream-parser,json-stream,parse-blob,worker-client,finalize}.ts, text.ts, parsers.ts, parser-catalog.ts, zone-validation.ts
- Worker/상태/모델: src/workers/parse.worker.ts, src/stores/workspace.ts, src/types/log.ts
- UI/검색: src/app/App.tsx, FileParserSettings.tsx, src/core/search.ts
- 테스트: streaming.test.ts, parse-worker.test.ts, node-parse-worker.ts, setup.ts 및 기존 workspace/App/trace-ui/correlation 회귀 테스트
- 도구/설정: scripts/*, .gitignore, eslint.config.js, package.json, package-lock.json (0.7.0)
- 문서: README.md, PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md, PERFORMANCE.md, benchmarks/phase7.json

## 다음 작업

Phase 8: Dark/Light, 반응형·패널 크기·접근성·오류 안내, 명시적 CSV/JSON 및 분석 리포트 내보내기. 사용자 지시 후 진행한다. 실제 브라우저 Worker/UI 확인은 미완료 항목으로 유지한다.
