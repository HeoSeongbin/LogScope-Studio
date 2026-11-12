# LogScope Studio

브라우저에서 로그를 읽고 탐색하는 React + TypeScript 워크스페이스입니다. 사용자 로그를 서버로 전송하거나 브라우저 저장소에 자동 저장하지 않습니다. **Phase 6 다중 파일·요청 추적까지 구현했으며 자동 검증을 통과했습니다.** 실제 브라우저 E2E와 배포 검증은 별도 미완료 항목입니다.

## 실행

Node.js 24 권장.

```sh
npm ci
npm run dev
```

## 사용 방법

1. 새 파일 로그 형식을 자동 감지 또는 특정 파서로 선택합니다.
2. 파일 선택이나 Drag & Drop으로 여러 로그를 추가합니다. 샘플 선택에서 Spring 기본/Java 반복 예외/.NET 내부 예외/불완전 예외를 고른 뒤 샘플 불러오기를 누르세요. 다른 형식의 가상 로그는 public/samples에 있습니다.
3. 왼쪽 파일 목록과 다중 레벨 버튼으로 결과를 필터링합니다. 레벨을 모두 해제하면 전체를 표시합니다.
4. 이벤트 메시지를 선택하면 원본 로그·원본 줄 범위·파서·정규화 필드·경고·파싱 실패 원인을 확인할 수 있습니다.
5. 왼쪽에서 파일을 선택하면 해당 파일의 인코딩·파서·결과 건수·실패 건수를 확인하고 로그 형식을 바꿔 재분석할 수 있습니다. 파일 원본 보기는 디코딩한 텍스트 전체를 표시합니다.
6. JSON 필드 매핑에서 Timestamp/Level/Message/Request ID/Trace ID의 필드명 또는 점 경로를 입력하고 적용합니다. 빈 값은 자동 매핑입니다. 예: `meta.when`, `body`, `Properties.RequestId`. 직접 필드명이 점 경로보다 우선합니다.

재분석은 원본 텍스트를 변경하지 않으며 해당 파일 결과만 교체합니다. 개별 파일 제거와 세션 초기화는 원본과 파생 이벤트를 함께 제거합니다.

## 검색과 필터 (Phase 3)

검색 양식은 **검색 적용** 또는 Enter로 반영합니다. 편집 중에는 적용된 이전 조건을 유지하고 변경 대기 상태를 표시합니다.

- 일반 문자열: `Database timeout`은 기본 AND 조건입니다. OR를 선택하면 어느 하나의 키워드와 일치해도 표시합니다. `"Request ready"`처럼 큰따옴표로 구문을 묶을 수 있습니다. 대소문자 구분은 선택 사항입니다.
- 검색 범위: 원문, 정규화 메시지, Logger, Thread, 서비스, Request ID, Trace ID, 파일명입니다. JSON의 다른 필드도 원문을 통해 검색합니다.
- 정규식: 검색 방식을 바꾼 뒤 `timeout|failed`처럼 슬래시 없이 입력합니다. 키워드 AND/OR 대신 정규식 자체의 문법을 따릅니다. Worker가 실행하고 진행·오류·취소를 표시합니다. 실패 시 검색 초기화 또는 일반 검색으로 복구할 수 있습니다.
- 기간: `2026-11-06T14:30:00+09:00` 또는 `2026-11-06T05:30:00Z`처럼 시간대를 포함합니다. 시작과 종료 경계를 모두 포함합니다. 시간대 없는 원문 로그의 시각을 임의로 정규화하지 않습니다.
- 정규화 시각 없는 이벤트 포함 옵션을 끄면 누락/모호한 시각 이벤트를 제외합니다. 시간순 정렬은 이런 이벤트를 맨 뒤에 두며, 같은 시각끼리는 원본 순서를 유지합니다.
- Logger/Thread는 대소문자 비구분 부분 일치입니다. 파일·레벨 필터와 함께 적용할 수 있습니다.
- 메시지와 원문 상세에서 일치 구간을 강조합니다. 정규식 강조도 Worker가 계산하며 로그를 HTML로 실행하지 않습니다. 결과에서 제외된 선택 이벤트의 상세를 계속 볼 경우 안내를 표시합니다.

