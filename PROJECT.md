# LogScope Studio — 로그 분석 및 장애 추적 플랫폼 개발 지시서

## 1. 프로젝트 개요

### 프로젝트명

**LogScope Studio**

부제: Log Analysis & Distributed Request Tracing Workspace

### 개발 목적

React + TypeScript 기반의 웹 애플리케이션으로, 개발자가 서버와 애플리케이션에서 생성된 로그 파일을 업로드하고 분석할 수 있는 통합 로그 분석 도구를 개발한다.

Java Spring Boot, C# ASP.NET, IIS 및 다양한 애플리케이션 로그를 지원하고, 로그 레벨, 발생 시간, 예외 종류, Request ID 등을 기준으로 로그를 검색하고 분석할 수 있도록 한다.

특히 여러 줄에 걸쳐 출력되는 Stack Trace를 하나의 예외 이벤트로 묶고, 여러 서비스의 로그 파일에서 동일한 Request ID 또는 Trace ID를 가진 이벤트를 찾아 처리 흐름을 시각화하는 것이 핵심 목표다.

본 프로젝트는 GitHub에 공개할 개인 포트폴리오 프로젝트로, 실제 로그 파싱, 데이터 정규화, 비동기 처리, 검색, 집계, 오류 그룹화, 시계열 분석 및 대용량 파일 처리 역량을 보여주는 것을 목표로 한다.

단순 로그 뷰어나 디자인 목업이 아니라 실제 사용할 수 있는 도구로 개발한다.

### 핵심 목표

1. 다양한 로그 파일 업로드
2. 로그 형식 자동 감지
3. Java Spring Boot 로그 분석
4. C# ASP.NET 로그 분석
5. JSON 및 구조화 로그 분석
6. 로그 레벨별 필터링
7. 시간 범위 조회 및 정렬
8. 키워드 및 정규식 검색
9. Stack Trace 자동 그룹화
10. 반복 오류 식별 및 통계
11. 시간대별 오류 집중 구간 분석
12. 다중 로그 파일 통합 분석
13. Request ID / Trace ID 기반 로그 연결
14. 요청 처리 타임라인
15. 분석 결과 다운로드
16. 대용량 로그 처리 최적화
17. 브라우저 로컬 처리
18. GitHub Pages 배포
19. 자동화 테스트
20. 문서 기반 프로젝트 관리

---

## 2. 핵심 개발 원칙

- React + TypeScript 사용
- Vite 기반 개발
- TypeScript strict mode
- 백엔드 없는 정적 웹 애플리케이션
- 로그 파일을 외부 서버로 전송하지 않음
- 로그 원문을 임의로 수정하지 않음
- 파일 파싱과 UI 렌더링 분리
- 로그 파서의 확장성 확보
- 서로 다른 형식을 공통 로그 이벤트 모델로 정규화
- 모든 이벤트의 원본 파일과 위치 추적 가능
- 여러 줄 Stack Trace 처리
- 잘못된 로그가 포함되어도 가능한 데이터는 계속 분석
- 대용량 로그를 메인 스레드에서 무리하게 처리하지 않음
- 분석 결과의 정확성과 재현성 확보
- 실제 측정된 값만 통계로 표시
- 미확인 원인을 확정적인 장애 원인으로 표현하지 않음
- 관련 테스트 작성
- PROJECT.md를 기준으로 개발 방향 유지

모든 분석 결과는 실제 입력 로그에 기반해야 한다.

로그가 제공하지 않는 Request ID, 발생 시간, 실행 환경 등의 정보를 임의로 생성해서 분석 결과에 포함하지 않는다.

---

## 3. 기술 스택

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- TanStack Query (필요 시)
- Lucide React

### 로그 처리

- Web Workers
- File API
- Streams API
- TextDecoder
- 필요 시 Comlink

### 시각화

- Chart.js
- react-chartjs-2
- 대규모 목록용 Virtual Scrolling 라이브러리

### 날짜 및 시간

- date-fns 또는 Day.js
- 타임존 처리를 위한 검증된 라이브러리 (필요 시)

### 파일 내보내기

- Blob API
- FileSaver 기능 또는 브라우저 다운로드 API
- JSZip (필요 시)

### 테스트

- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier

### 배포

- GitHub Pages
- GitHub Actions

실제 설치 전에 라이브러리의 버전, 유지보수 상태, 브라우저 호환성을 확인한다.

초기 버전은 별도 서버, DB, 로그인 기능을 요구하지 않는다.

---

## 4. 프로젝트 관리 문서

다음 다섯 개 문서를 반드시 관리한다.

### 4.1 PROJECT.md

프로젝트의 최종 목표와 요구사항을 정의한다.

포함할 내용:

- 프로젝트 소개
- 기능 요구사항
- 기술 스택
- 시스템 아키텍처
- 로그 처리 흐름
- 파서 구조
- 정규화 데이터 모델
- 예외 그룹화 방식
- Request ID 추적 방식
- UI/UX
- 성능 정책
- 보안 정책
- 테스트 전략
- 개발 단계
- 최종 완료 조건

PROJECT.md는 프로젝트의 기준 문서이며 구현 편의를 위해 필수 요구사항을 임의로 축소하지 않는다.

### 4.2 AGENTS.md

코딩 에이전트의 행동 규칙을 정의한다.

필수 규칙:

1. 작업 전에 PROJECT.md 확인
2. docs/PROGRESS.md 확인
3. docs/DECISIONS.md 확인
4. 현재 소스 및 Git 상태 확인
5. 현재 개발 Phase 확인
6. 기존 정상 기능 보존
7. 변경 영향 분석
8. 실제 동작하는 기능 구현
9. 관련 단위 테스트 작성
10. TypeScript 타입 검사
11. ESLint 검사
12. Production Build
13. 문서 업데이트
14. 설계 결정 기록
15. 검증하지 않은 기능 완료 처리 금지

