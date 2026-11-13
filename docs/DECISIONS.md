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

## ADR-012 — Phase 3 필터와 검색 상태 (2026-11-12, 채택)

Zustand에 적용된 검색/필터만 보관하고 UI의 편집 초안과 분리한다. 검색 적용/Enter로 일괄 반영하며 검색 초기화는 검색·기간·Logger/Thread·정렬을 해제하고 기존 레벨/파일 필터는 유지한다. 세션 초기화는 모든 조건도 비운다. 원본 sources와 정규화 events를 변경하지 않고 파생 결과만 만든다. 키워드는 원문·메시지·Logger·Thread·서비스·Request ID·Trace ID·파일명에서 검색한다. 일반 검색은 공백 구분, 큰따옴표 구문, AND/OR, Unicode 대소문자 옵션을 지원한다. 일반 검색의 사용자 문자는 정규식 메타문자로 해석하지 않도록 escape한다.

기간 입력은 사용자의 호스트 시간대에 의존하는 datetime-local 대신 명시적 Z/오프셋 문자열을 받는다. 기존 시간 검증기를 공유하며 경계는 inclusive다. rawTimestamp만 있는 이벤트는 epoch를 만들지 않고 includeUntimed 옵션을 따른다. 시간순 정렬은 null을 맨 뒤에 두고 같거나 누락된 시각끼리는 원본 순서를 유지한다. 원본 순서 모드는 업로드 파일/이벤트의 기존 순서를 그대로 유지한다. Logger/Thread는 대소문자 비구분 부분 일치다.

## ADR-013 — 사용자 정규식의 검색 Worker 격리 (2026-11-12, 채택)

정규식 안전성을 패턴 사전 검사만으로 보장하지 않는다. 임의 사용자 정규식은 검색 전용 module Worker 안에서만 컴파일/실행하며 UI는 Worker.terminate() watchdog으로 취소한다. Worker 시작 제한 5초, ready 수신 후 전달·실행·결과 수신 제한 1초다. 오류·취소·완료·조건 변경/언마운트 시 종료하고 이전 작업의 응답은 수락하지 않는다. pending/error 상태에는 이전 검색 결과를 최신 결과로 보여주지 않는다. Worker 미지원/실행 실패 시 명확한 오류를 표시하고 일반 검색을 사용할 수 있다.

패턴 길이 256 UTF-16 코드 단위, 이벤트 검색 필드 합 128 Ki 문자, 전체 검색 필드 합 16 Mi 문자로 제한한다. 초과는 명시적 실패이며 잘라서 성공처럼 표시하지 않는다. Unicode u, 선택적 i, 내부 g만 사용한다. 정규식 모드는 AND/OR 대신 정규식 문법을 직접 따른다. zero-width 매치는 이벤트 포함에는 유효하지만 강조할 문자가 없으므로 범위를 만들지 않고 다음 Unicode 코드 포인트로 진행한다.

강조 범위도 Worker에서 계산해 메인 스레드에서 정규식을 재실행하지 않는다. 텍스트 노드와 mark 태그로 렌더링하며 원문은 변경하지 않는다. 필드별 최대 100개, 정규식 전체 20,000개 강조 범위만 생성한다. 강조 제한이 일치 ID 목록을 자르지 않는다. Worker가 응답한 현재 결과만 사용하며 삭제/초기화 뒤 이전 이벤트 배열 참조도 해제한다.

이것은 Phase 3 ReDoS 격리이며 Phase 7의 스트리밍 파싱·Worker 전환과 구분한다. 실행 제한은 브라우저 타이머 기반 best effort다. 백그라운드 탭의 타이머 지연이나 저메모리 브라우저까지 실시간 자원 한도를 보장한다고 주장하지 않는다. 검색 필드 복사 비용은 기존 파일 한도 안에서 감수한다.

근거: [MDN Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate), [MDN RegExp.exec 및 zero-width 주의사항](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec).

## ADR-014 — 고정 높이 가상 목록 (2026-11-12, 채택)