목록은 가상 스크롤하며 가로 스크롤로 서비스·Thread·Logger·Request ID·소스 컬럼을 확인할 수 있습니다. 메시지 버튼 또는 행을 선택하면 원본 줄 범위와 정규화 데이터를 확인합니다. 긴 메시지 전체는 상세에서 읽습니다.

검색식 최대 256자, 일반 키워드 최대 16개입니다. 정규식은 이벤트별 검색 필드 합 128 Ki 문자·전체 16 Mi 문자 제한이며 초과 시 오류를 표시합니다. Worker 부팅은 5초, 준비 후 전달·실행·응답은 1초 watchdog으로 제한합니다. 느린 기기에서는 유효한 검색도 중단될 수 있습니다. 강조는 필드별 최대 100구간·정규식 전체 20,000구간이며 일치 결과 건수는 자르지 않습니다.

검색 초기화는 검색/기간/Logger/Thread/정렬만 초기화하고 기존 레벨·파일 필터는 유지합니다. 세션 초기화는 파일·원본·분석 결과·모든 조건을 제거합니다. 실제 브라우저 Worker/레이아웃 E2E는 미검증이며 Node Worker와 jsdom 테스트 통과와 구분합니다.

## Stack Trace 및 예외 분석 (Phase 4)

왼쪽 **예외 분석** 화면은 현재 검색·파일·레벨 조건에 포함된 예외를 그룹화합니다. Java 반복 예외 샘플은 19줄을 3개 이벤트로 읽고, 동일 예외 2회를 1개 그룹으로 표시합니다. 그룹이나 관련 이벤트를 선택하면 원본 파일·줄 범위·전체 로그와 원인/억제 예외 트리를 확인할 수 있습니다.

- Java: Exception/Error/Throwable 선언, at 프레임, Caused by, Suppressed, ... N more, 모듈·Native Method·Unknown Source
- .NET: 타입·메시지, 메서드·파일·줄, inline/multiline ---> 내부 예외 및 종료 후 부모 스택 복귀
- JSON/Serilog: 예외 문자열 분석과 명시적 Type/ClassName/Message/StackTrace/InnerException/cause/suppressed 매핑. 원래 중첩 필드는 parsedFields에 보존

새 로그 헤더·새 root 예외·빈 줄·일반 텍스트·JSON/IIS 경계에서 병합을 멈춥니다. 외부 trace는 바로 앞 ERROR/WARN/FATAL 문맥에만 연결하며 정상 INFO 이벤트 뒤에서는 독립 예외로 보존합니다. 자동 모드에서는 단순 timestamp+ERROR/WARN/FATAL 헤더와 그 뒤 trace도 읽습니다. Generic 수동 선택은 원래의 행 단위 탐색을 유지합니다.

Fingerprint는 예외 타입·메시지·주요 5개 프레임의 class/method/file/line/module·서비스·Logger·원인/억제 구조로 구성합니다. 동적 ID나 숫자·위치 정보를 임의로 지우지 않아 유사한 오류도 별도 그룹으로 나뉠 수 있습니다. 일부 미해석/한도 초과 구간은 원문도 키에 포함합니다. 동일 fingerprint가 동일 장애 원인임을 뜻하지 않습니다.

첫/마지막 발생 시각은 확인 가능한 epoch에서만 계산하고 정규화 시각이 없는 건수를 따로 표시합니다. root 이벤트 하나를 1회로 세며 cause/suppressed를 추가 발생으로 중복 집계하지 않습니다. ERROR 레벨이나 HTTP 500만 있는 이벤트는 Exception으로 만들지 않습니다. 파일 제거·재분석·초기화는 그룹에도 반영됩니다.