에이전트가 새로운 세션에서 작업하더라도 동일한 기준으로 개발할 수 있도록 작성한다.

### 4.3 README.md

GitHub 사용자 및 포트폴리오 방문자를 위한 문서다.

포함할 내용:

- 프로젝트 소개
- 주요 기능
- 지원 로그 형식
- 화면 스크린샷
- 로그 업로드 방법
- 분석 및 검색 방법
- Stack Trace 그룹화
- Request ID 추적
- 통계 시각화
- 로컬 실행 방법
- GitHub Pages 주소
- 테스트 방법
- 프로젝트 아키텍처
- 기술적 해결 사례
- 알려진 한계

실제 구현된 기능만 완료 기능으로 안내한다.

### 4.4 docs/PROGRESS.md

개발 진행 상태를 관리한다.

항목:

- 현재 Phase
- 완료된 작업
- 진행 중인 작업
- 미완료 작업
- 발견된 오류
- 해결된 오류
- 테스트 결과
- 알려진 제약
- 다음 작업

작업 종료 시 반드시 업데이트한다.

### 4.5 docs/DECISIONS.md

중요한 기술적 결정과 선택 이유를 ADR 형식으로 기록한다.

기록 대상:

- 로그 파서 인터페이스
- 로그 형식 감지 방식
- Stack Trace 그룹화 방식
- 정규화 데이터 모델
- 시간 및 타임존 정책
- 오류 그룹화 알고리즘
- Request ID 연관 분석
- 파일 인코딩 처리
- Worker 구조
- 대용량 로그 메모리 관리
- 정규식 검색 안전성
- 분석 데이터 저장 및 삭제 정책

---

## 5. 프로젝트 권장 구조

```text
logscope-studio/
├── PROJECT.md
├── AGENTS.md
├── README.md
├── docs/
│   ├── PROGRESS.md
│   ├── DECISIONS.md
│   ├── ARCHITECTURE.md
│   └── TEST-CASES.md
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes/
│   ├── components/
│   │   ├── layout/
│   │   ├── upload/
│   │   ├── filters/
│   │   ├── log-table/
│   │   ├── charts/
│   │   ├── exceptions/
│   │   ├── trace/
│   │   └── dialogs/
│   ├── features/
│   │   ├── file-upload/
│   │   ├── log-parser/
│   │   ├── log-explorer/
│   │   ├── exception-analyzer/
│   │   ├── statistics/
│   │   ├── correlation/
│   │   └── export/
│   ├── core/
│   │   ├── parsing/
│   │   ├── normalization/
│   │   ├── filtering/
│   │   ├── grouping/
│   │   ├── timeline/
│   │   └── correlation/
│   ├── parsers/
│   │   ├── spring/
│   │   ├── dotnet/
│   │   ├── json/
│   │   ├── iis/
│   │   └── generic/
│   ├── workers/
│   ├── stores/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   └── tests/
├── public/
│   └── samples/
├── .github/
│   └── workflows/
├── package.json
└── vite.config.ts
```

실제 요구사항에 맞게 조정할 수 있으나 로그 처리 엔진과 UI는 분리한다.

---

## 6. 로그 업로드 및 파일 관리

### 필수 지원

- .log
- .txt
- .json
- .jsonl
- .ndjson
- .csv

확장자가 없는 텍스트 로그도 가능하면 지원한다.

### 추가 지원 검토

- .gz 압축 로그
- .zip 로그 묶음
- .out
- .trace
- .evtx (별도 파서 필요)
- .etl (별도 파서 필요)

첫 버전에서는 텍스트 기반 로그를 중심으로 구현한다.

EVTX와 ETL은 전용 바이너리 형식이므로 텍스트 파일처럼 처리하지 않는다.

### 업로드 기능

1. 파일 선택
2. Drag & Drop
3. 다중 파일 업로드
4. 파일명 표시
5. 파일 크기 표시
6. 인코딩 감지
7. 인코딩 수동 선택
8. 로그 형식 자동 감지
9. 로그 형식 수동 선택
10. 파일별 파싱 진행률
11. 파싱 오류 건수 표시
12. 파일 제거
13. 전체 초기화

### 인코딩

- UTF-8
- UTF-8 BOM
- UTF-16 LE/BE
- EUC-KR 등 가능한 레거시 인코딩

브라우저의 TextDecoder 지원 여부에 따라 처리하고, 자동 판별이 불확실한 경우 사용자에게 선택하도록 한다.

### 원본 관리

업로드한 원본 파일은 분석 과정에서 변경하지 않는다.

분석된 로그 이벤트는 원본 파일 ID 및 줄 번호와 연결한다.

파일을 제거하면 해당 파일에서 파생된 이벤트와 분석 결과를 제거한다.

다른 파일의 이벤트는 보존한다.

---

## 7. 로그 파서 아키텍처

서로 다른 로그 형식을 공통 모델로 정규화하기 위한 파서 인터페이스를 설계한다.

### 권장 인터페이스

```ts
interface LogParser {
  id: string;
  name: string;

  detect(sample: string): number;

  parse(
    input: LogInput,
    options: ParseOptions
  ): AsyncIterable<LogEvent>;
}
```

실제 구현 시 Worker 메시지 전송 방식 및 스트리밍 구조를 고려하여 인터페이스를 조정할 수 있다.

### 주요 책임

- 로그 형식 감지
- 이벤트 시작 판별
- 타임스탬프 추출
- 로그 레벨 추출
- 메시지 추출
- 예외 추출
- Request ID 추출
- Source 정보 연결
- 여러 줄 이벤트 병합
- 파싱 오류 처리

