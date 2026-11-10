# 개발 진행

현재 Phase: **Phase 2 다중 포맷 파서 구현 및 자동 검증 완료** (2026-11-11).
다음 Phase: **Phase 3 로그 검색 및 필터**. 실제 브라우저·배포 검증은 완료 처리하지 않았다.

## 시작 상태 확인

AGENTS.md, PROJECT.md, 기존 PROGRESS/DECISIONS, README와 소스·테스트를 비교했다. Phase 0·1 구현 상태와 기록이 일치했다. 작업 전 기존 3개 파일/11개 테스트가 통과했다. 폴더는 여전히 Git 저장소가 아니며 커밋/원격 게시를 수행하지 않았다. PROJECT.md의 최초 실행 제한은 최초 작업에 적용되었고 이번 후속 지시로 Phase 2를 진행했다.

## 완료된 작업

기존 Phase 0·1 기능(React/TypeScript strict/Vite/Tailwind/Zustand, 다중 파일 업로드, Spring/Generic, 필터, 원본 상세, UTF 처리, 제거/초기화, Pages workflow)을 유지했다.

Phase 2:

- 형식별 파서 분리: Logback/Log4j2 일반 패턴, ILogger SimpleConsole/한 줄, Serilog 텍스트, JSON/Serilog JSON, IIS W3C
- 자동 모드의 행별 혼합 형식 판별과 수동 모드의 엄격한 파서 선택
- 파일별 형식 변경·원본 기반 재분석 및 JSON 필드 매핑
- JSON Lines/NDJSON, 여러 줄 단일 객체, 배열 요소별 원본 범위 추적
- JSON 원본 필드/중첩 데이터·실제 식별자·구조화 예외 필드 보존 (추적/예외 분석 기능은 아님)
- IIS #Fields 컬럼 순서/재선언 처리, HTTP 필드 보존, UTC 정규화
- 실패 행 원문·줄 번호·코드/이유 보존, 파일별 실패 및 경고 이벤트 수 분리
- 원본 sources와 분석 events 분리, 원본 보기, 재분석 시 해당 파일만 교체·다른 파일 보존
- 잘못된 날짜 자동 보정 방지, 날짜 없는 시각 unresolved, 깊은 JSON 상세 표시 보호
- 가상 샘플 6종 추가, ADR-008~011 및 아키텍처/README/테스트 문서 갱신

## 실제 검증 결과

- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm test`: 4개 파일, **41개 테스트 통과** (기존 11개 포함)
- `npm run build`: 통과, Vite 정적 산출물 생성
- 실제 public 샘플 6종 업로드 결과: Logback 2, ILogger 3, Serilog text 2, Serilog JSON 3, JSONL 5, IIS 4개 이벤트
- JSONL/IIS 샘플의 의도적인 손상 행은 각각 실패 1건으로 보존되며 뒤의 유효 데이터는 계속 분석
- 레벨 별칭, 혼합 형식, ILogger CRLF 경계, JSON 배열의 같은 줄 고유 ID·줄 범위, 명시적 매핑/누락, 원형 필드 보존, 잘못된 달력/오프셋, IIS 컬럼 재선언/중복 선언/누락/개수 불일치 검증
- Node File 기반 실제 업로드/파일별 재분석/원문 불변/다른 파일 보존/제거/초기화 테스트
- React Testing Library/jsdom에서 기존 ERROR 필터/상세 및 신규 형식 선택/매핑 적용/원본 보기 검증
- 브라우저 E2E, 화면 시각 검사, 스크린샷, Pages 실제 배포, 성능 벤치마크: 미실행

## 발견 및 해결한 문제

- 기존 Date.parse 사용은 잘못된 달력 날짜를 자동 보정할 수 있었음 → 달력/윤년/시간/오프셋 사전 검증으로 null+경고 유지
- 초기 형식 감지는 하나의 파서를 파일 전체에 적용했음 → 자동 모드 행별 디스패치로 혼합 파일 보존
- 수동 재분석에 사용할 전체 원본 저장소가 없었음 → 메모리 sources 분리 및 파일별 삭제 연동
- 깊게 중첩된 JSON이 상세 JSON.stringify에서 실패할 수 있음 → 원문 안내로 안전하게 폴백
- 구현 중 ESLint의 불필요한 정규식 escape 지적 1건 수정 후 전체 검사 재실행

## 알려진 제약 / 미완료

- 임의의 Logback/Log4j2/NLog/Serilog 커스텀 출력 템플릿 전체를 지원하지 않음. 지원 패턴은 README에 명시
- Stack Trace 병합/fingerprint는 Phase 4. ILogger 첫 메시지 경계 처리와 혼동하지 않음
- JSON 숫자 레벨/Unix timestamp 단위를 추정하지 않음. 깨진 다중 행 JSON은 행 단위로 보존·복구하며 임의 재구성하지 않음
- 소수 초 원문은 최대 9자리, 내부 시간은 밀리초까지만 정규화
- 파일별 읽기 상태만 제공하며 백분율 진행률/실제 취소는 미구현
- 파일당 2 MiB/세션당 8 MiB 보호 한도, 원본+이벤트 메모리 보관, 메인 스레드 파싱. 이벤트 수/메모리 한도 및 스트리밍은 Phase 7
- 수동 인코딩·시간대 설정, 브라우저 호환성 실측, 실제 배포 미검증
- 이전 npm audit의 개발 도구 minimatch 경로 moderate 10건은 미해결 이력. 이번에는 의존성 변경/감사 재실행 없음

## 다음 작업

Phase 3: 시간 범위/키워드/정규식 검색, Logger/Thread 필터, 검색 강조, 가상 스크롤 및 상세 UI 고도화. 정규식 검색은 격리·실행 제한 설계를 먼저 검토한다. 기존 Phase 2 샘플과 회귀 테스트를 유지한다.

## 이번 작업의 생성·수정 파일

- 파서/모델: src/types/log.ts, src/core/parsers.ts, src/core/parsing/common.ts, src/core/parsing/text.ts, src/core/parsing/json.ts, src/core/parsing/iis.ts, src/core/format.ts
- 상태/UI: src/stores/workspace.ts, src/app/App.tsx, src/app/FileParserSettings.tsx, src/style.css
- 테스트: src/tests/phase2.test.ts, src/tests/workspace.test.ts, src/tests/App.test.tsx
- 샘플: public/samples/logback.log, dotnet-normal.log, serilog-text.log, serilog.jsonl, structured.jsonl, iis-access.log
- 문서: README.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/ARCHITECTURE.md, docs/TEST-CASES.md
- 버전 메타데이터: package.json, package-lock.json (0.2.0, 의존성 추가/변경 없음)

PROJECT.md와 AGENTS.md의 기존 요구사항은 변경하지 않았다.

## Git 저장소 연결 (2026-11-11)

사용자 요청으로 로컬 main 브랜치를 초기화하고 origin을 https://github.com/HeoSeongbin/LogScope-Studio.git 에 연결했다. 저장소별 작성자는 HeoSeongbin <heosb316@gmail.com>으로 설정했다. 원격은 최초 조회 시 비어 있었다. Phase 2 구현을 첫 커밋으로 게시한다. GitHub Actions 및 Pages 배포 성공은 별도 검증 대상이다.