예외 타입은 텍스트에서 Exception/Error/Throwable 접미사가 있는 선언만 자동 인식합니다. 프레임이 없는 예외나 선언 없는 프레임은 불완전한 입력으로 안내하고 없는 정보를 만들지 않습니다. 공통 생략 프레임을 복원하지 않으며, 원문 줄 구분자와 전체 lineStart/lineEnd를 유지합니다. 목록은 그룹·이벤트별 50개 페이지, 상세 프레임은 노드별 처음 100개를 표시하고 전체 원문도 제공합니다. 스트리밍·청크 경계 처리는 Phase 7에서 별도 검증할 예정입니다.

## Dashboard 및 Timeline (Phase 5)

왼쪽 **Dashboard**와 **Timeline**은 기존 검색·기간·레벨·파일 조건을 공유합니다. 상단의 전체 세션 요약과 달리 분석 화면의 수치는 현재 결과를 기준으로 합니다. 샘플 선택의 **오류 집중 구간**으로 12개 가상 이벤트를 불러올 수 있습니다.

Dashboard는 전체 결과 수, ERROR+FATAL, WARN, INFO, 오류 비율, root 예외 수, IIS HTTP 4xx/5xx, 시각 유무와 관측 UTC 범위를 표시합니다. 시간 추이·레벨 분포·서비스 오류 차트, 상위 ERROR/FATAL 메시지/예외 그룹, 예외 타입과 서비스/파일/Logger별 표를 제공합니다. 파일별 통계의 이름을 누르면 해당 파일의 Explorer로 이동하고 상위 오류·예외를 누르면 대표 원본을 확인합니다.

**오류 비율 = (ERROR + FATAL) / 전체 결과 이벤트**입니다. 예외와 HTTP 상태는 독립 지표이며 서로 겹칠 수 있으므로 합산하지 않습니다. 원인/내부 예외는 root 이벤트와 별개 발생으로 중복 집계하지 않습니다. 동일 ID만 중복 제외하며 같은 내용이 다른 파일에서 관측되면 별개 입력으로 셉니다. 서비스/Logger 누락은 실제 분석 값으로 채우지 않고 미기록 그룹으로 안내합니다.

시간 차트는 UTC 기준 **1분/5분/1시간/1일**을 선택합니다. [시작, 종료) 버킷이며 전체 기간 필터는 기존처럼 양끝을 포함합니다. 정규화 시각이 없는 이벤트는 전체 통계에는 포함하고 차트에서는 제외해 건수를 따로 보여줍니다. 관측 시각 사이의 빈 구간은 0건이지만 실제 서비스가 정상이라는 증거는 아닙니다. 버킷이 2,000개를 넘으면 오류를 표시하므로 더 큰 버킷이나 좁은 기간을 선택하세요.

**오류 집중 구간**은 지표(ERROR+FATAL / HTTP 5xx / 예외), 최소 건수, 버킷 전체 대비 최소 비율을 선택합니다. 기본 3건·30%이며 상위 10개를 표시합니다. 선택 기준을 만족하는 관측 구간이지 장애 원인이나 통계적 이상치 판정이 아닙니다. 차트 포인트·데이터 표·집중 구간 버튼을 선택하면 그 구간의 실제 이벤트와 레벨 분포를 확인하고 원본을 열 수 있습니다.

시간 차트에는 동일한 데이터 표와 키보드로 누를 수 있는 구간 버튼을 제공합니다. 서비스 차트는 전체 이벤트 수 상위 10개 서비스이며 상위 메시지/예외도 각각 10개, 타입 표는 20개입니다. 서비스/파일/Logger 표는 20개 페이지, 버킷 표는 50개 페이지입니다. 현재 결과에 이벤트가 없는 업로드 파일은 집계 표에 나타나지 않습니다.

Canvas 차트는 Chart.js/React 래퍼를 로컬 번들에서 사용하며 외부 서버나 CDN으로 로그를 보내지 않습니다. 순수 집계·차트 데이터와 jsdom UI는 자동 검증했지만 UI 테스트는 Canvas wrapper를 mock합니다. 실제 Canvas 페인팅·브라우저 차트 클릭·반응형·Pages E2E는 미검증입니다. 일 단위 버킷은 UTC 24시간이며 현지 시간대/DST를 가정하지 않습니다.

## 다중 파일과 요청 추적 (Phase 6)