### 처리 원칙

1. 하나의 로그 파일에 여러 형식이 섞여 있을 수 있음을 고려한다.
2. 파싱 실패 행을 무조건 버리지 않는다.
3. 원본 텍스트를 보존한다.
4. 파서별 신뢰도와 인식 범위를 관리한다.
5. 사용자가 파서 종류를 수동 선택할 수 있도록 한다.
6. 형식 감지 실패 시 Generic Text Parser를 사용한다.
7. 이벤트 경계가 불확실한 경우 임의 병합하지 않는다.

---

## 8. 공통 Log Event 데이터 모델

모든 파서의 결과를 공통 구조로 변환한다.

```ts
type LogLevel =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL"
  | "UNKNOWN";

interface LogEvent {
  id: string;
  sourceFileId: string;
  sourceFileName: string;

  lineStart: number;
  lineEnd: number;

  timestamp: number | null;
  rawTimestamp?: string;
  timezone?: string;

  level: LogLevel;

  service?: string;
  host?: string;
  thread?: string;
  logger?: string;

  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;

  message: string;
  exception?: LogException;

  rawText: string;
  parsedFields: Record<string, unknown>;

  parserId: string;
  parseWarnings?: string[];
}
```

예외 모델:

```ts
interface LogException {
  type?: string;
  message?: string;
  stackTrace?: string;
  frames?: StackFrame[];
  causeChain?: LogException[];
}

interface StackFrame {
  className?: string;
  methodName?: string;
  fileName?: string;
  lineNumber?: number;
  raw: string;
}
```

### 모델 설계 원칙

- 원본 파일명과 줄 위치 유지
- 타임스탬프가 없을 수 있음
- 레벨이 없을 수 있음
- 동일 시각의 이벤트가 여러 개 있을 수 있음
- 로그 파일마다 타임존이 다를 수 있음
- 원본 필드는 parsedFields로 보존
- 파싱 실패 정보를 유지
- 이벤트 ID는 분석 세션 내에서 안정적으로 관리

로그가 없는 필드는 임의로 채우지 않는다.

---

## 9. Java Spring Boot 로그 파서

다음 로그를 지원한다.

- Spring Boot 기본 텍스트 로그
- Logback
- Log4j2 일반 패턴
- MDC 포함 로그
- Java Exception Stack Trace
- JSON 형태의 Java 애플리케이션 로그

### 예시

```text
2026-11-06 14:30:01.123 INFO 1234 --- [http-nio-8080-exec-1] c.example.UserService : Request started

2026-11-06 14:30:02.456 ERROR 1234 --- [http-nio-8080-exec-1] c.example.UserService : Database error
java.sql.SQLException: Connection timed out
    at com.example.UserRepository.find(UserRepository.java:42)
    at com.example.UserService.get(UserService.java:20)
```

### 추출 정보

- Timestamp
- Level
- Process ID
- Thread
- Logger
- Message
- Exception Type
- Stack Trace
- Request ID
- Trace ID

단, Request ID와 Trace ID는 로그에 실제 존재하는 경우에만 추출한다.

### Stack Trace

다음 형태를 처리한다.

- java.lang.Exception
- java.lang.RuntimeException
- java.sql.SQLException
- Caused by
- Suppressed
- ... N more
- 여러 예외의 중첩
- 다양한 들여쓰기 및 로그 패턴

여러 줄을 무조건 단일 이벤트로 합치지 않는다.

타임스탬프, 예외 구문, Stack Frame 등을 기준으로 이벤트 경계를 판별한다.

---

## 10. C# ASP.NET / .NET 로그 파서

다음 형식을 검토하고 지원한다.

- ASP.NET 일반 텍스트 로그
- ASP.NET Core ILogger
- Serilog 텍스트 로그
- Serilog JSON 로그
- NLog 텍스트 로그
- .NET Exception Stack Trace

### 예시

```text
2026-11-06 14:31:10.250 [ERR] Request processing failed
System.InvalidOperationException: Invalid operation
   at WebApp.Services.UserService.GetUser() in C:\src\UserService.cs:line 55
   at WebApp.Controllers.UserController.Get() in C:\src\UserController.cs:line 20
```

### 추출 정보

- Timestamp
- Level
- Source Context
- Message
- Exception Type
- Stack Trace
- Method
- File
- Line Number
- Request ID
- Trace ID
- Correlation ID

### 지원 주의사항

ASP.NET Framework와 ASP.NET Core의 로그 형식은 다를 수 있다.

Serilog 및 NLog도 출력 템플릿에 따라 형식이 달라지므로, 모든 .NET 로그를 동일한 정규식 하나로 처리하지 않는다.

형식에 맞는 파서를 별도로 정의한다.

---

## 11. IIS 로그 분석

W3C Extended Log File Format를 우선 지원한다.

### 주요 필드

- date
- time
- s-ip
- cs-method
- cs-uri-stem
- cs-uri-query
- s-port
- cs-username
- c-ip
- cs(User-Agent)
- sc-status
- sc-substatus
- sc-win32-status
- time-taken

### 기능

- HTTP Status 조회
- 4xx / 5xx 분석
- 요청 경로별 통계
- 응답 시간 분석
- 시간대별 오류 분석
- Client IP 기준 필터
- 느린 요청 목록

### 필수 조건

W3C 파일의 `#Fields` 선언을 읽어 실제 컬럼 순서를 파악한다.

고정된 컬럼 순서에 의존하지 않는다.

필드가 없는 경우 임의로 추정하지 않는다.

HTTP 오류 상태와 애플리케이션 내부 Exception을 동일한 이벤트 유형으로 취급하지 않는다.

---

## 12. JSON / Structured Log Parser

JSON 형태의 로그를 분석한다.

### 예시

