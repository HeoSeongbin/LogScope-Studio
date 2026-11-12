# 개발 진행

현재 Phase: **Phase 4 Stack Trace 및 Exception 분석 구현·자동 검증 완료** (2026-11-12).
다음 Phase: **Phase 5 통계 및 시계열 분석**. 실제 브라우저·Pages 배포·대용량 성능 검증은 완료 처리하지 않았다.

## 시작 상태 확인

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 현재 소스·Git을 비교했다. Phase 3 구현과 문서가 일치했고 시작 시 기존 7개 파일/66개 테스트가 통과했다. Git main은 Phase 3 커밋 1e7c9cd까지 로컬에 있고 origin/main보다 1개 커밋 앞선 상태, 작업 트리는 깨끗했다. 이번 작업은 Phase 4로 제한했으며 새 커밋/푸시는 수행하지 않았다.

이력: Phase 0·1 기반/업로드 → Phase 2 다중 포맷 파서(44e7b2f 게시) → Phase 3 검색/필터/가상 스크롤(1e7c9cd 로컬 커밋) → Phase 4 예외 분석.

## 구현 내용

- LogException 확장: frames, causeChain, suppressed, relation, elidedFrames, incomplete. StackFrame에 실제 class/method/file/line/module 및 raw 보존
- 공통 후처리에서 Java/.NET 예외 선언·프레임·원인/내부/억제 예외·생략 표식 병합
- Java Caused by/Suppressed, 모듈 프레임, Native Method/Unknown Source, ... N more 지원
- .NET 한 줄/여러 줄 ---> 내부 예외, 종료 표식 뒤 부모 프레임, 소스 파일·줄 번호 지원
- 자동 모드에서 단순 `timestamp ERROR|WARN|FATAL message` 뒤의 확실한 Stack Trace도 지원
- 정상 INFO 완료 이벤트·새 로그 헤더·새 root 예외·빈 줄·일반 텍스트·JSON/IIS 오류 경계에서 병합 중단
- 단독 예외/프레임 조각에는 없는 시간·서비스·Logger·심각도·예외 타입을 만들지 않고 UNKNOWN/null 및 진단 유지
- 원본 텍스트를 재구성하지 않고 전체 source 범위로 잘라 rawText/lineStart/lineEnd 유지. LF/CRLF/CR와 마지막 무개행 보존
- JSON/Serilog 예외 문자열의 type/message/frames 추출. 명시적 Type/ClassName/Message/StackTrace/InnerException/cause/suppressed 필드와 중첩 구조 지원, parsedFields 원형 유지
- 중첩 깊이 16·노드 128 한도. 초과 내용은 원문/parsedFields에 보존하며 잘못된 노드로 프레임을 옮기지 않음
- 보수적 fingerprint: 타입·메시지·주요 5개 프레임 위치·모듈·서비스·Logger·cause/suppressed 구조. 동적 문자열/숫자/줄 번호 임의 제거 없음
- 해석하지 못한 중첩 원문과 한도 초과 입력도 fingerprint에서 구분. canonical 전체 키로 그룹화하고 짧은 해시 충돌에 의존하지 않음
- Exception Analyzer 화면: 현재 검색 결과의 그룹·실제 반복 건수·확인 가능한 첫/마지막 UTC 시각·미확인 시각 건수·파일/서비스·대표 Stack Trace·관련 원본 선택
- 상세에서 예외/내부/억제 트리·프레임과 전체 원문 확인. 같은 fingerprint를 같은 장애 원인으로 확정하지 않는 안내
- Java 반복 예외, .NET 내부 예외, 불완전 예외 가상 샘플 3종 및 샘플 선택 UI 추가

## 실제 검증 결과 (2026-11-12)

- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm test`: **9개 파일·93개 테스트 통과**
- `npm run build`: 통과. 기존 검색 Worker도 별도 asset으로 생성
- 기존 66개 테스트를 포함. 그중 Phase 1/2의 임시 비병합 동작을 기대하던 2개는 Phase 4 병합·원본/ILogger 메타데이터 보존을 확인하도록 변경했으며 새 동작 검증을 강화함
- 실제 Java 샘플: 19줄 → 3개 이벤트, 동일 예외 2회 → 1개 그룹, 첫/마지막 시각·원문 범위 확인
- 실제 .NET 샘플: 14줄 → 3개 이벤트. inline/multiline 내부 예외와 종료 후 부모 프레임 소유 확인
- 경계/CRLF/탭/무개행/독립 root/누락 타입/정상 INFO 비병합/Generic override/JSON·IIS 격리 검증
- 원인·억제 트리, explicit JSON 필드 우선, 중복 원인 표현 비중복, 깊이 초과 원문 보존 검증
- fingerprint의 타입/메시지/위치/서비스/Logger 차이, 파일 간 반복, 동일 이벤트 중복 집계 방지, 누락 시각 분리, HTTP 500 비예외 검증
- Node File 실제 업로드·Generic/Spring 재분석·파일 제거 후 그룹 정리, sources 원문 불변 검증
- jsdom UI: 예외 분석 이동, 2회 반복·시각·원본 줄 범위·원인/억제 트리 확인, 검색·레벨 필터 공유, Explorer 복귀, 샘플 선택 검증
- 실제 브라우저 E2E·레이아웃/접근성 시각 검사·Pages 배포·대용량·청크 스트리밍은 **미검증**

## 발견 및 해결한 문제

- 기존에는 Stack Trace 각 행을 FORMAT_UNRECOGNIZED로 보존했음 → 확실한 예외 구간만 정상 이벤트로 병합하고 해당 폴백 진단 제거
- 임의 인접 정상 로그에 예외를 붙일 위험 → 외부 예외 문맥 결합은 ERROR/WARN/FATAL 및 연속 원본 줄에만 허용, INFO 뒤 단독 예외는 별도 이벤트
- .NET 내부 종료 뒤 프레임이 inner에 남을 위험 → 부모 스택을 관리해 원래 부모로 복귀
- 분석 깊이를 넘은 프레임이 이전 노드로 들어갈 위험 → 초과 구간은 정규화 중단, 원문 보존 및 경고
- 일부 해석 실패/중첩 한도 때문에 서로 다른 예외가 같은 fingerprint가 될 위험 → 미해석 부분과 한도 초과 원문도 키에 포함

## 알려진 제약 / 미완료

- 텍스트 예외 타입 자동 인식은 Exception/Error/Throwable로 끝나는 식별자에 한정. 다른 커스텀 이름·지역화 .NET 종료 표식·일부 AggregateException 전용 출력/다중 행 메시지는 보수적으로 별도 원문/진단 처리
- 빈 줄/불명확한 일반 텍스트/인터리브 로그는 경계로 처리하므로 실제 한 예외도 조각으로 나뉠 수 있음. 임의 연결하지 않음
- Generic 수동 선택은 의도적으로 행 단위를 유지. JSON/IIS 수동 모드는 외부 텍스트 행을 병합하지 않음
- 프레임의 공통 생략 개수는 기록하되 누락된 프레임을 만들어 복원하지 않음. 기록된 프레임이 없다고 실제 스택이 반드시 잘렸다고 단정하지 않음
- 그룹은 root 이벤트 단위이며 cause/suppressed를 별도 발생 건수로 중복 집계하지 않음. 서로 다른 파일의 같은 텍스트는 각각 실제 입력 이벤트로 집계
- 그룹/관련 이벤트 목록은 50개 페이지, 구조 상세 프레임은 노드별 처음 100개 표시. 전체 원문은 확인 가능
- 현재 분석은 메인 스레드·전체 입력 기반. 파일당 2 MiB/세션 8 MiB 한도 유지. 스트리밍 상태 및 청크 경계 불변성은 Phase 7에서 실제 검증
- Phase 3 정규식 입력/실행/강조 한도, 가상 행 높이, 시간 필터 정책은 유지 (ADR-012~014)
- 이전 npm audit 개발 도구 moderate 10건은 미해결 이력. 이번 의존성 추가/변경 및 감사 재실행 없음

## 변경 파일

- 모델/파서: src/types/log.ts, src/core/parsers.ts, src/core/parsing/json.ts
- 신규 엔진: src/core/exceptions/stack.ts, merge.ts, groups.ts
- UI: src/app/App.tsx, ExceptionAnalyzer.tsx, ExceptionDetails.tsx, src/style.css
- 샘플: public/samples/spring-exception.log, dotnet-exception.log, incomplete-exception.log
- 테스트: src/tests/exceptions.test.ts, exception-ui.test.tsx, parsers.test.ts, phase2.test.ts, workspace.test.ts
- 문서: README.md, docs/PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md
- 버전: package.json/package-lock.json → 0.4.0 (의존성 변경 없음)

## 다음 작업

Phase 5: 레벨/서비스/파일 통계, 시간대별 차트, 기간 필터 연계, 상위 예외 및 오류 집중 구간, Dashboard 고도화. null 시각·실제 관측값·예외/HTTP 오류 구분과 기존 원본/검색/분석 회귀 테스트를 유지한다.
