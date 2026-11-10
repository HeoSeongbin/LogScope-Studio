# LogScope Studio

브라우저에서 로그를 읽고 탐색하는 React + TypeScript 워크스페이스입니다. 사용자 로그를 서버로 전송하거나 브라우저 저장소에 자동 저장하지 않습니다. **Phase 2 다중 포맷 파서까지 구현했으며 자동 검증을 통과했습니다.** 실제 브라우저 E2E와 배포 검증은 별도 미완료 항목입니다.

## 실행

Node.js 24 권장.

```sh
npm ci
npm run dev
```

## 사용 방법

1. 새 파일 로그 형식을 자동 감지 또는 특정 파서로 선택합니다.
2. 파일 선택이나 Drag & Drop으로 여러 로그를 추가합니다. 샘플 불러오기는 가상 Spring Boot 로그를 읽습니다. 다른 형식의 가상 로그는 public/samples에 있습니다.
3. 왼쪽 파일 목록과 다중 레벨 버튼으로 결과를 필터링합니다. 레벨을 모두 해제하면 전체를 표시합니다.
4. 이벤트 메시지를 선택하면 원본 로그·원본 줄 범위·파서·정규화 필드·경고·파싱 실패 원인을 확인할 수 있습니다.
5. 왼쪽에서 파일을 선택하면 해당 파일의 인코딩·파서·결과 건수·실패 건수를 확인하고 로그 형식을 바꿔 재분석할 수 있습니다. 파일 원본 보기는 디코딩한 텍스트 전체를 표시합니다.
6. JSON 필드 매핑에서 Timestamp/Level/Message/Request ID/Trace ID의 필드명 또는 점 경로를 입력하고 적용합니다. 빈 값은 자동 매핑입니다. 예: `meta.when`, `body`, `Properties.RequestId`. 직접 필드명이 점 경로보다 우선합니다.

재분석은 원본 텍스트를 변경하지 않으며 해당 파일 결과만 교체합니다. 개별 파일 제거와 세션 초기화는 원본과 파생 이벤트를 함께 제거합니다.

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
src/core/            파일/레벨 필터·안전한 상세 표시
src/stores/          Zustand 원본 저장소·파일 세션·재분석
src/types/           공통 이벤트·파서·옵션 모델
src/tests/           파서·파일 수명주기·UI 테스트
public/samples/      공개 가능한 가상 데이터 8종
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

타입 검사·ESLint·테스트 41개·프로덕션 빌드 통과. 기존 11개 회귀 테스트와 다중 포맷·잘못된 날짜·혼합 파일·원본 위치·파일별 재분석 테스트를 포함합니다. UI 검증은 React Testing Library/jsdom에서 수행했으며 실제 브라우저 E2E와 구분합니다. 결과는 [진행 기록](docs/PROGRESS.md)에 있습니다.

## 배포 및 한계

GitHub Actions 워크플로는 검사 후 Pages artifact를 생성하고 main에서 배포합니다. 상대 Vite base를 사용합니다. 원격 저장소는 [HeoSeongbin/LogScope-Studio](https://github.com/HeoSeongbin/LogScope-Studio)입니다. 저장소 Settings → Pages에서 GitHub Actions를 선택해야 합니다. 실제 배포와 배포 URL은 미검증입니다.

파일당 2 MiB·세션당 8 MiB 임시 한도를 유지합니다. 원본과 정규화 데이터를 함께 보관하므로 실제 메모리 사용량은 파일 바이트보다 큽니다. 파싱은 메인 스레드에서 수행하며 대용량 성능을 보증하지 않습니다. 목록은 100건 페이지 방식입니다.

Stack Trace는 아직 개별 원문 행으로 보존하며 그룹화 완료로 간주하지 않습니다. 깨진 다중 행 JSON은 행 단위로 복구하며 구조를 임의 복원하지 않습니다. Unix timestamp 숫자 단위·파일별 시간대·레거시 인코딩 수동 선택은 지원하지 않습니다. 검색·가상 스크롤·예외 그룹화·차트·요청 추적·Worker·내보내기·Light 모드·스크린샷은 후속 Phase입니다.

이전 npm audit에서 개발 도구 하위 의존성 moderate 경고 10건이 기록되었습니다. 이번 작업은 의존성을 변경하거나 감사를 재실행하지 않았습니다. 다음 작업은 **Phase 3 로그 검색 및 필터**입니다.