```json
{
  "timestamp": "2026-11-06T14:32:00+09:00",
  "level": "ERROR",
  "service": "payment-api",
  "traceId": "trace-demo-001",
  "message": "Database connection failed",
  "exception": "java.sql.SQLException"
}
```

### 기능

- JSON Lines 파싱
- NDJSON 지원
- JSON Array 로그
- Timestamp 필드 매핑
- Level 필드 매핑
- Message 필드 매핑
- Request ID 필드 매핑
- Trace ID 필드 매핑
- 구조화된 예외 정보 추출

### 필드 매핑

다양한 로깅 라이브러리가 필드명을 다르게 사용하므로 필드 매핑 설정을 제공한다.

예시:

- timestamp / time / @timestamp
- level / severity / logLevel
- message / msg / renderedMessage
- traceId / trace_id / TraceId
- requestId / request_id / RequestId

자동 매핑에 실패하면 사용자가 매핑을 직접 선택할 수 있어야 한다.

---

## 13. Generic Text Parser

지원하지 않는 로그도 가능한 범위에서 탐색할 수 있도록 한다.

### 기능

- 원문 표시
- 줄 번호
- 키워드 검색
- 문자열 수준 로그 레벨 탐색
- 사용자 정의 Timestamp 패턴
- 사용자 정의 Level 패턴
- 사용자 정의 Request ID 패턴

### 사용자 정의 파서

고급 기능으로 다음 설정을 지원한다.

- 이벤트 시작 정규식
- Timestamp 정규식
- Level 정규식
- Message 추출 규칙
- Request ID 추출 규칙

사용자 정의 정규식은 실행 시간과 입력 크기를 제한하여 ReDoS 위험을 완화한다.

사용자가 입력한 코드를 JavaScript로 실행하는 기능은 제공하지 않는다.

---

## 14. 로그 검색 및 필터링

### 필수 필터

- ERROR
- WARN
- INFO
- DEBUG
- TRACE
- FATAL
- UNKNOWN

### 추가 필터

- 발생 기간
- 파일명
- 서비스명
- Logger
- Thread
- Request ID
- Trace ID
- Exception Type
- Keyword
- HTTP Status

### 검색

- 일반 문자열 검색
- 대소문자 구분 옵션
- AND/OR 조건
- 여러 키워드
- 정규식 검색
- 검색 결과 강조

### 시간 정렬

- 오래된 순
- 최신 순
- 파일 원본 순서

타임스탬프가 없는 이벤트도 조회 가능해야 한다.

시간이 없는 이벤트를 임의 시각에 배치하지 않는다.

---

## 15. 로그 테이블 및 상세 화면

### Log Explorer

다음 컬럼을 제공한다.

- Timestamp
- Level
- Service
- Thread
- Logger
- Message
- Request ID
- Source File

### 기능

- 정렬
- 검색
- 필터
- 컬럼 표시/숨기기
- 컬럼 너비 조정
- Virtual Scrolling
- 행 선택
- 상세 정보
- 원본 로그 보기

### 상세 화면

- 원본 텍스트
- 정규화된 이벤트
- 파일명
- 원본 줄 번호
- Timestamp
- Request ID
- Stack Trace
- Parser 정보
- 파싱 경고

선택한 이벤트가 원본 파일의 몇 번째 줄부터 몇 번째 줄까지 포함하는지 확인할 수 있어야 한다.

---

## 16. Stack Trace 그룹화

프로젝트의 핵심 차별화 기능이다.

여러 줄에 출력되는 Stack Trace를 하나의 오류 이벤트로 인식한다.

### 예시

```text
2026-11-06 14:30:02 ERROR Database error
java.sql.SQLException: Connection timed out
    at UserRepository.find(UserRepository.java:42)
    at UserService.get(UserService.java:20)
```

위 전체를 하나의 Exception Event로 처리한다.

### 그룹화 기준

- Exception Type
- Exception Message
- Stack Trace 주요 Frame
- Logger
- Service
- 발생 위치

### 오류 Fingerprint

동일하거나 유사한 오류를 그룹화하기 위한 Fingerprint를 생성한다.

예시:

```text
SQLException
+ UserRepository.find
+ UserService.get
```

### 정규화 정책

- 동적 ID 값
- UUID
- 메모리 주소
- Timestamp
- 변동 가능 숫자

이런 요소를 무조건 제거하지 않는다.

필요한 경우 오류 유형에 맞는 정규화 규칙을 적용한다.

### 그룹화 결과

- Exception Type
- 첫 발생 시간
- 마지막 발생 시간
- 발생 횟수
- 관련 파일
- 관련 서비스
- 대표 Stack Trace
- 최근 발생 이벤트

### 중요한 조건

Fingerprint가 같다는 이유만으로 실제 원인이 완전히 동일하다고 단정하지 않는다.

사용자가 원본 오류를 확인할 수 있도록 한다.

---

## 17. 반복 오류 및 집중 구간 분석

### 오류 유형별 통계

- Exception Type별 건수
- Logger별 오류 건수
- Service별 오류 건수
- 파일별 오류 건수
- 시간대별 오류 수

### 시계열 분석

- 분 단위
- 5분 단위
- 시간 단위
- 일 단위

### 차트

- 전체 이벤트 추이
- ERROR 이벤트 추이
- WARN 이벤트 추이
- Exception 유형별 분포
- 상위 오류 TOP N
- 서비스별 오류 분포

### 집중 구간

사용자가 설정한 시간 버킷에 따라 오류가 집중된 구간을 계산한다.

추후 다음 기능을 검토한다.

- 이동 평균
- 기준 구간 대비 증가율
- 이상치 탐지
- 특정 오류의 급증 탐지