새 의존성 없이 순수 범위 계산기와 네이티브 스크롤을 사용한다. 62px 행, 434px viewport, 앞뒤 overscan 5로 렌더링 범위를 계산하고 나머지는 접근성 트리에서 제외한 spacer로 표현한다. 메시지는 한 줄로 제한하고 원문 전체는 상세에 둬 높이를 안정적으로 유지한다. aria-rowcount/aria-rowindex를 제공하고 스크롤 영역은 키보드 초점을 받을 수 있다. 조건·정렬·파일 변경 시 범위 컴포넌트를 재생성해 맨 위부터 표시한다. 가변 높이 확장과 실제 브라우저 스크롤/접근성 검증은 별도 과제로 남긴다.

## ADR-015 — 원본 위치를 보존하는 예외 후처리 (2026-11-12, 채택)

Phase 4는 각 파서의 기본 토큰화 뒤 공통 normalizeExceptions 단계를 적용한다. 파서 인터페이스의 저수준 parse 결과와 앱이 사용하는 parseLog 최종 결과를 구분한다. 예외 선언·frame·Caused by/Suppressed/--->·생략/종료 표식이 연속한 범위만 합친다. 새로운 구조화 이벤트 헤더, 새 root 예외, 빈 줄, 임의 일반 텍스트, JSON/IIS 실패 행은 경계다. 인접 ERROR/WARN/FATAL 문맥에만 외부 trace를 붙이며 정상 INFO 뒤에서는 독립 이벤트로 남긴다. 자동 모드의 단순 timestamp+severity 헤더도 Stack Trace가 바로 이어질 때만 문맥으로 읽는다. 수동 Generic은 행 단위 원문을 유지한다.

merge.ts는 최초 이벤트 ID/메타데이터를 보존하고 input.text의 원본 줄 오프셋으로 rawText를 잘라낸다. 중간 CRLF/CR/LF와 전체 줄 범위를 유지한다. 독립 trace에는 기록되지 않은 timestamp/Logger/서비스/레벨을 상속하지 않는다. 독립 예외는 severity=UNKNOWN이고 type/프레임 부재는 undefined다. 성공적으로 분석된 trace 행의 기존 폴백 오류만 해제하며 다른 구문/데이터 진단은 지우지 않는다.

## ADR-016 — Java/.NET 예외 트리와 분석 한도 (2026-11-12, 채택)

기본 LogException에 실제 frames/causeChain/suppressed/relation/elidedFrames/incomplete를 추가한다. Java는 들여쓰기와 cause/suppressed 표식을, .NET은 inner parent 스택과 종료 표식을 사용한다. 프레임 생략 표식은 개수만 기록하며 실제 frame을 만들어 넣지 않는다. 한 줄 .NET inner와 여러 줄 inner를 같은 구조로 읽는다. 타입 추론은 식별자 끝이 Exception/Error/Throwable인 선언에 제한한다. 구조화 JSON의 명시적 Type/ClassName/Message/StackTrace/InnerException/cause/suppressed 필드는 우선 보존하며 문자열 스택을 다시 읽어 중복 child를 만들지 않는다. 모든 원래 JSON 필드는 parsedFields에 남는다.

중첩 16단계·128노드 한도를 둔다. 초과 구간은 원문/parsedFields에 그대로 두고 정규화 한도 경고를 표시한다. 초과 프레임을 가장 최근의 정상 노드에 잘못 붙이지 않는다. 불완전/타입 충돌/해석 불가 구간은 명시적 진단을 기록한다. frames가 없다는 사실은 기록의 관측 상태일 뿐 로그 절단이나 장애 원인의 확정이 아니다. 파서 상태의 스트리밍 유지와 청크 경계 테스트는 Phase 7까지 미검증이다.

