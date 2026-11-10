# Architecture Decision Records

## ADR-001 — 파서와 UI 분리 (2026-11-11, 채택)
`LogParser`는 detect와 parse를 제공한다. Spring Boot 기본 텍스트 패턴을 먼저 감지하고 Generic으로 폴백한다. 입력·결과는 직렬화 가능한 타입이며 후속 Worker의 메시지 경계로 옮길 수 있다. Phase 1은 작은 입력을 동기 파싱한다. 비동기 iterable/Worker 전환은 Phase 7이다.

## ADR-002 — 원본 및 정규화 모델 (채택)
PROJECT.md의 공통 LogEvent 필드를 기준으로 sourceFileId와 1-based lineStart/lineEnd를 연결한다. 이벤트 ID는 파일 세션 UUID와 줄 번호 조합이다. 원문은 재구성하거나 trim하지 않는다. CRLF/LF/CR 구분자는 이벤트 rawText에 포함하지 않으며 실제 File은 수정하지 않는다. 미인식 행은 개별 Generic 이벤트와 경고로 보존한다. 빈 행을 보존하고 마지막 줄 구분자는 추가 빈 이벤트를 만들지 않는다. Stack Trace 병합과 상세 frames/causeChain 모델 구현은 Phase 4다.

## ADR-003 — 시간 정책 (채택)
오프셋이 있는 시간만 epoch로 정규화한다. 시간대 없는 값은 rawTimestamp만 표시하며 timestamp=null과 경고를 제공한다. 파일별 시간대 및 엄격한 날짜 유효성 검사는 후속 Phase이다. 호스트 시간대에 의존하지 않는다.

## ADR-004 — 메모리 및 상태 (채택)
Zustand 메모리에만 파일 메타데이터와 이벤트를 저장한다. 원본 File 객체는 읽기 후 보관하지 않는다. 자동 저장과 네트워크 업로드가 없다. 제거/초기화 뒤 도착한 읽기 결과는 파일 ID 존재 여부로 무시한다. 파일당 2 MiB, 세션당 8 MiB는 성능 보증이 아닌 Phase 1의 임시 보호 한도다. 목록은 100건 페이지 방식이며 가상 스크롤은 Phase 3, 스트리밍·취소·이벤트 개수 제한은 Phase 7에서 검증한다.

## ADR-005 — 인코딩 및 보안 (채택)
UTF-8 기본과 UTF-16 LE/BE BOM을 지원하고 fatal TextDecoder로 손상을 명시적으로 실패 처리한다. 추측 기반 레거시 감지는 하지 않는다. EUC-KR/수동 선택은 미구현이다. 바이너리/압축 확장자와 NUL은 거절한다. React의 텍스트 렌더링을 사용하고 HTML 삽입과 사용자 코드 실행을 금지한다. 정규식 검색은 Phase 3에서 격리·시간 제한 설계를 적용한 후 제공한다.

## ADR-006 — 향후 분석 및 배포 (설계)
예외 fingerprint는 type·주요 frame·service/logger를 사용하고 원문과 정규화 fingerprint를 구분한다. 식별자 타입을 분리하며 시간순 관계를 인과관계로 주장하지 않는다. 통계는 실제 이벤트에서만 계산한다. Hash 기반 또는 단일 페이지 경로를 사용해 Pages 새로고침을 지원한다. Phase 1은 단일 화면과 상대 base 경로를 사용한다.

## ADR-007 — 라이브러리 검토 (2026-11-11)
Node 24.12 환경. Vite 공식 가이드의 Node 지원 범위, Tailwind 공식 Vite 플러그인 설치 경로, Zustand 공식 상태 관리 문서를 확인했다. 실제 npm 버전은 package-lock.json에 고정한다. 최신 Chromium/Firefox/Safari의 File.arrayBuffer, TextDecoder, crypto.randomUUID를 전제로 하며 브라우저별 호환성 실측은 미완료다.

- https://vite.dev/guide/
- https://tailwindcss.com/docs/installation/using-vite
- https://zustand.docs.pmnd.rs/learn/getting-started/introduction
- https://vitest.dev/guide/

## ADR-008 — Phase 2 형식별 디스패치 및 진단 (2026-11-11, 채택)

Phase 2는 사용자 후속 지시에 따라 진행한다. 자동 모드에서는 문서 전체가 유효한 JSON이면 먼저 구조화하고, 그 외에는 Spring → Java Pattern → ILogger → Serilog Text → JSON 후보 → IIS 컨텍스트 → Generic 순으로 행을 판별한다. 한 파일의 첫 매치 형식을 전체 행에 강제하지 않는다. 파서별 detect 점수 인터페이스는 유지하되 혼합 파일의 동작은 명시적 패턴 매칭에 근거한다. 수동 선택은 선택 파서만 적용하고 실패 행은 Generic 이벤트로 남긴다.

Logback/Log4j2는 `time [thread] LEVEL logger - message` 및 `time LEVEL [thread] logger - message`를 지원한다. ILogger는 `level: Category[EventId] message`와 SimpleConsole의 6칸 들여쓰기 첫 메시지를 지원한다. 이 병합은 포매터 경계를 읽는 작업이며 Stack Trace 병합은 Phase 4에 남긴다. 임의의 커스텀 출력 템플릿을 지원한다고 주장하지 않는다.

