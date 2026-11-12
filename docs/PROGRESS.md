# 개발 진행

현재 Phase: **Phase 3 로그 검색·필터 구현 및 자동 검증 완료** (2026-11-12).
다음 Phase: **Phase 4 Stack Trace 및 Exception 분석**. 실제 브라우저·Pages 배포·대용량 성능 검증은 완료 처리하지 않았다.

## 시작 상태 확인

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 실제 코드·테스트를 확인했다. Phase 2 구현과 기록이 일치했고 기존 41개 테스트가 통과했다. Git은 main 브랜치·origin/main 추적 상태이며 작업 시작 시 변경사항이 없었다. 최초 실행 Phase 제한은 이미 지난 작업이며 이번 후속 지시에 따라 Phase 3만 구현했다.

이력: Phase 0·1 기반/업로드 → Phase 2 다중 포맷 파서 → 사용자 요청으로 44e7b2f 커밋을 원격 main에 게시. 작성자는 저장소별 HeoSeongbin <heosb316@gmail.com>으로 설정되어 있다. 이번 작업에서는 새 커밋/푸시를 수행하지 않았다.

## 완료된 작업

기존 업로드·Spring/Java/.NET/Serilog/JSON/IIS 파서, 원본 위치·파일별 재분석·JSON 매핑, 레벨/파일 필터, 원본 저장소, 삭제/초기화 동작을 유지했다.

Phase 3:

- 공백으로 구분한 여러 키워드, 따옴표 구문, AND/OR 조건, 대소문자 구분
- 원문/메시지/Logger/Thread/서비스/Request ID/Trace ID/파일명 대상 문자열·정규식 검색
- 명시적 오프셋이 있는 시작·종료 시각, 양끝 포함 기간 필터, 시간대/달력/역전 범위 검증
- 시각 없는 이벤트 포함/제외. 시간순 정렬에서는 별도 꼬리로 배치하며 임의 시각을 부여하지 않음
- Logger/Thread 부분 일치 필터, 기존 파일·레벨 필터와 AND 결합
- 원본 순서/오래된 순/최신 순. 같은 시각의 순서는 원본 기준으로 안정적으로 유지
- 검색 양식의 초안과 적용 상태 분리, 검색 초기화, 세션 초기화 연동, 오류/진행/취소 표시
- 검색 전용 Worker의 사용자 정규식 실행. 시작 5초·실행 1초 제한, 취소/오래된 결과 무시, 완료 시 Worker 종료
- 메시지와 원문 상세에서 텍스트 노드 기반 강조. 사용자 로그를 HTML로 삽입하지 않음
- 페이지 목록을 고정 높이 가상 스크롤로 교체. 8개 컬럼(시각/레벨/메시지/서비스/Thread/Logger/Request ID/소스), 원본 위치 및 정규화 상세 유지
- 목록은 간결한 한 줄 메시지, 원본 상세에는 전체 텍스트 제공

## 실제 검증 결과 (2026-11-12)

- `npm run typecheck`: 통과 (TypeScript strict)
- `npm run lint`: 통과
- `npm test`: **7개 파일·66개 테스트 통과**, 기존 41개 회귀 테스트 포함
- `npm run build`: 통과, Vite가 검색 Worker를 별도 정적 asset으로 생성
- 시간대가 다른 동일 시각, inclusive 기간 경계, 누락 시각, 역전 범위, 잘못된 달력 검증
- 복합 필터·정렬의 원본 불변, 키워드 AND/OR·인용 구문·대소문자·메타문자 literal 처리·UTF-16 강조 범위 검증
- 정규식 구문 오류, zero-width·Unicode 매치의 종료, 입력 크기 제한 검증
- 실제 Node worker_threads에서 검색 코어를 실행하고 `(a+)+$` / 30,000개 a + !의 병적 역추적을 1초 watchdog으로 종료하는 통합 테스트 통과
- Worker 시작 실패/시작 제한/취소/늦은 결과 무시·종료 검증
- jsdom: 검색 적용 전후, 오류 및 초기화, 원문 상세/강조, HTML 비실행, Worker 불가 시 일반 검색 복구 검증
- 1만 이벤트 테이블을 jsdom에서 스크롤해 DOM 행 20개 미만 유지와 마지막 이벤트의 원본 위치 선택 검증. 10만 이벤트의 가상 범위 계산도 검증
- 실제 브라우저 화면·브라우저 Worker 로딩 E2E·Pages 배포·1/10/50 MB 파일 성능은 **미검증**. Node Worker 테스트와 구분한다