형식 확인에 사용한 1차 자료: [Oracle Throwable.printStackTrace](https://docs.oracle.com/en/java/javase/26/docs/api/java.base/java/lang/Throwable.html), [Microsoft Exception.ToString](https://learn.microsoft.com/en-us/dotnet/api/system.exception.tostring?view=net-10.0), [Microsoft reference source Exception](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/exception.cs).

## ADR-017 — 보수적 fingerprint와 파생 예외 그룹 (2026-11-12, 채택)

canonical JSON tuple 전체를 v1 fingerprint 키로 사용한다. root 타입·메시지, 주요 5개 frame의 class/method/file/line/module, 생략 개수, cause/suppressed 구조, 실제 서비스·Logger를 포함한다. 메시지 숫자/UUID·파일 위치/줄 번호·모듈 버전을 임의 정규화하지 않는다. 짧은 해시만으로 그룹을 합치지 않는다. 미해석 노드의 raw stack과 분석 한도 초과 이벤트의 rawText도 포함해 정보가 부족하다는 이유로 다른 입력을 합치지 않는다. 동적 값이 다르면 그룹이 나뉘는 보수적 tradeoff를 택한다.

현재 필터 결과에서 useMemo로 그룹을 계산한다. root 이벤트 ID당 1회만 집계하며 같은 내용이 다른 파일에서 관측되면 각각 1회다. cause/suppressed는 root의 구조이며 별도 발생 횟수로 중복 집계하지 않는다. 첫/마지막은 실제 정규화 epoch의 min/max이고 null 시각 이벤트 수를 따로 제공한다. 관련 이벤트 순서는 현재 검색 결과의 순서를 따른다. 파일 제거/재분석/초기화는 events 변경을 통해 자동 반영된다. 같은 fingerprint는 유사한 기록일 뿐 같은 장애 원인을 보장하지 않는다고 UI에 표시한다.

## ADR-018 — 실제 이벤트 기반 독립 통계 (2026-11-12, 채택)

Phase 5는 현재 공통 검색/기간/레벨/파일 필터의 결과를 순수 aggregateStatistics에 전달한다. 동일 이벤트 ID는 첫 관측 한 번만 집계하며, 같은 내용이라도 다른 파일 ID의 이벤트는 별개다. ERROR/FATAL 비율은 해당 레벨의 이벤트 수 / 전체 결과 이벤트 수다. 빈 입력의 비율은 null이며 UI에서 —로 표시한다. 시간 미확인 이벤트도 전체 분모에 포함한다. HTTP 4xx/5xx는 parserId=iis의 유효 sc-status만 읽고 severity나 Exception으로 변환하지 않는다. root 예외 이벤트만 1회 집계하며 cause/suppressed를 발생 수에 더하지 않는다. 세 지표는 겹칠 수 있으므로 합계로 읽지 않도록 표시한다.

서비스/Logger가 없으면 null로 집계하고 UI에서만 미기록 안내한다. 임의 서비스명이나 환경을 만들지 않는다. 파일은 이름이 아닌 sourceFileId로 구분한다. 차원 표는 현재 결과에 이벤트가 있는 그룹만 표시한다. ERROR/FATAL 상위 메시지는 실제 message/service/logger 조합을 사용하고 동적 값을 제거하지 않는다. 상위 예외는 기존 Phase 4 fingerprint 정책을 재사용한다. 파생 통계는 useMemo로 계산하고 별도 영구 저장하지 않는다.

## ADR-019 — UTC 버킷과 관측 기준 구간 (2026-11-12, 채택)

1분/5분/1시간/1일은 epoch 기준 floor(timestamp/duration)로 정렬하고 [start,end)로 집계한다. 이전 Phase의 전체 기간 필터는 inclusive를 유지하므로 종료 시각이 버킷 경계에 정확히 걸리면 그 이벤트는 다음 버킷에 놓인다. 시간대 문자열이 달라도 같은 epoch면 같은 버킷이다. null/비정상 시각은 시간 차트에서 제외하고 전체 통계 및 미확인 건수로 남긴다. 일 단위는 UTC 고정 24시간이며 현지 일/DST를 가정하지 않는다.

현재 결과의 최소~최대 관측 버킷 사이의 빈 구간만 0건으로 채운다. 오늘이나 임의 분석 기간까지 확장하지 않는다. 0은 입력에 이벤트가 없다는 뜻이며 실제 서비스가 정상이라는 증거가 아니다. 버킷 2,000개 초과/날짜 표현 범위 초과는 명시적으로 실패하며 조용히 잘라내거나 해상도를 바꾸지 않는다. 집계 오류가 있으면 집중 구간도 계산하지 않았다고 알린다.

집중 구간은 선택 지표 건수≥최소 건수 AND 선택 지표/버킷 전체≥최소 비율로 정의한다. 기본은 ERROR+FATAL 3건·30%이고 사용자가 바꿀 수 있다. 관측 건수 내림차순·동률 UTC 시작순으로 상위 10개를 표시한다. 이는 이상치 탐지나 장애 원인 확정이 아니다. 차트/표/집중 구간에서 구간을 선택하면 실제 그 구간에 속한 현재 결과 이벤트와 레벨 분포를 보여준다.

## ADR-020 — 로컬 차트와 접근 가능한 데이터 표 (2026-11-12, 채택)

PROJECT.md의 시각화 스택에 맞춰 Chart.js 4.6.1과 react-chartjs-2 5.3.1을 설치하고 lockfile에 고정했다. 공식 가이드에서 peer 호환성(Chart.js v4)과 현대 브라우저 Canvas 지원을 확인했다. 필요한 scale/element/plugin만 등록한다. category 축과 직접 계산한 UTC ISO 라벨을 사용해 추가 날짜 adapter와 호스트 시간대 해석을 피한다. 차트는 애니메이션 없이 로컬 데이터를 그리며 외부 API/CDN을 호출하지 않는다.

Canvas의 수치와 동일한 데이터 표·버킷 선택 버튼을 제공한다. 필드 라벨과 로그는 React 텍스트 또는 Canvas 텍스트로 렌더링하며 HTML 삽입하지 않는다. 서비스 차트/메시지/예외 상위 목록의 표시 한도를 명시하고 표는 페이지로 조회한다. 순수 차트 데이터 변환은 unit test, UI 연결은 Canvas wrapper mock을 사용한 jsdom test로 검증했다. 실제 브라우저 Canvas 페인팅·반응형/접근성·배포는 아직 미검증이다.

확인한 1차 자료: [Chart.js integration](https://www.chartjs.org/docs/latest/getting-started/integration), [Chart.js browser support](https://www.chartjs.org/docs/latest/developers/), [react-chartjs-2 official repository](https://github.com/reactchartjs/react-chartjs-2).

## ADR-021 — 사용자 파일 문맥과 로그 근거 분리 (2026-11-12, 채택)

parseLog의 공통 예외 후처리 뒤 파일 문맥을 적용한다. 실제 service가 있으면 유지하고, 없을 때만 사용자가 입력한 serviceName으로 보완하며 serviceSource=file-setting을 남긴다. 시간대도 timestamp가 null이고 검증된 전체 rawTimestamp에 오프셋이 없을 때만 사용한다. 명시적 로그 오프셋과 IIS UTC는 우선한다. timeSource=log/format/file-setting 및 assumedTimezone를 기록해 가정과 원문을 분리한다. 원문과 parsedFields는 변경하지 않는다.

IANA와 고정 오프셋은 @js-temporal/polyfill 0.5.1로 처리한다. PlainDateTime.from overflow=reject와 toZonedDateTime disambiguation=reject를 사용해 DST 중복/누락 시각을 앞뒤 시각으로 몰래 옮기지 않는다. 부분 시각/날짜 부재는 복원하지 않는다. timezone은 128자 이내이며 invalid setting은 재분석 전에 거절한다. 설정 해석 실패는 null+TIMEZONE_UNRESOLVED로 남긴다. IANA 규칙은 런타임 Intl 데이터에 의존하며 대표 사례 외 브라우저/역사 데이터는 미검증이다.

파일 재분석은 기존 옵션과 명시적 변경을 합쳐 sources에서 수행한다. 빈 문자열로 가정을 해제할 수 있다. 오류가 나면 기존 events/metadata는 보존한다. 파일 색상은 SourceFile의 장식 메타데이터이며 이벤트 근거/추적 ID로 사용하지 않는다. 색상 변경은 재파싱하지 않는다.

확인한 1차 자료: [Temporal polyfill package](https://github.com/js-temporal/temporal-polyfill/blob/main/package.json), [Temporal ZonedDateTime disambiguation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html), [Temporal cookbook](https://tc39.es/proposal-temporal/docs/cookbook.html).

## ADR-022 — 명시적 식별자와 typed/scoped 연관 (2026-11-12, 채택)

텍스트는 root 로그 헤더의 이름 있는 key:value/key=value만 읽고 nested exception의 ID를 부모에 부여하지 않는다. 지원 키는 requestId/request_id/request-id/x-request-id, traceId/trace_id/trace-id, correlationId/correlation_id/correlation-id/x-correlation-id, spanId/span_id/span-id다. JSON은 실제 필드 별칭 또는 사용자 매핑 경로를 사용한다. 매핑은 own property 및 배열 인덱스만 탐색한다. IIS는 #Fields에 선언된 같은 의미의 custom 컬럼과 cs(X-Request-ID)만 사용한다. HTTP 상태·IP·이름 없는 UUID를 요청 ID로 추정하지 않는다. 텍스트 ID 충돌/256자 초과는 진단하고 자동 선택/절단하지 않는다. JSON 문자열은 보존하며 숫자를 문자열 ID로 강제 변환하지 않는다.

키는 canonical tuple (kind, file-scope, trace-context, value)다. Request/Trace/Correlation/custom은 trace-context=null이고 Span은 실제 traceId도 문맥에 포함한다. 값의 대소문자나 타입 사이 관계를 임의 동치로 만들지 않는다. 사용자 scope는 파일 설정이며 로그에 없는 환경을 추정한 값이 아니다. 기본 scope가 같아도 실제 ID 재사용 가능성은 UI에서 안내한다. 동일 이벤트 ID는 한 번만 집계하고 다른 파일의 같은 내용은 별개 관측이다.

## ADR-023 — 관측 타임라인과 검색 범위 (2026-11-12, 채택)

Request Trace Explorer는 기본적으로 공통 필터 결과를 사용하며 전체 세션은 체크박스로 명시적으로 선택한다. 전체 모드는 검색/기간/레벨/파일 조건을 무시한다고 안내한다. 필터 pending/error 상태를 빈 결과처럼 표시하지 않는다. ID는 정확 일치로 검색하고 목록/시간순/미확인 목록은 50개 페이지로 표시한다. 명시적으로 선택한 그룹이 삭제되면 다른 ID로 몰래 바꾸지 않는다.

유효한 정규화 시각만 stable sort로 시간축에 놓고 동률은 입력 순서를 유지한다. 미확인 시각은 별도 목록이다. 서비스 라벨은 실제 값 또는 명시적 파일 설정으로 표시한다. 이전 관측과의 간격·최초~최종 관측 간격만 계산하며 요청 처리시간/인과관계로 확정하지 않는다. 시계 오차·로그 누락·ID 재사용·parent/span 경계 부재를 안내하며 Span ID만으로 완전한 추적 트리를 만들지 않는다. 기존 검색/통계/예외 엔진은 새 정규화 이벤트를 그대로 재사용한다. 내보내기는 Phase 8에 남긴다.

## ADR-024 — 청크 불변 파싱과 Worker 수명 (2026-11-12, 채택)

전체 문자열을 메인 스레드에서 파싱하던 방식을 64 KiB Blob.slice + TextDecoder stream/fatal과 전용 Worker로 전환한다. 전체 IIS #Fields 문맥과 JSON 문서 우선순위가 기존 의미에 영향을 주므로 사전 스캔 후 파싱한다. 유효하지 않은 JSON 문서 후보는 추측한 일부 배열 결과를 버리고 행 단위 복구로 다시 읽는다. 한 번 읽기보다 I/O가 늘지만 원문·진단·레코드 우선순위를 지킨다.

행의 CR/CRLF·UTF 문자·ILogger 다음 행·예외 스택·JSON 문자열/배열 상태를 청크 사이에 유지한다. JSON 레코드는 실제 원문 slice와 UTF-16 문자 오프셋 기반 ID를 보존한다. 기존 텍스트/JSON/IIS 파서 및 예외/ID/Temporal 문맥 해석을 공유한다. 동기 parseLog는 기준/테스트용으로 남고 제품 UI에서는 호출하지 않는다. 가벼운 parser-catalog와 시간대 입력 검증을 분리해 메인 번들에 파싱 엔진/Temporal을 싣지 않는다.

작업마다 Worker를 만들되 활성 작업은 하나로 제한한다. 준비 5초, 무응답 45초, 전체 3분 제한 및 사용자 취소 시 terminate한다. 메인 스레드 동기 fallback은 없다. 성공·실패·취소 모두 핸들러/타이머/Worker를 정리한다. 파일별 작업 토큰으로 제거/초기화/새 재분석 뒤의 늦은 응답을 무시한다. 재분석 성공 시에만 기존 이벤트/옵션을 교체한다. 단계별 바이트 진행률은 scan/parse/fallback 읽기 비율이며 전체 완료율로 표시하지 않는다.

참조: [Vite Worker](https://vite.dev/guide/features#web-workers). 실제 브라우저 E2E는 별도 미검증이다.

## ADR-025 — 원본 보관 및 자원 보호 (2026-11-12, 채택)

원본 File/Blob은 별도 메모리 Map에 보존한다. 전체 디코딩 문자열 캐시는 512 KiB 이하에 한정하고 큰 파일 원본 보기는 처음 512 KiB만 디코딩한다. 분석 이벤트의 rawText/원본 위치는 보존한다. 서버 전송과 브라우저 영구 저장은 추가하지 않는다. 제거/초기화 시 참조와 작업을 정리하되 GC 시점은 보장하지 않는다.

파일 50 MiB/세션 원본 64 MiB, 파일 이벤트 200,000/세션 250,000, 행 1 Mi 문자/레코드 2 Mi 문자, 추정 보관량 파일 640 MiB/세션 768 MiB 보호를 적용한다. 임의 이벤트 절단 대신 PARSE_LIMIT로 해당 파일 실패를 기록한다. 초기 512 MiB 추정치는 50 MiB 표준 벤치마크를 거절했으므로 실제 RSS와 추정식을 확인해 640 MiB로 조정했다. 경험식은 실제 heap/RSS 상한이 아니며 단일 Worker/원본 제한과 함께 보수적 보호로 사용한다. 결과 전달과 메인 분석 단계의 일시 복제는 여전히 존재한다.

검색 필드는 이벤트 객체를 키로 하는 WeakMap에 캐시해 불변 이벤트의 반복 필드 배열 생성을 줄인다. 기존 필터/집계 useMemo를 유지하고 레벨별 반복 전체 순회를 한 순회로 바꾸며 선택 ID 색인과 파일별 교체 그룹을 재사용한다. 필터/집계를 전부 Worker로 옮겼다고 표시하지 않는다. 성능 완료 기준은 docs/PERFORMANCE.md의 정의된 Node 환경과 입력으로 한정하며 원시 측정을 함께 남긴다.

## ADR-026 — 분석 데이터 내보내기와 표시용 안전성 (2026-11-13, 채택)

새 의존성 없이 Blob/브라우저 다운로드 API를 사용한다. JSON은 schemaVersion=1의 metadata/rows, CSV는 exportKind/exportContext와 고정 컬럼, HTML은 범위·요약과 선택 데이터 전체의 정적 리포트다. HTML을 선택한 이유는 브라우저에서 로컬 열람 가능하고 PDF 엔진/서버가 필요 없기 때문이다. 원본 파일 바이트 복사가 아닌 분석 결과임을 표시한다. timestamp의 null, 필드 부재, rawText, 파싱 진단, 사용자 시간대/서비스 설정 근거를 보존하며 보고서 생성 시각을 로그 시각으로 넣지 않는다.

대상은 현재 필터/명시적 전체 세션/필터 내 예외 그룹/선택 예외/선택 typed-scoped 추적/현재 버킷 크기의 UTC 통계다. 화면의 상위·페이지 한도로 데이터를 자르지 않는다. 전체/개별 이벤트/전체 추적을 선택하면 적용하지 않은 공통 필터를 metadata에 남기지 않는다. 이벤트 밖의 요약과 파일 설정은 context/summary에 분리한다. 필터 pending/error 및 파싱 중의 대상은 비활성화하고 선택 예외가 없으면 해당 대상도 비활성화한다.

CSV는 모든 셀을 quote하고 내부 따옴표를 두 번 쓰며 BOM/CRLF로 출력한다. 공백/제어문자 뒤의 =,+,-,@와 전각 변형, 선행 tab/CR/LF에 작은따옴표 접두사를 추가한다. 원본/JSON은 바꾸지 않는다. CSV에서 null/누락/빈 문자열은 구별하지 못하고 이 보호 접두사는 표시값을 바꾼다. 스프레드시트별 동작·재저장 후 보편적 수식 방어를 보장하지 않는다. 정확한 재사용에는 JSON을 안내한다. 근거: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

HTML은 사용자 문자열을 텍스트 이스케이프하고 default-src none / base-uri none / form-action none CSP를 사용한다. 리포트 자체 정적 CSS만 허용한다. 로그를 innerHTML로 실행하거나 외부 URL/이미지/스크립트로 만들지 않는다. 원문·파일명·식별자·검색 조건이 포함될 수 있다는 경고를 다운로드 컨트롤에 상시 제공하며 자동 마스킹을 주장하지 않는다.

## ADR-027 — 내보내기 한도와 취소/정리 (2026-11-13, 채택)

원본 이벤트 50,000개·출력 UTF-8 32 MiB 한도를 파일 업로드 한도와 별개로 둔다. JSON/HTML escape·CSV 중첩 필드로 원본보다 커질 수 있으므로 실제 TextEncoder 바이트로 합산한다. 초과는 EXPORT_LIMIT 전체 실패이며 일부만 완료 처리하지 않는다. 문자열 전체 결합 대신 바이트 청크를 Blob parts로 모으고 100행마다 제어를 양보한다. 데이터 준비와 개별 큰 레코드 직렬화는 여전히 메인 스레드이며 완전 무정지/메모리 하드 상한을 보장하지 않는다.

AbortController와 범위 revision으로 취소·범위/버킷/선택/파일 변경·언마운트 후 늦은 결과를 버린다. 임시 anchor는 즉시 제거하고 object URL은 다운로드 요청 후 1초 뒤 revoke한다. 앱 상태 알림은 브라우저 다운로드 요청 성공이지 디스크 저장 검증이 아니다. UI 테마와 너비도 메모리 상태만 사용하며 로그/설정/다운로드를 localStorage 등으로 자동 저장하지 않는다.

## ADR-028 — 반응형 테마와 키보드 조작 (2026-11-13, 채택)

기존 Dark 팔레트를 CSS 변수로 옮기고 Light 대체 팔레트 및 Chart.js 축/범례 색상을 제공한다. 파일/레벨의 의미·파싱 엔진은 바꾸지 않는다. 상세 너비는 네이티브 range input의 포인터/키보드 조작을 사용해 260~560px로 제한한다. 1150px 이하에서는 단일 열 상세 배치, 모바일 메뉴는 가로 스크롤하고 현재 활성 화면도 계속 노출한다.

본문 skip link, nav/region 라벨, focus-visible, 상태 알림, 가상 목록 방향키/Page/Home/End를 추가한다. 모바일 실제 viewport 높이를 반영해 마지막 행까지 이동한다. jsdom 동작 검증과 실제 브라우저 390px 배치·테마/Canvas·다운로드 스모크를 수행했다. 전체 WCAG 적합성/스크린리더/브라우저별 키보드 동작을 검증했다고 주장하지 않는다.
