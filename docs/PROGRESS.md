# 개발 진행

현재 Phase: **Phase 8 UI/UX 및 내보내기 구현·자동 검증 및 브라우저 스모크 확인** (2026-11-13).
다음 Phase: **Phase 9 테스트 및 배포**. 전체 E2E·브라우저 호환성·접근성 적합성·실제 Pages 배포는 미완료다.

## 시작 상태와 범위

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 소스/Git을 확인했다. Phase 7 구현이 기록과 일치했고 기존 15개 파일·162개 테스트가 통과했다. main은 99604bf이며 origin/main보다 로컬 커밋 1개 앞섰고 작업 트리는 깨끗했다. 이번에는 Phase 8만 구현했으며 커밋/푸시는 수행하지 않았다.

## 구현 내용

- Dark/Light CSS 팔레트와 실제 Chart.js 축/범례 전환. 테마/너비는 메모리 상태만 사용
- 상세 패널 260~560px 네이티브 range 조절·초기화, 좁은 화면 단일 열·모바일 메뉴 가로 스크롤
- 본문 skip link, nav/region 라벨, 초점 표시, 진행/취소 알림, 가상 목록 방향키/Page/Home/End와 모바일 끝 행 이동
- 파일 파싱 단계 한국어 안내 및 자원/Worker/인코딩 오류별 복구 방법. 원래 진단은 유지
- 현재 필터/전체 세션 이벤트, 예외 그룹 전체/선택 예외, 선택 typed-scoped ID 관측 타임라인, 요약/UTC 시간대별 통계 내보내기
- JSON metadata/rows, CSV BOM·CRLF·고정 컬럼·수식 위험 접두사 방어, 정적 HTML 요약·데이터 리포트
- 원문/행/파싱 실패/필드 부재·null 시각·예외 트리·파일 설정 근거 보존. 로그에 없는 시각·ID·원인을 만들지 않음
- 이벤트 50,000개 / 결과 UTF-8 32 MiB 보호, 생성 행 진행률·취소, 변경/제거/초기화 후 늦은 다운로드 차단
- 민감 정보 경고, HTML 텍스트 이스케이프/CSP, 임시 anchor와 object URL 정리. 서버 전송/자동 영구 저장 없음
- README·아키텍처·테스트 기록·ADR-026~028 및 실제 가상 샘플 스크린샷 4장

## 실제 검증 결과 (2026-11-13)

- npm run typecheck: 통과
- npm run lint: 통과
- npm test: 18개 파일·192개 테스트 통과 (기존 162개 회귀 포함)
- npm run build: 통과. 메인 약 488 kB / gzip 159 kB, 파싱 Worker 약 189 kB, CSS 약 42.5 kB
- JSON round trip/Unicode·CRLF·null·위치·파싱 실패, CSV quote/BOM/수식 접두사/중첩 값, HTML escape/CSP 검증
- 실제 예외 그룹/선택 예외·추적 정렬/미확인 시각·UTC 버킷/빈 통계·한도 초과 전체 실패 검증
- 바이트 한도의 UTF-8 계산, 시작 전/행 배치 사이 취소, stale scope/언마운트, URL 정리 검증
- jsdom: 필터/전체 구분, 무효 필터 차단, 선택 예외/추적/통계 연결, 테마/너비·키보드 가상 목록 마지막 행 검증
- 실제 IAB 브라우저 개발 서버: spring-exception.log → 3개 이벤트, 첫 원문 줄 1~9/다음 10~18/마지막 19 확인
- 실제 JSON/CSV/HTML 파일 다운로드 성공. 다운로드 JSON의 rawText 전체를 샘플 원본 줄 slice와 대조하고 CSV 3개 이벤트의 rawText가 JSON과 같음을 확인. HTML 11,472바이트, 스크립트 태그 없음/CSP 포함 확인
- 실제 Dark/Light Canvas 렌더링, 키보드 End로 상세 너비 560px 및 초기화 320px, 원문 상세 확인
- 실제 390×844 viewport: 페이지 가로 넘침 없음(body scrollWidth 375, viewport 390), 상세 단일 열. 메뉴 가로 스크롤·활성 화면 노출 확인
- 브라우저 콘솔 error/warn 관측 없음. 화면 증거는 docs/screenshots/phase8-*.jpg

## 발견 및 해결한 문제

- 무효/대기 필터 결과를 전체 결과로 내보낼 위험 → 대상별 ready/disabled와 명시적 전체 세션 선택
- 범위 변경 후 이전 파일이 다운로드될 위험 → revision/AbortController로 취소
- CSV 원문이 수식으로 해석될 위험 → quote·위험 접두사 방어, 원본 무변경과 JSON 재사용 안내
- HTML 리포트가 로그를 실행할 위험 → 모든 동적 값 escape 및 외부 리소스/스크립트 차단 CSP
- 모바일 활성 nav가 기존 CSS에서 숨겨질 수 있음 → 가로 메뉴에서 활성 상태도 표시
- 모바일 End 키의 고정 높이 계산이 마지막 행을 가릴 수 있음 → 실제 viewport 높이 반영
- 첫 샌드박스 개발 서버는 소켓 접근 차단/브라우저 timeout → 허용된 로컬 개발 서버 실행 후 실제 검증. 이 접속 실패를 파싱 성공으로 처리하지 않음

## 알려진 제약 / 미완료

- 브라우저 확인은 단일 IAB 환경·가상 샘플·개발 서버 스모크다. Production 배포/Firefox/Safari/모바일 실기기/전체 E2E는 미검증
- 전체 키보드 탭 순서·스크린리더·색 대비/WCAG 적합성 감사는 미완료. 단위 테스트/390px 화면 확인과 구분
- CSV null/누락/빈 문자열 구분 불가, 수식 방어 접두사가 값에 추가됨. 스프레드시트 재저장/환경별 수식 안전성은 보장하지 않음
- HTML은 다운로드·문자열/CSP 확인을 했으며 모든 리포트 크기·브라우저의 열람/인쇄 호환성은 미검증. PDF/ZIP 및 원본 파일 바이트 Export 미지원
- 큰 입력의 데이터 준비/단일 레코드 직렬화·필터/집계/추적은 메인 스레드. 취소는 다음 확인 지점에서 적용되며 완전 무정지 보장 없음
- 자동 마스킹 없음. 다운로드에는 원문·파일명·식별자·검색식·설정이 들어갈 수 있음
- 32 MiB 경계는 자동 테스트의 낮춘 바이트 한도로 검증했으며 실제 브라우저 최대 크기 다운로드/저메모리 안정성 실측은 미완료
- Phase 7 벤치마크와 입력/메모리 한도는 PERFORMANCE.md 참조. 이전 npm moderate 10건 보고는 상세 재감사 미실행

## 주요 변경 파일

- 내보내기/피드백: src/core/export.ts, download.ts, feedback.ts, src/app/ExportControls.tsx
- UI: src/stores/ui.ts, src/style.css, App.tsx, FileParserSettings.tsx, VirtualLogTable.tsx, TraceExplorer.tsx, StatisticsDashboard.tsx, StatisticsCharts.tsx
- 테스트: export.test.ts, export-ui.test.tsx, download.test.ts, statistics-ui.test.tsx
- 문서/버전: README.md, PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md, docs/screenshots/*, package.json/package-lock.json → 0.8.0

## 다음 작업

Phase 9: 브라우저 E2E·배포 경로/Worker/다운로드·접근성·한계 입력 회귀를 보강하고 CI/실제 GitHub Pages 배포를 검증한다. 사용자 지시 후 진행한다. 미검증 항목을 프로젝트 전체 완료로 처리하지 않는다.