## 발견 및 해결한 문제

- 전체 결과를 페이지 단위로만 확인할 수 있었음 → 고정 행 높이/여유 범위 방식의 가상 스크롤로 교체
- 임의 정규식은 UI를 멈출 수 있음 → 검색 전용 Worker + 입력 제한 + UI watchdog 종료, 메인 스레드 직접 실행 금지
- 조건 변경 후 늦은 비동기 결과가 남을 수 있음 → 작업별 Worker 종료·참조 일치 검사·cleanup 및 이전 이벤트 참조 해제
- 누락 시각을 기간에 임의 배치할 위험 → 사용자 옵션과 별도 정렬 정책 제공
- 초기 신규 테스트에 불필요한 escape 2건이 있었음 → 수정 후 전체 검사 통과

## 알려진 제약 / 미완료

- 사용자 정규식은 최대 256자. 이벤트별 검색 필드 합 128 Ki 문자, 전체 검색 필드 합 16 Mi 문자 초과 시 오류로 거절. 입력을 몰래 잘라 검색하지 않음
- 일반 검색 키워드는 최대 16개. 강조는 필드별 최대 100구간, 정규식 결과 전체는 20,000구간 한도. 강조 제한이 일치 이벤트 건수에는 영향을 주지 않음
- Worker 부팅은 5초, 데이터 전달·정규식 처리·결과 수신은 1초 watchdog. 느린 기기에서는 유효한 검색도 제한 시간에 걸릴 수 있음. 백그라운드 탭 타이머 지연을 실시간 보장으로 주장하지 않음
- 고정 행 62px/viewport 434px/overscan 5 구현. 브라우저 스크롤 높이 한도와 실제 모바일/접근성 시각 검증 미완료
- 기간 필터는 정규화 epoch가 있는 이벤트만 비교하며, rawTimestamp만 있는 로그는 포함 옵션을 따름. 파일별 시간대 지정은 Phase 6
- 파일 파싱은 여전히 메인 스레드. 검색 Worker는 Phase 3의 ReDoS 격리 목적이며 Phase 7의 파싱 Worker 완료를 뜻하지 않음
- 파일당 2 MiB·세션당 8 MiB 보호 한도, 전체 원문+이벤트를 메모리에 유지. 스트리밍·이벤트/메모리 제한 및 대용량 측정은 Phase 7
- Stack Trace 그룹화/fingerprint, 차트, 요청 타임라인, 내보내기 등 후속 기능 미구현
- 이전 npm audit의 개발 도구 하위 의존성 moderate 10건은 미해결 이력. 이번에는 의존성 추가/변경·감사 재실행 없음

## 변경 파일

- 검색/필터: src/types/search.ts, src/core/filter.ts, src/core/search.ts, src/core/regex-client.ts, src/core/virtual.ts
- Worker/Hook: src/workers/search.worker.ts, src/hooks/useExplorerSearch.ts
- UI/상태: src/app/App.tsx, SearchControls.tsx, VirtualLogTable.tsx, HighlightedText.tsx, src/stores/workspace.ts, src/style.css
- 테스트: src/tests/search.test.ts, regex-worker.test.ts, explorer.test.tsx
- 문서: README.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/ARCHITECTURE.md, docs/TEST-CASES.md
- 버전 메타데이터: package.json, package-lock.json → 0.3.0 (의존성 변경 없음)

## 다음 작업

Phase 4: Java/.NET Stack Trace 이벤트 경계·Caused by/Inner Exception·불완전 입력 처리, 예외 타입·frame 모델 확장, fingerprint 및 반복 오류 그룹화, Exception Analyzer 화면. 원본 위치와 기존 파서/검색 회귀 테스트를 보존한다. 파일 원문·분석 결과를 외부로 전송하지 않는다.
