# 개발 진행

현재 Phase: **Phase 5 통계 및 시계열 분석 구현·자동 검증 완료** (2026-11-12).
다음 Phase: **Phase 6 다중 파일 및 요청 추적**. 실제 브라우저 Canvas/E2E·Pages 배포·대용량 성능 검증은 완료 처리하지 않았다.

## 시작 상태 확인

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 실제 소스·Git 상태를 확인했다. Phase 4 기록과 코드가 일치했고 기존 9개 파일/93개 테스트가 통과했다. Git main은 Phase 3·4 로컬 커밋으로 origin/main보다 2개 앞섰으며 시작 시 작업 트리는 깨끗했다. 이번에는 Phase 5만 구현하고 새 커밋/푸시는 수행하지 않았다.

이력: Phase 0·1 기반 → Phase 2 다중 포맷(44e7b2f 게시) → Phase 3 검색/필터(1e7c9cd 로컬) → Phase 4 예외 분석(b504c6c 로컬) → Phase 5 통계·시계열.

## 구현 내용

- 순수 통계 엔진: 레벨별 건수, ERROR+FATAL 건수/전체 이벤트 비율, root 예외 이벤트, IIS HTTP 4xx/5xx 독립 집계
- 파일 ID·실제 서비스·Logger별 집계. 없는 필드는 null 그룹으로 유지하고 UI에서만 미기록 안내
- 상위 ERROR/FATAL 메시지, 기존 fingerprint 기반 상위 예외 그룹 및 root 타입별 발생 분포
- 동일 이벤트 ID만 중복 제외. 내용이 같아도 다른 파일의 이벤트는 각각 관측값으로 집계
- UTC epoch 기준 1분/5분/1시간/1일 버킷, 내부 빈 구간 0건 유지, 실제 관측 시각 범위 밖으로 임의 확장하지 않음
- 시각 없는 이벤트는 전체 통계/분모에 포함하되 차트와 시간 구간에서는 제외, 개수 별도 표시
- 집중 구간: 선택 지표(ERROR+FATAL / HTTP 5xx / 예외), 최소 건수·최소 비율의 관측 기준. 기준/분모를 표시하고 원인·이상치로 확정하지 않음
- Dashboard 화면: 필터 결과 지표, 시간 추이·레벨·서비스 오류 차트, 상위 메시지/예외, 파일/서비스/Logger 표
- Timeline Analyzer: 동일 시간 차트와 관측 기준, 구간별 데이터 표, 구간 선택 이벤트/레벨 분포와 원본 상세 연결
- 공통 검색·기간·레벨·파일 필터와 정렬·선택/원본 상세 유지. 파일별 통계 버튼으로 Explorer 전환
- Chart.js 4.6.1 / react-chartjs-2 5.3.1 번들 통합. 필요한 scale/element/plugin 등록, 로컬 category 축·UTC 라벨 사용, 외부 API/폰트/CDN 호출 없음
- charts 수치와 동일한 데이터 표 및 구간 선택 버튼 제공. Canvas를 클릭할 수 없는 환경에서도 데이터 조회 가능
- 가상 statistics-demo.jsonl 샘플 1종과 선택 UI 추가

## 실제 검증 결과 (2026-11-12)

- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm test`: **11개 파일·115개 테스트 통과**, 기존 93개 포함
- `npm run build`: 통과, 정적 차트 라이브러리 및 기존 검색 Worker 산출물 생성
- 실제 가상 샘플 12개 이벤트: ERROR 4/FATAL 1/WARN 1/INFO 3/DEBUG 1/TRACE 1/UNKNOWN 1, 오류 비율 5/12, 예외 3개
- 정규화 시각 10개/없음 2개. 1분 버킷 총건수 [2,5,0,1,2], ERROR+FATAL [0,4,0,0,0]. 집중 구간 05:31 UTC는 4/5=80%
- UTC/다른 오프셋·음수 epoch·inclusive 전체 기간/half-open 버킷 경계·누락/유효하지 않은 시각·빈 입력·최대 버킷/날짜 범위 오류 검증
- 중복 ID만 제외, 같은 파일명/다른 파일 ID 분리, 서비스 미기록 보존, HTTP 상태와 severity/예외 구분, 필터 적용·원문 불변 검증
- Node File 실제 업로드/Generic 재분석/파일 제거 후 통계와 타임라인 갱신·원문 보존 검증
- chart 데이터 변환에서 실제 UTC 라벨과 관측 수치 전달 검증
- jsdom UI: Dashboard/Timeline 이동, 실제 건수·비율, 공통 필터, 구간 선택→원본 위치, 파일별 탐색, 버킷 변경·기준 오류·빈 데이터 검증
- UI 테스트의 Canvas 래퍼는 mock으로 대체했다. 실제 Canvas 페인팅/차트 클릭 브라우저 E2E·반응형 시각 검사·Pages 배포·대용량 성능은 **미검증**

## 발견 및 해결한 문제

- 전체 세션 수치만 있었음 → 필터 결과와 전체 세션 표시를 구분하고 Dashboard에 결과 통계 추가
- HTTP 500·ERROR 레벨·Exception을 섞으면 분모/합계가 잘못될 위험 → 독립 지표와 계산식 명시, 합산하지 않음
- 시각 없는 오류를 임의 시간에 놓을 위험 → 전체 통계와 시간 차트 범위 구분
- 긴 관측 범위에서 버킷 배열이 무한히 커질 위험 → 2,000개 한도와 명시적 오류, 거친 해상도/좁은 기간 안내
- 버킷 계산 실패를 집중 구간 없음으로 보일 위험 → 계산하지 않았다고 안내
- 차트 파일의 비컴포넌트 export Fast Refresh 경고 → 순수 차트 데이터 함수를 core로 이동, 최종 ESLint 경고 없음
- npm 설치가 샌드박스 네트워크에서 실패 → 사용자 승인 후 설치 완료

## 알려진 제약 / 미완료

- 차트는 최대 2,000개 버킷. 초과 시 값을 자르거나 자동으로 해상도를 바꾸지 않고 오류 표시
- 관측 범위 안의 0건 구간은 입력 로그에 이벤트가 없다는 뜻이며 실제 서비스 무장애/미실행을 증명하지 않음
- 일 단위도 UTC 고정 24시간 버킷. 파일별 시간대 지정·DST 현지 일 경계는 Phase 6 이후 검토
- 집중 구간은 기본 최소 3건·30%의 사용자 관측 기준, 상위 10개 표시. 자동 이상치 탐지/원인 분석은 미구현
- 차트에 표시되는 예외·ERROR/FATAL·HTTP 지표는 겹칠 수 있음. 덧셈 가능한 배타적 카테고리가 아님
- 서비스 차트는 전체 이벤트 수 상위 10개 서비스, 상위 오류/예외는 10개, 타입 표는 20개, 차원 표는 20개 페이지, 버킷 표는 50개 페이지
- 파일별 표는 현재 결과에 포함된 파일을 sourceFileId로 집계. 업로드됐으나 결과 이벤트가 없는 파일은 이 표에 나타나지 않음
- HTTP 집계는 기존 IIS W3C의 유효 sc-status만 사용. 임의 JSON 필드의 HTTP 의미를 추측하지 않음
- 통계·버킷·파일 파싱은 메인 스레드. 파일당 2 MiB/세션 8 MiB 한도 유지, 파싱 Worker/스트리밍/성능 측정은 Phase 7
- 기존 Phase 3 검색·Phase 4 Stack Trace 지원 문법/진단 한도 유지
- 설치 시 npm이 moderate 10건을 보고함. 상세 재감사/강제 의존성 변경은 하지 않았음

## 변경 파일

- 엔진: src/core/statistics.ts, src/core/statistics-chart.ts
- UI: src/app/StatisticsDashboard.tsx, src/app/StatisticsCharts.tsx, src/app/App.tsx, src/style.css
- 샘플: public/samples/statistics-demo.jsonl
- 테스트: src/tests/statistics.test.ts, src/tests/statistics-ui.test.tsx, src/tests/workspace.test.ts
- 문서: README.md, docs/PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md
- 의존성/버전: package.json, package-lock.json → 0.5.0

## 다음 작업

Phase 6: 파일별 시간대/서비스 설정, 실제 Request/Trace/Correlation 식별자 추출·구분, 여러 파일·서비스 요청 타임라인 및 관련 원본 탐색. 동일 시각과 인과관계를 구분하고 시계 오차·로그 누락 가능성을 안내한다. 기존 파서·예외·검색·통계 회귀 테스트를 보존한다.