이상 징후는 통계적 기준에 따라 표시하며 실제 장애 원인을 자동으로 확정하지 않는다.

---

## 18. Request ID / Trace ID 추적

여러 로그 파일에서 같은 식별자를 가진 이벤트를 연관 분석한다.

### 지원 식별자

- Request ID
- Trace ID
- Correlation ID
- Span ID
- 사용자 정의 식별자

### 기능

1. 식별자 자동 추출
2. 식별자 검색
3. 같은 식별자의 이벤트 그룹화
4. 여러 파일 간 이벤트 연결
5. 서비스별 이벤트 구분
6. 시간순 타임라인
7. 오류 이벤트 강조
8. 전체 처리 흐름 표시
9. 관련 로그 원문 확인
10. 추적 결과 다운로드

### 예시

```text
[API Gateway]
14:30:01.120 Request Received
          ↓
[Spring Boot API]
14:30:01.145 Request Processing
          ↓
[Database]
14:30:03.220 Query Timeout
          ↓
[Spring Boot API]
14:30:05.150 SQLException
```

### 추적 원칙

- 실제 로그에 포함된 식별자만 사용
- 동일한 식별자 타입과 범위를 고려
- Trace ID와 Request ID를 무조건 같은 의미로 취급하지 않음
- 다중 서비스의 타임존 보정
- 서버 간 시계 오차 가능성 고려
- 이벤트 간 인과관계와 시간순 관계 구분
- 로그가 누락되면 누락 가능성을 표시
- 요청 처리시간은 근거가 있는 이벤트 구간에서만 계산

OpenTelemetry Trace ID가 존재하더라도 실제 Span 구조가 없으면 완전한 분산 추적 트리라고 표현하지 않는다.

---

## 19. 시간 및 타임존 처리

로그 분석의 정확성에 중요한 기능이다.

### 요구사항

- Timestamp 형식별 파싱
- ISO 8601
- Java 일반 로그 시간
- .NET 로그 시간
- IIS 날짜/시간
- Unix Timestamp (지원되는 경우)
- 밀리초 단위
- 타임존 처리
- 사용자 지정 타임존
- 시간 형식 변경

### 핵심 정책

시간대 정보가 명시된 로그는 해당 오프셋을 보존한다.

시간대 정보가 없는 로그는 사용자가 파일별 타임존을 지정할 수 있도록 한다.

시간대가 없는 값을 무조건 UTC로 취급하지 않는다.

내부 정렬용 시간과 원본 표시 시간을 분리한다.

여러 서버의 로그를 통합 분석할 때 시간 기준이 다르면 이를 사용자에게 안내한다.

---

## 20. 다중 파일 통합 분석

사용자가 여러 로그 파일을 업로드해 통합 분석할 수 있어야 한다.

### 기능

- 여러 파일 동시 업로드
- 파일별 파서 선택
- 파일별 타임존 설정
- 파일별 서비스명 설정
- 파일별 색상 구분
- 통합 시간순 정렬
- 통합 레벨 필터
- 파일별 통계
- 요청 ID 통합 분석

### 파일 관리

- 개별 파일 제거
- 파일별 분석 상태
- 파일별 오류 건수
- 파일별 이벤트 수
- 파일별 파싱 실패 건수
- 파일별 처리 시간

원본 위치 정보를 잃지 않고 통합 분석해야 한다.

---

## 21. 분석 결과 내보내기

### 출력 형식

- CSV
- JSON
- 요약 리포트 (HTML 또는 PDF 검토)

### Export 대상

- 현재 필터 결과
- 전체 이벤트
- 오류 그룹 목록
- 특정 Exception 상세
- Request ID 타임라인
- 시간대별 통계

### 주의사항

- 원본과 분석 결과 구분
- CSV Formula Injection 방어
- 큰 파일 다운로드 제한
- 민감 정보 포함 경고
- 필드 및 인코딩 정확성
- 내보내기 진행 상태 표시

---

## 22. React UI/UX

전문적인 로그 모니터링 및 장애 분석 도구 스타일로 구현한다.

### 디자인 방향

- Dark Mode 기본
- Light Mode 지원
- 개발자 도구 스타일
- 높은 정보 밀도
- 가독성 높은 로그 테이블
- 명확한 레벨 색상
- 간결한 통계 차트
- 반응형 화면
- 한국어 기본 UI
- 키보드 접근성

### 화면 1. Dashboard

- 전체 로그 건수
- ERROR 건수
- WARN 건수
- INFO 건수
- 오류 비율
- 시간대별 로그 차트
- 상위 Exception
- 파일별 통계

### 화면 2. Log Explorer

- 통합 로그 테이블
- 검색창
- 레벨 필터
- 기간 필터
- 파일 필터
- 로그 상세

### 화면 3. Exception Analyzer

- Exception 목록
- 반복 오류 그룹
- 발생 빈도
- 첫/마지막 발생
- 대표 Stack Trace
- 관련 이벤트

### 화면 4. Timeline Analyzer

- 시간대별 이벤트 차트
- 오류 집중 구간
- 선택한 시간대 이벤트 목록
- 레벨별 분포

### 화면 5. Request Trace Explorer

- Request ID 검색
- Trace ID 검색
- 이벤트 타임라인
- 서비스별 처리 흐름
- 오류 발생 지점
- 관련 로그 상세

### 화면 6. File Manager

- 업로드 파일 목록
- 로그 형식
- 인코딩
- 타임존
- 이벤트 수
- 파싱 상태
- 파일 제거

### 화면 7. Settings

- 테마
- 기본 시간대
- 표시 시간 형식
- 로그 레벨 색상
- 기본 필터
- 파일 크기 제한 안내
- Parser 설정

### 공통 레이아웃

상단:

- 프로젝트 로고
- 파일 업로드
- 주요 화면 이동
- Export
- Theme