구조 실패는 parseErrors의 코드+이유와 parseWarnings에 함께 보존한다. 시간대 부재·필드 매핑 누락·유효하지 않은 필드 값은 정상적으로 보존된 이벤트의 경고다. 파일 warnings/failures는 각각 해당 진단이 있는 이벤트 수이며, 로그 레벨 ERROR 건수와 구분한다. 미지원 Generic-only 파일은 실패로 간주하지 않는다.

## ADR-009 — 원본 보관과 파일별 재분석 (2026-11-11, 채택)

ADR-004를 확장한다. File 객체는 여전히 보관하지 않지만 디코딩한 원문 전체를 Zustand sources에 파일 ID로 보관한다. 정규화 이벤트와 별도 저장하며 네트워크/영구 저장은 사용하지 않는다. 이를 통해 W3C 지시문, JSON 구분자, 원문 줄 구분자를 포함한 원본 보기와 재분석을 제공한다. BOM은 TextDecoder 동작에 따라 제거되지만 입력 File 바이트를 변경하지 않는다.

재분석은 sources를 수정하지 않고 해당 파일 이벤트만 교체하며 기존 파일 순서·다른 파일 선택을 보존한다. 재분석한 파일의 선택 이벤트는 해제해 오래된 상세를 방지한다. 제거/초기화 시 원본도 해제한다. 원본과 이벤트의 중복 메모리 비용을 감수하고 기존 파일 한도를 유지한다. 수동 형식과 JSON 필드 매핑 설정만 제공하며 사용자 코드/정규식 실행은 추가하지 않는다.

## ADR-010 — JSON 및 Serilog 의미 보존 (2026-11-11, 채택)

JSON Lines/NDJSON, 단일 객체, JSON 배열을 지원한다. 배열 값의 원문 문자 범위와 줄 범위를 추적해 JSON.stringify 결과를 원본처럼 표시하지 않는다. 같은 줄에 여러 이벤트가 있으면 ID에 문자 오프셋을 포함한다. 객체가 아닌 배열 값은 실패 이벤트로 보존한다. 깨진 JSON 문서는 행별로 복구하며 유효 행은 계속 분석한다. 깨진 다중 행 JSON 구조를 임의 복원하지 않는다.

자동 필드 별칭과 파일별 timestamp/level/message/requestId/traceId 매핑을 제공한다. 직접 필드명을 우선하고 점 경로는 own property만 탐색한다. parsedFields에는 원래 객체와 중첩 필드를 그대로 보관한다. 명시적으로 매핑한 경로가 없을 때 다른 필드로 몰래 대체하지 않는다.

Serilog Compact의 생략된 @l은 CLEF 규약상 Information이다. 이것은 일반 JSON에는 적용하지 않으며 명시적 null도 기본값으로 대체하지 않는다. 메시지 템플릿은 렌더링하지 않고 경고와 함께 그대로 표시한다. 구조화 JSON의 exception 필드는 주어진 type/message/stackTrace만 매핑하고 예외 타입을 문자열에서 추측하거나 새로운 stack/cause 구조를 만들지 않는다.

## ADR-011 — IIS 컬럼과 시간 정확성 (2026-11-11, 채택)

IIS는 #Fields 선언 순서와 파일 도중의 재선언을 따른다. 비어 있거나 중복된 선언은 기존 컨텍스트를 지워 잘못된 해석을 방지한다. 선언 부재/컬럼 개수 불일치는 실패 사유와 원문을 보존한다. W3C 지시문은 원본 파일에서 확인할 수 있고 이벤트로 집계하지 않는다. HTTP 상태·time-taken·클라이언트 IP 등은 원래 이름과 값으로 parsedFields에 보존한다. HTTP 4xx/5xx를 애플리케이션 레벨 ERROR나 Exception으로 변환하지 않는다.

Microsoft IIS W3C 규약에 근거해 date+time은 UTC로 정규화한다. 일반 텍스트/JSON의 시간대 없는 값은 기존 null 정책을 유지한다. 달력(윤년 포함)·시분초·오프셋 범위를 검증해 Date.parse의 잘못된 날짜 자동 보정을 방지한다. 소수 초는 원문에 9자리까지 보존하고 epoch 밀리초는 3자리까지만 사용한다. 날짜 없는 Serilog 콘솔 시각은 원문만 표시한다. Unix 숫자 timestamp 단위와 임의 날짜 패턴은 추정하지 않는다.

형식 확인에 사용한 1차 자료:

- [Microsoft ILogger / Console 출력](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/logging/)
- [Microsoft IIS W3C 로그와 UTC 정책](https://learn.microsoft.com/en-us/iis/configuration/system.applicationhost/sites/site/logfile/)
- [Serilog Compact 형식 명세](https://github.com/serilog/serilog-formatting-compact)
- [Apache Log4j PatternLayout](https://logging.apache.org/log4j/2.x/manual/pattern-layout.html)