왼쪽 **요청 추적**에서 Request/Trace/Correlation/Span/사용자 지정 ID를 고르고 값을 정확히 검색합니다. 빈 검색은 실제 관측된 ID 목록을 보여줍니다. 대소문자까지 일치해야 하며 다른 ID 타입을 같은 값이라는 이유로 연결하지 않습니다. 연결 키는 ID 타입·파일 연결 범위·값이고 Span은 실제 Trace ID 문맥도 같아야 합니다.

기본은 현재 검색·기간·레벨·파일 조건입니다. **전체 세션에서 추적**을 명시적으로 선택하면 공통 조건을 무시하고 모든 파일에서 찾습니다. 정규화 시각 순으로 서비스·파일·메시지·오류를 확인하고 이벤트 버튼으로 원본 파일/줄 범위를 엽니다. 시각 없는 이벤트는 시간축에 놓지 않고 별도 목록에 남깁니다. 처음에는 목록의 첫 그룹을 표시하지만 명시적으로 선택한 그룹이 사라지면 다른 ID로 몰래 바꾸지 않습니다. 목록은 50개 페이지입니다.

관측 시각 간격은 실제 기록된 시각의 차이이며 요청 처리시간이나 이벤트 간 인과관계가 아닙니다. 서버 시계 오차·로그 누락·ID 재사용 가능성을 확인해야 합니다. Span ID가 있어도 parent/span 시작·종료 정보 없이 완전한 분산 추적 트리로 표시하지 않습니다.

파일을 왼쪽에서 선택해 **파일 설정 적용 및 재분석**을 사용하세요.

- 시간대: 파서가 추출한 전체 rawTimestamp에 오프셋이 없을 때 `Asia/Seoul`, `America/New_York`, `UTC`, `+09:00` 등으로 해석합니다. 로그에 명시된 오프셋과 IIS UTC는 유지합니다. DST 중복/누락 시각은 자동으로 앞뒤로 옮기지 않고 null과 진단을 남깁니다. 날짜 없는 시각이나 잘못된 날짜를 복원하지 않습니다.
- 서비스명: 실제 로그에 서비스가 없을 때만 사용자 라벨을 보완합니다. 상세와 추적 목록에서 **파일 설정** 근거를 표시하며 원문 서비스는 덮어쓰지 않습니다.
- 식별자 연결 범위: 환경/테넌트 등 ID를 나눠야 할 때 직접 입력하세요. 빈 값은 공통 기본 범위이며 앱이 실행 환경을 추측한 값이 아닙니다.
- 파일 색상: 소스 파일과 추적 목록을 구분하는 장식입니다. 색상을 바꿔도 원문·이벤트는 재분석하지 않습니다.

형식이나 JSON 매핑만 바꿔도 기존 파일 설정은 유지합니다. 설정을 해제하려면 빈 값으로 적용하세요. 무효 시간대는 기존 이벤트/원문을 바꾸지 않고 거절합니다. IANA 규칙은 런타임 Intl 시간대 데이터에 의존하며 모든 브라우저·역사 시각을 실측하지는 않았습니다.

텍스트는 root 헤더의 명시적 requestId/request_id/request-id/x-request-id, traceId/trace_id/trace-id, correlationId/correlation_id/correlation-id/x-correlation-id, spanId/span_id/span-id key:value/key=value만 읽습니다. Stack Trace 자식의 ID를 부모에 부여하지 않습니다. 텍스트 값 충돌 또는 256자 초과는 자동 선택/절단하지 않고 진단합니다. JSON은 별칭/수동 경로, IIS는 실제 #Fields의 custom ID 컬럼을 사용합니다. 사용자 지정 ID는 JSON 매핑으로만 읽으며, 예를 들어 `token`, `Scopes.0.TraceId`처럼 own-property/배열 경로를 지정할 수 있습니다. 숫자나 이름 없는 UUID를 ID로 만들어 쓰지 않습니다.