좌측:

- 파일 목록
- 레벨 필터
- 검색 조건

중앙:

- 로그 테이블 또는 분석 차트

우측:

- 이벤트 상세
- Exception 상세
- Trace 정보

하단:

- 전체 이벤트 수
- 필터 결과 수
- 파싱 상태
- 처리 시간
- 파싱 경고 수

---

## 23. Zustand 상태 관리

### 상태 구분

- Uploaded Files
- Parse Sessions
- Normalized Log Events
- Filter State
- Search State
- Selected Event
- Exception Groups
- Statistics
- Trace Results
- UI Preferences

### 원칙

- 원본 파일과 파싱 결과 분리
- Worker 데이터와 UI 상태 분리
- 대량 이벤트를 불필요하게 React 상태에 복제하지 않음
- 필터링 및 집계 결과를 필요한 시점에 계산
- 오래된 Worker 요청 결과 무시
- 파일 제거 시 관련 데이터 정리
- 분석 세션 초기화 기능 제공

큰 로그 전체를 매 렌더링마다 순회하지 않는다.

---

## 24. Web Worker 및 대용량 처리

프로젝트의 주요 기술적 요소다.

### 목표

수 MB에서 수십 MB 이상의 로그를 처리할 수 있는 구조를 설계한다.

최대 지원 파일 크기는 실제 측정 후 결정한다.

### 처리 방식

```text
File Upload
    ↓
File Reader / Stream
    ↓
Web Worker
    ↓
Chunk Decoder
    ↓
Log Parser
    ↓
Normalized Events
    ↓
Filtering / Aggregation
    ↓
Virtualized UI
```

### 요구사항

- 청크 단위 읽기
- 부분 라인 처리
- 여러 줄 이벤트 상태 유지
- Web Worker 파싱
- Worker 진행률
- Worker 취소
- 메모리 제한
- 파일 크기 제한
- 가상 스크롤
- 필요한 통계만 집계
- 불필요한 데이터 복제 방지
- Worker 종료 시 메모리 정리

### 중요 조건

청크 경계가 로그 이벤트 또는 Stack Trace 중간에 걸리더라도 파싱 결과가 달라지지 않아야 한다.

특히 다음 상황을 테스트한다.

- Timestamp가 청크 경계에서 나뉘는 경우
- 한 줄이 여러 청크에 걸치는 경우
- Stack Trace가 청크 경계를 넘는 경우
- UTF-8 멀티바이트 문자가 청크 경계에서 나뉘는 경우
- 마지막 줄 개행이 없는 파일
- 매우 긴 한 줄
- 손상된 입력

파일 크기뿐 아니라 파싱된 이벤트 수와 메모리 사용량도 고려한다.

---

## 25. 보안 및 개인정보

로그에는 개인정보, 인증 정보, API Key 등 민감한 데이터가 포함될 수 있다.

### 원칙

- 로그 파일 서버 업로드 금지
- 외부 API 호출 없이 로컬 분석
- 로그 파일 임의 실행 금지
- 사용자 입력 정규식 실행 제한
- XSS 방어
- 로그 메시지를 HTML로 직접 삽입하지 않음
- 파일 크기 및 메모리 제한
- 무제한 자동 저장 금지
- 브라우저 저장소에 로그 원문 무단 저장 금지
- 내보내기 시 민감 정보 경고
- 샘플 로그에는 가상 데이터만 사용

민감 정보 자동 탐지는 향후 확장 기능으로 검토할 수 있다.

브라우저에서 파싱한다는 이유만으로 모든 보안 문제가 해결된다고 가정하지 않는다.

---

## 26. 샘플 로그 및 테스트 데이터

프로젝트에 공개 가능한 가상 로그 샘플을 포함한다.

### 샘플 파일

```text
public/samples/
├── spring-normal.log
├── spring-exception.log
├── dotnet-normal.log
├── dotnet-exception.log
├── serilog.jsonl
├── iis-access.log
├── distributed-api.log
├── distributed-db.log
└── mixed-invalid.log
```

### 샘플 시나리오

1. 정상 API 요청
2. Spring Boot SQLException
3. Spring Boot NullPointerException
4. ASP.NET InvalidOperationException
5. IIS HTTP 500
6. 동일 오류 반복
7. 시간대별 오류 급증
8. 동일 Request ID의 여러 서비스 로그
9. 타임존이 다른 서버 로그
10. 잘못된 로그 형식
11. Stack Trace 여러 줄
12. 일부 Timestamp 누락

실제 고객사 정보나 운영 로그를 저장소에 포함하지 않는다.

---

## 27. 자동화 테스트

### Parser Unit Test

- Spring Boot 로그
- Logback
- Log4j2
- .NET ILogger
- Serilog
- IIS W3C
- JSON Lines
- Generic Text
- 파싱 불가능한 입력

### Stack Trace Test

- Java Exception
- Java Caused by
- Java Suppressed
- .NET Exception
- .NET Inner Exception
- 여러 Stack Frame
- 여러 줄 이벤트 병합
- 청크 경계
- 불완전한 Stack Trace

### Time Parsing Test

- ISO 8601
- Local Time
- UTC
- Timezone Offset
- 밀리초
- 잘못된 Timestamp
- 시간대가 없는 로그

### Statistics Test

- 레벨별 건수
- 기간 필터
- 시간 버킷
- Exception 빈도
- 중복 집계 방지
- Timestamp 없는 이벤트

### Correlation Test

- 같은 Request ID
- 서로 다른 Request ID
- Trace ID
- 여러 서비스
- 여러 파일
- 타임존 차이
- 중복 이벤트
- 누락 이벤트

### Performance Test

