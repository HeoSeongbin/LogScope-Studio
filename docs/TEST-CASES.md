# 검증 시나리오

자동화: 실제 public 샘플 감지·파싱, ERROR 필터, 필드 추출, 원본 줄 위치, Generic 폴백, 빈 줄/CRLF/마지막 개행, 미인식 Stack 행 보존, 명시적 오프셋 정규화, 시간대 미지정 null, 리터럴 HTML, 복합 레벨/파일 필터, UI 선택 상세.

수동 브라우저 검증 대상: 파일 선택/드롭, 여러 파일 업로드, 개별 제거·초기화 중 읽기 결과 무시, 샘플 로딩, 파일 한도, UTF-16 BOM, 모바일 레이아웃, Pages 경로. 브라우저 실측을 실행하지 않았다면 완료로 표기하지 않는다.

성능: 1/10/50 MB 벤치마크는 Phase 7에서 수행한다. Phase 1의 파일 한도는 성능 측정 결과가 아니다.

2026-11-11 실행 결과: TypeScript/ESLint/Production Build 통과. Vitest 3개 파일·11개 테스트 통과. Node File 기반 실제 샘플 업로드, UTF-16 BOM, 손상된 입력, 파일 제한, 개별 제거와 초기화 수명주기를 추가 검증했다. UI 검증은 jsdom이며 실제 브라우저 검증과 구분한다.

## Phase 2 검증 (2026-11-11)

추가 자동화: Java 패턴 2종, ILogger 레벨 별칭/CRLF 첫 메시지/Stack 비병합, Serilog 콘솔·전체 날짜·오프셋, 표준/Compact JSON, JSONL 손상 행 뒤 복구, 명시적 필드 경로와 누락, 다중 행 객체·배열의 원문/줄 범위/고유 ID, 원시 배열 값 실패, 프로토타입 경로 차단, 깊은 JSON 표시 보호, IIS 선언 순서 변경/중복/부재/컬럼 불일치, HTTP 상태와 Exception 분리, 달력·윤년·오프셋·소수 초 검증.

파일 수명주기: 추가 샘플 6종을 실제 Node File로 업로드하고 결과 [2,3,2,3,5,4]건 및 손상 행 실패 [0,0,0,0,1,1]건을 확인한다. 재분석은 원본 문자열과 다른 파일 이벤트를 보존하고 중복 없이 결과를 교체한다. 파일 제거 시 원본도 제거한다.

UI: 새 업로드 형식 선택, 파일별 파서 변경, JSON 매핑 적용과 원본 보기를 jsdom에서 검증한다.

결과: 타입 검사/ESLint/Production Build 통과, Vitest 4개 파일·41개 테스트 통과. 실제 브라우저 E2E·시각 검사·배포·대용량 성능은 미검증이며 이 결과에 포함하지 않는다.

## Phase 3 검증 (2026-11-12)

타입 검사/ESLint/Production Build 통과. Vitest 7개 파일·66개 테스트 통과 (이전 41개 포함).

- 필터: 명시적 오프셋·동일 instant·inclusive 경계, 누락 시각 옵션, 잘못된 날짜·역전 범위, 레벨/파일/Logger/Thread 결합, 원문 불변, stable 시간 정렬
- 검색: AND/OR, 인용 구문, 대소문자, 메타문자 literal, Unicode/중첩 강조 범위, 원문/메타데이터 검색, 제한 초과 오류
- 정규식: 유효/잘못된 문법, zero-width Unicode 종료, 행/전체 입력 제한. Node 실제 Worker에서 병적 `(a+)+$`를 1초 watchdog으로 종료하는 통합 테스트
- 수명주기: Worker 시작 오류·제한·취소, 늦은 응답 무시, 쿼리 교체, 종료
- UI(jsdom): 검색 적용 전후, 기간 오류·초기화, 세션 초기화, HTML 비실행, Worker 불가 시 일반 검색 복구, 원본 선택
- 가상 목록: 10만건 범위 계산에서 창 크기/총 높이 유지. jsdom 1만건 스크롤에서 DOM 행 20개 미만 및 마지막 이벤트 선택

브라우저 Worker E2E·실제 스크롤/레이아웃/모바일·Pages 배포·대용량 파싱 성능은 미검증이다. 브라우저 런타임 검증은 Node Worker/DOM 테스트로 대체 완료 처리하지 않는다.

## Phase 4 검증 (2026-11-12)

타입 검사/ESLint/Production Build 통과. Vitest 9개 파일·93개 테스트 통과. 기존 66개 중 임시 비병합 기대 2개는 Phase 4 원본/메타데이터 보존 병합 기대와 강한 검증으로 변경했다.

- 실제 Java 19줄 샘플 → 3개 이벤트/2회 예외 1개 그룹, root/suppressed/cause/frame/생략 표식·원본 범위
- 실제 .NET 14줄 샘플 → 3개 이벤트, inline/multiline inner와 종료 후 부모 프레임 소유
- CRLF/탭/무개행/독립 root/임의 텍스트/빈 줄/INFO/새 로그/Generic·JSON·IIS 경계
- JSON 명시적 타입 우선·InnerException/suppressed·중복 원인 비중복·깊이 초과 원형 보존
- fingerprint 동적 값/타입/위치/서비스/Logger 차이, 파일 간 반복·같은 ID 비중복, 누락 시각, HTTP 500 비예외, 미해석/overflow 비합침
- 실제 Node File 업로드·재분석·제거와 파생 그룹/원본 저장소 연계
- jsdom Analyzer 이동·반복 건수/시각/원본 선택/원인 트리/필터 공유/Explorer 복귀/샘플 선택

실제 브라우저 E2E·시각/접근성 검사·Pages 배포·대용량 및 청크 스트리밍은 미검증이다.

## Phase 5 검증 (2026-11-12)

타입 검사/ESLint/Production Build 통과, Vitest 11개 파일·115개 테스트 통과 (기존 93개 포함).

실제 statistics-demo.jsonl 샘플: 12개 이벤트, ERROR+FATAL 5, root 예외 3, 오류 비율 5/12, timed 10/untimed 2. UTC 1분 버킷 총건수 [2,5,0,1,2], 오류 [0,4,0,0,0]. 집중 구간 4/5=80%를 확인한다.

추가 검증: 빈 입력/null 비율, 서비스/Logger 미기록, 파일 ID별 구분, 중복 ID만 제외, HTTP 4xx/5xx 독립, 필터·원본 불변, UTC/오프셋/음수 epoch/inclusive 기간과 half-open 버킷, 빈 구간, 시각 이상값, 2,000개 버킷·표현 범위 제한, 집중 지표별 기준, 실제 chart 데이터 라벨/값.

Node File 업로드→Generic 재분석→제거 후 통계/차트 데이터 갱신·원문 보존을 검증한다. jsdom은 Dashboard/Timeline 전환, 필터 공유, 구간/원본 선택, 파일 통계 탐색, 기준 오류와 빈 데이터를 검증한다. UI의 Canvas wrapper는 mock이므로 실제 Canvas·차트 클릭/레이아웃·접근성·Pages E2E를 통과한 것으로 간주하지 않는다.