샘플 선택에서 **요청 추적 API**, **요청 추적 DB**를 각각 불러오세요. API는 +09:00이 명시되어 있습니다. DB의 오프셋 없는 날짜는 데모 시나리오상 UTC이며 직접 DB 파일 시간대에 UTC를 적용할 수 있습니다. 파일 서비스 라벨도 demo-api/demo-db로 직접 설정할 수 있습니다. req-demo-001은 6개 이벤트이고 UTC 설정 뒤 시간순 5개·미확인 1개, 최초~최종 관측 간격 4030ms입니다. 이 값은 완전한 요청 처리시간을 뜻하지 않습니다. 추적 다운로드는 Phase 8 내보내기에 남겨두었습니다.

## 지원 형식

| 파서 | 지원하는 입력 패턴 |
| --- | --- |
| Spring Boot | `timestamp LEVEL pid --- [thread] logger : message` 기본 패턴 |
| Logback / Log4j2 | `timestamp [thread] LEVEL logger - message` 또는 `timestamp LEVEL [thread] logger - message` (`:` 구분자도 지원) |
| .NET ILogger | `info/warn/fail/...: Category[EventId] message`, 선택적 전체 날짜 prefix, SimpleConsole의 6칸 들여쓰기 첫 메시지 |
| Serilog Text | `timestamp [ERR] message`, `[ERR] message`, `[HH:mm:ss INF] message` 및 VRB/DBG/INF/WRN/ERR/FTL |
| JSON | JSON Lines/NDJSON, 단일 객체와 여러 줄 객체, 객체 배열, 자동 별칭·수동 필드 매핑 |
| Serilog JSON | 표준 Timestamp/Level/RenderedMessage/Properties 및 Compact @t/@l/@m/@mt/@x |
| IIS W3C | #Fields 선언에 따른 컬럼 해석과 도중 재선언, 원본 HTTP 상태/응답 시간/IP 필드 보존 |
| Generic Text | 지원하지 않는 텍스트 행·빈 행·원본 위치 및 문자열 수준 레벨 탐색 |

.log/.txt/.json/.jsonl/.ndjson/.csv와 확장자 없는 텍스트를 읽습니다. CSV는 아직 구조화하지 않고 Generic으로 탐색합니다. UTF-8과 BOM이 있는 UTF-16 LE/BE를 지원합니다. 자동 모드는 혼합 파일의 각 행을 판별합니다. 임의로 변경한 Logback/NLog/Serilog 출력 템플릿까지 모두 지원하지는 않습니다.

JSON의 주요 별칭은 timestamp/time/@timestamp, level/severity/logLevel, message/msg/renderedMessage, requestId/request_id/RequestId, traceId/trace_id/TraceId입니다. 원본 중첩 필드는 parsedFields에 보존합니다. 일반 JSON의 누락된 레벨은 UNKNOWN입니다. Serilog CLEF에서 생략된 @l만 명세상 Information으로 해석합니다. 메시지 템플릿은 임의 렌더링하지 않습니다.

IIS 지시문과 JSON 배열 구분자는 원본 저장소에 보존하고 이벤트 건수에서 제외합니다. 잘못된 IIS 선언/컬럼과 JSON 구문은 실패 사유가 있는 원문 이벤트로 남깁니다. IIS의 HTTP 500을 애플리케이션 Exception 또는 ERROR 레벨로 바꾸지 않습니다.

상단 통계는 실제 이벤트에서만 계산합니다. 경고/실패 수는 해당 진단이 있는 이벤트 수이며 ERROR 레벨 수와 다릅니다. 시간대가 없는 값과 날짜 없는 Serilog 시각은 원문만 표시하고 timestamp=null을 유지합니다. IIS W3C date/time은 규약상 UTC입니다. 달력·시간·오프셋 범위를 검증하고 소수 초 원문을 보존합니다.

## 구조