- 1MB 로그
- 10MB 로그
- 50MB 로그
- 매우 긴 줄
- 대량 Stack Trace
- 이벤트 수가 많은 파일

성능 기준은 측정 결과를 기록한 뒤 정한다.

### E2E Test

- 파일 업로드
- 로그 파싱
- 레벨 필터
- 키워드 검색
- 시간 필터
- Exception 그룹화
- 차트 조회
- Request ID 검색
- 다중 파일 추적
- 결과 다운로드
- 배포 환경 검증

---

## 28. GitHub Pages 배포

정적 웹사이트로 배포한다.

### 요구사항

- GitHub Actions
- TypeScript Type Check
- ESLint
- Unit Tests
- Production Build
- Vite Base Path
- Web Worker 로딩 확인
- 정적 리소스 경로 확인
- 새로고침 시 라우팅 오류 방지

### 검증

배포 환경에서 다음 기능을 확인한다.

- 로그 파일 업로드
- 파싱
- 검색 및 필터
- 차트
- Stack Trace 그룹화
- Request ID 추적
- 결과 다운로드

배포 권한이 없으면 Workflow 설정까지 작성하고 실제 배포는 미검증으로 기록한다.

---

## 29. 개발 단계

### Phase 0 — 설계 및 문서 관리

- 요구사항 분석
- 기술 스택 검토
- 아키텍처 설계
- Log Event 데이터 모델 설계
- Parser 인터페이스 설계
- UI 구조 설계
- PROJECT.md 생성
- AGENTS.md 생성
- README.md 초기 작성
- docs/PROGRESS.md 생성
- docs/DECISIONS.md 생성

완료 기준: 개발 방향과 아키텍처가 명확하게 문서화됨.

### Phase 1 — 프로젝트 기반 및 로그 업로드

- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- 기본 레이아웃
- 로그 파일 업로드
- 파일 목록
- 파일 크기 및 형식 표시
- Generic Text Parser
- 기본 Spring Boot Log Parser
- Log Event 모델
- 로그 테이블
- 기본 레벨 필터
- 샘플 로그
- Vitest 설정
- GitHub Pages 기본 설정

완료 기준: Spring Boot 로그 파일을 업로드하고 실제 이벤트 목록을 조회할 수 있음.

### Phase 2 — 다중 포맷 Parser

- Logback/Log4j2
- .NET ILogger
- Serilog
- JSON Lines
- IIS W3C
- 자동 형식 감지
- 사용자 지정 형식 선택
- 파싱 오류 처리

완료 기준: 서로 다른 로그 형식을 공통 이벤트 모델로 변환 가능.

### Phase 3 — 로그 검색 및 필터

- 시간 범위 검색
- 레벨 다중 필터
- 키워드 검색
- 정규식 검색
- Logger/Thread 필터
- 파일별 필터
- 검색 결과 강조
- Virtual Scrolling
- 이벤트 상세 패널

완료 기준: 대량 이벤트에서 원하는 로그를 효율적으로 찾을 수 있음.

### Phase 4 — Stack Trace 및 Exception 분석

- Java Stack Trace
- .NET Stack Trace
- 여러 줄 이벤트 병합
- Exception Type 추출
- 오류 Fingerprint
- 반복 오류 그룹화
- Exception Analyzer 화면

완료 기준: 반복되는 예외를 그룹화하고 발생 횟수 및 원본을 확인 가능.

### Phase 5 — 통계 및 시계열 분석

- 레벨별 통계
- 시간대별 차트
- 오류 집중 구간
- 상위 오류
- 서비스별 통계
- 파일별 통계
- 기간 필터
- Dashboard 고도화

완료 기준: 오류 발생 패턴을 차트와 통계로 확인 가능.

### Phase 6 — 다중 파일 및 요청 추적

- 여러 로그 파일 통합
- 파일별 시간대 설정
- Request ID 추출
- Trace ID 추출
- Correlation ID 추출
- 타임라인
- 서비스별 이벤트
- 관련 로그 탐색
- Trace Explorer 화면

완료 기준: 여러 파일에 분산된 같은 요청의 이벤트를 하나의 화면에서 확인 가능.

### Phase 7 — 성능 최적화

- Web Worker
- 청크 단위 파싱
- 스트리밍 디코딩
- 메모리 최적화
- 검색 및 필터 최적화
- 분석 작업 취소
- 대용량 파일 테스트
- 리소스 정리

완료 기준: 정의된 테스트 환경에서 대용량 로그 처리 성능 및 안정성을 검증.

### Phase 8 — UI/UX 및 내보내기

- 전체 UI 고도화
- Dark/Light 모드
- 반응형 레이아웃
- 패널 크기 조절
- CSV Export
- JSON Export
- 분석 리포트
- 오류 메시지 개선
- 접근성 개선

완료 기준: 실제 개발자가 사용할 수 있는 수준의 분석 UI 완성.

### Phase 9 — 테스트 및 배포

- 회귀 테스트
- 통합 테스트
- E2E 테스트
- 성능 검증
- GitHub Actions
- GitHub Pages
- README 완성
- 기술적 해결 과정 정리
- 아키텍처 다이어그램
- 스크린샷
- 포트폴리오 소개

완료 기준: 정적 배포 사이트에서 실제 로그 분석 기능 사용 가능.

---

## 30. 최종 완료 조건