```text
src/app/             레이아웃·목록·상세·파일별 파서/매핑 설정
src/core/parsers.ts  파서 레지스트리와 자동/수동 디스패치
src/core/parsing/    공통 정규화, text / json / iis 파서
src/core/exceptions/ 예외 경계·Java/.NET 트리·fingerprint 및 그룹
src/core/correlation/        typed/scoped 식별자·관측 타임라인
src/core/file-context.ts     사용자 파일 문맥·시간대/서비스 근거
src/core/statistics.ts       실제 이벤트 집계·UTC 버킷·집중 구간
src/core/statistics-chart.ts 차트 데이터 변환
src/core/            시간/필드 필터·검색·안정 정렬·가상 범위·Worker 제어
src/stores/          Zustand 원본 저장소·파일 세션·재분석·적용 검색 조건
src/hooks/           비동기 검색 수명·이전 결과 무시
src/workers/         검색 전용 Worker
src/types/           공통 이벤트·파서·옵션 모델
src/tests/           파서·파일 수명주기·UI 테스트
public/samples/      공개 가능한 가상 데이터 14종
docs/               설계 결정·진행 상태·검증 기록
```

파서는 detect(sample)와 parse(input, options) 인터페이스를 구현합니다. UI와 파싱 엔진은 분리되어 있습니다. 자세한 내용은 [아키텍처](docs/ARCHITECTURE.md), [설계 결정](docs/DECISIONS.md), 전체 목표는 [PROJECT.md](PROJECT.md)를 참조하세요.

## 검증

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

타입 검사·ESLint·테스트 136개·프로덕션 빌드 통과. 기존 115개 회귀와 파일별 시간대·명시적 ID·타입/범위 분리·교차 파일 추적·설정 수명주기 테스트를 포함합니다. 기존 임시 비병합 기대 2건은 Phase 4 병합 및 원본 보존을 확인하도록 변경했습니다. UI 검증은 React Testing Library/jsdom에서 수행했으며 실제 브라우저 E2E와 구분합니다. 결과는 [진행 기록](docs/PROGRESS.md)에 있습니다.

## 배포 및 한계

GitHub Actions 워크플로는 검사 후 Pages artifact를 생성하고 main에서 배포합니다. 상대 Vite base를 사용합니다. 원격 저장소는 [HeoSeongbin/LogScope-Studio](https://github.com/HeoSeongbin/LogScope-Studio)입니다. 저장소 Settings → Pages에서 GitHub Actions를 선택해야 합니다. 실제 배포와 배포 URL은 미검증입니다.

파일당 2 MiB·세션당 8 MiB 임시 한도를 유지합니다. 원본과 정규화 데이터를 함께 보관하므로 실제 메모리 사용량은 파일 바이트보다 큽니다. 파싱은 메인 스레드에서 수행하며 대용량 성능을 보증하지 않습니다. 목록은 고정 행 높이의 가상 스크롤 방식입니다. 전체 결과 중 현재 보이는 범위와 앞뒤 여유 행만 렌더링합니다.

텍스트 Stack Trace는 지원 문법의 연속 구간만 병합합니다. 임의의 메시지 연속 행·지역화 종료 표식·일부 AggregateException 출력은 보수적으로 별도 원문/진단으로 남깁니다. 중첩은 16단계·128노드까지만 정규화하며 초과 원문은 보존합니다. 깨진 다중 행 JSON은 행 단위로 복구하며 구조를 임의 복원하지 않습니다. Unix timestamp 숫자 단위와 레거시 인코딩 수동 선택은 지원하지 않습니다. 파싱 Worker·내보내기·Light 모드·스크린샷은 후속 Phase입니다. traceparent 헤더 자체의 분해·Span parent 트리·임의 UUID의 ID 추론은 지원하지 않습니다. Canvas 차트는 구현했지만 실제 브라우저 페인팅/반응형 E2E는 미검증입니다. 검색 전용 Worker는 정규식 격리를 위해 구현되었으며 파싱 Worker 완료를 뜻하지 않습니다.

Chart.js 4.6.1 / react-chartjs-2 5.3.1 및 @js-temporal/polyfill 0.5.1을 사용합니다. 설치 시 npm은 moderate 10건을 보고했습니다. Temporal 추가 후 메인 chunk가 약 650 kB로 500 kB 경고 기준을 넘었습니다. 코드 분할·Worker·실제 성능 측정은 다음 **Phase 7 성능 최적화**에서 진행합니다.