- [ ] 로그 파일 업로드
- [ ] 다중 로그 파일 업로드
- [ ] Spring Boot 로그 분석
- [ ] Logback/Log4j2 로그 분석
- [ ] ASP.NET 로그 분석
- [ ] Serilog 로그 분석
- [ ] IIS W3C 로그 분석
- [ ] JSON Lines 분석
- [ ] 로그 형식 감지
- [ ] 공통 이벤트 정규화
- [ ] 원본 파일 및 줄 번호 보존
- [ ] ERROR/WARN/INFO/DEBUG/TRACE 필터
- [ ] 키워드 검색
- [ ] 정규식 검색
- [ ] 시간 범위 검색
- [ ] 로그 테이블
- [ ] 이벤트 상세 화면
- [ ] Java Stack Trace 그룹화
- [ ] .NET Stack Trace 그룹화
- [ ] Exception Fingerprint
- [ ] 반복 오류 통계
- [ ] 시간대별 로그 차트
- [ ] 오류 집중 구간 분석
- [ ] Request ID 추적
- [ ] Trace ID 추적
- [ ] 다중 서비스 타임라인
- [ ] 파일별 타임존 처리
- [ ] Web Worker 파싱
- [ ] 대용량 파일 처리
- [ ] CSV/JSON Export
- [ ] Dark/Light 모드
- [ ] 샘플 로그
- [ ] 자동화 테스트
- [ ] GitHub Pages 배포
- [ ] PROJECT.md 관리
- [ ] AGENTS.md 관리
- [ ] README.md 최신화
- [ ] PROGRESS.md 최신화
- [ ] DECISIONS.md 기록

---

## 31. 에이전트 작업 규칙

당신은 React, TypeScript, 로그 파싱, 비동기 파일 처리, Web Workers, 데이터 시각화 및 장애 분석 도구 개발 경험이 있는 시니어 프론트엔드 개발자이자 소프트웨어 아키텍트 역할이다.

다음 원칙을 지킨다.

1. 작업 전에 필수 관리 문서를 확인한다.
2. 현재 코드와 Git 상태를 확인한다.
3. PROGRESS.md의 현재 Phase를 확인한다.
4. 이번 Phase의 요구사항을 분석한다.
5. 정상 기능을 보존한다.
6. 데이터 처리와 UI를 분리한다.
7. 실제 로그 샘플로 동작을 검증한다.
8. 핵심 파싱 로직에 테스트를 작성한다.
9. TypeScript 타입 검사를 수행한다.
10. ESLint 검사를 수행한다.
11. Production Build를 수행한다.
12. 테스트 결과를 기록한다.
13. PROGRESS.md를 업데이트한다.
14. DECISIONS.md에 중요한 설계를 기록한다.
15. README.md를 실제 구현 상태와 일치시킨다.
16. 미완료 기능을 완료라고 보고하지 않는다.
17. 다음 세션에서 이어서 작업할 수 있도록 현재 상태를 기록한다.

### 금지사항

- 실제 분석 없이 가짜 통계 표시
- 임의의 Request ID 생성 후 실제 추적 정보로 표시
- Stack Trace를 단순 문자열 행으로만 처리하고 완료 주장
- 다른 로그 형식을 하나의 정규식에 억지로 맞춤
- 타임존 정보 무시
- 파싱 실패 행 무단 삭제
- 파일 원본 변경
- 로그 외부 서버 업로드
- 대용량 로그 전체를 무조건 메인 스레드에서 처리
- 테스트 실패 무시
- 기존 기능 무단 제거

---

## 32. 최초 실행 지시

첫 실행에서는 **Phase 0과 Phase 1까지만 구현한다.**

### 작업 순서

1. 현재 프로젝트 디렉터리와 Git 상태 확인
2. 요구사항 분석
3. 기술 스택 및 라이브러리 검토
4. Log Parser 아키텍처 설계
5. 공통 Log Event 모델 설계
6. PROJECT.md 생성
7. AGENTS.md 생성
8. README.md 초기 작성
9. docs/PROGRESS.md 생성
10. docs/DECISIONS.md 생성
11. Vite + React + TypeScript 초기화
12. Tailwind CSS 설정
13. Zustand 구성
14. 기본 UI 레이아웃 구현
15. 로그 파일 업로드 구현
16. 파일 목록 및 상태 표시
17. Generic Text Parser 구현
18. Spring Boot 기본 로그 파서 구현
19. Log Event 정규화
20. 로그 테이블 구현
21. 로그 레벨별 필터
22. 샘플 로그 생성
23. 핵심 Parser 테스트 작성
24. TypeScript 검사
25. ESLint 검사
26. Production Build
27. 문서 최신화
28. 작업 결과 보고

### Phase 1 실제 검증

다음 시나리오가 동작해야 한다.

1. 사용자가 Spring Boot 로그 파일을 업로드한다.
2. 파일 형식을 식별한다.
3. 로그를 파싱한다.
4. 타임스탬프와 레벨, 메시지를 추출한다.
5. Log Event 모델로 변환한다.
6. 로그 테이블에 표시한다.
7. ERROR 필터를 적용한다.
8. ERROR 로그만 조회된다.
9. 이벤트를 선택하면 원본 로그와 줄 번호를 확인할 수 있다.
10. 지원하지 않는 형식은 Generic Text Parser로 처리된다.

실제 샘플 로그를 이용하여 테스트한다.

Phase 2 이후의 기능을 임의로 먼저 구현하지 않는다.

다만 이후 Exception Analyzer, Request Trace Explorer, Web Worker 처리를 확장할 수 있도록 구조를 설계한다.

### 최종 보고

- 생성 및 수정 파일
- 프로젝트 구조
- 파서 아키텍처
- 로그 이벤트 데이터 모델
- 구현 기능
- 테스트 결과
- 빌드 결과
- 발견된 문제
- 미완료 작업
- 다음 Phase

**최종 목표는 여러 시스템의 로그를 분석하고 오류 패턴, 반복 예외, 시간대별 집중 구간 및 요청 처리 흐름을 추적할 수 있는 브라우저 기반 전문 로그 분석 도구를 만드는 것이다.**

이제 Phase 0부터 설계 및 개발을 진행하라.