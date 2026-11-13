# 개발 진행

현재 Phase: **Phase 9 테스트 및 배포 완료 — 정의된 자동 검증과 실제 Pages 동작 확인** (2026-11-13).
다음 작업: 유지보수 및 아래 미완료 검증/확장 항목. 새 Phase를 임의로 추가하지 않는다.

## 시작 상태

AGENTS.md, PROJECT.md, PROGRESS.md, DECISIONS.md, README.md와 소스/Git을 비교했다. Phase 8 구현과 기록이 일치했고 main a5e0d56은 origin/main보다 로컬 Phase 7/8 커밋 2개 앞섰으며 작업 트리는 깨끗했다. 기존 18개 파일·192개 테스트를 유지하고 Phase 9 범위에서 브라우저 회귀/배포와 발견된 오류만 수정했다.

원격 기존 run 43161823822는 build 성공/deploy 실패였고 Pages는 비활성이었다. Git 인증으로 해당 저장소만 읽고, 검증 브랜치 codex/phase9-validation에서 CI를 실행했다. 테스트에는 공개 가상 로그만 사용한다.

## 구현 내용

- Playwright 1.65.0 / axe-core/playwright 4.14.0을 개발 의존성에 추가. 제품 번들에 포함하지 않음
- 실제 dist를 /LogScope-Studio/에서 제공하는 정적 검증 서버. 없는 자산은 404로 반환
- Chromium/Firefox/WebKit/mobile Chromium(390px) 4개 프로젝트 × 8개 시나리오
- 업로드·파싱/정규식 Worker·원문 위치/JSON 재사용·혼합 JSON/IIS 진단·재분석/삭제/초기화·파일 시간대/교차 추적·버킷 통계·CSV/HTML·손상 디코딩·취소·반응형·양 테마 axe 검사
- 외부 HTTP 요청/로그 POST/브라우저 오류와 local/session storage 쓰기 부재 확인
- 실제 기본 32 MiB 출력 경계 Node 단위 테스트. UTF-8/UTF-16 손상 진단도 안정적 코드로 강화
- TEXT_DECODE에 인코딩·원래 예외 메시지/cause 보존. 브라우저별 메시지 차이에도 같은 복구 안내
- Dark/Light 보조 텍스트·활성 메뉴·hover·선택 파일 상태 대비 수정. 숨긴 장식 번호와 무관한 모바일 메뉴 테스트
- main/codex/PR CI 게이트, 실패 trace/report 7일 보관, main만 Pages 배포, 배포 후 실제 URL Chromium 검증
- 문서/스크린샷 전용 변경은 앱 dist가 같으므로 재배포 생략
- 아키텍처/CI Mermaid, 배포 가이드·포트폴리오 기술 설명·성능 기록 추가

## 실제 검증 결과

- npm run typecheck / npm run lint / npm test / npm run build: 통과
- Vitest: **18개 파일·193개 테스트 통과**
- Linux CI a35c35e, run **43369744437**: 모든 build 게이트 성공
- Production E2E: **32/32 통과, skip 0·재시도 0·flaky 0**, 약 35초. 각 프로젝트 8개 시나리오
- axe WCAG 2/2.1 A/AA 태그: 펼친 Explorer/파일 설정/상세/내보내기 화면, 양 테마에서 위반 0. 전체 접근성 적합성 감사와 구분
- 런타임 npm audit: **0건**. 전체 audit는 개발용 minimatch 경로의 moderate 10건, high/critical 0
- Production: 메인 약 488 kB/gzip 159 kB, 파싱 Worker 약 190 kB, CSS 약 43 kB
- 1/10/50 MiB 성능 회귀: 로컬 Windows와 Linux CI 모두 1,023/10,230/51,150개 이벤트, 누락/파싱 실패 0
- 50 MiB 전달 포함: Windows 약 647ms/RSS 약 481 MiB, Linux CI 약 1,034ms/RSS 약 514 MiB. 단일 실행이며 SLA/FPS 보장 아님
- 원시 측정: docs/benchmarks/phase9-local.json, phase9-ci.json. 이전 Phase 7 측정도 보존
- GitHub Pages workflow 방식 활성화: API 201, 대상 https://heoseongbin.github.io/LogScope-Studio/
- 배포 소스: **f0aef30222c991365260933e776c38595c42b6c2**. main run **43370929769**의 build/deploy/verify-deployment 모두 성공
- 실제 URL: **https://heoseongbin.github.io/LogScope-Studio/**
- 배포 후 Chromium 1개 E2E 성공: v0.9.0·실제 업로드·두 Worker·원문 줄 범위/JSON 다운로드·저장소/외부 요청 검사
- 실제 IAB 공개 사이트에서도 오류 집중 샘플 12개·ERROR/FATAL 5개·시각 미확인 2개, 실제 Canvas/JSON 다운로드 확인. 다운로드 12개 rawText를 원본 줄 범위와 전부 대조해 일치
- 실제 배포 스크린샷: docs/screenshots/phase9-live-dashboard.jpg, phase9-live-chart.jpg. 관측한 브라우저 console error/warn 없음
- 배포 후 문서/스크린샷 전용 커밋은 dist가 같으므로 새 앱 배포를 만들지 않음. 배포 소스와 문서 커밋을 구분

## 발견 및 해결한 문제 / 검증 이력

- Windows 앱 제어 정책이 새 테스트 브라우저를 차단 → 보안 설정을 우회하지 않고 로컬 실패와 Linux 검증을 구분
- 첫 Linux 실행 20/28 → Dark 작은 텍스트 대비·Firefox/WebKit 디코딩 복구 안내·모바일 테스트의 장식 번호 의존을 수정
- 두 번째 24/28 → Light 활성 메뉴/hover 대비 수정
- 취소/상세 화면까지 확장한 세 번째 28/32 → 선택 파일 상태 대비 수정
- 네 번째 32/32 및 성능 게이트 성공 → 실패를 skip/재시도로 숨기지 않음
- 기존 배포 실패 → Pages 비활성 확인 후 workflow 방식 활성화, 실제 배포 후 확인을 별도 job으로 추가

## 알려진 제약 / 미완료

- 로컬 Windows Playwright 실행은 앱 제어 정책으로 미검증. Linux 브라우저 엔진 검증을 Windows 실행 통과로 표현하지 않음
- Mobile은 에뮬레이션이며 iOS/Android 실기기·Safari 제품·스크린리더·전체 탭 순서·모든 화면/입력 상태의 WCAG 감사는 미완료
- 실제 브라우저 50 MiB/32 MiB 최대 다운로드·저메모리 장시간 세션은 미검증. 32 MiB 경계는 실제 Node 직렬화로 확인
- 필터/집계/추적/내보내기 일부는 메인 스레드이며 결과 전달 지연/임시 복제/GC 비용이 남음
- CSV 접두사·null 표현 손실/스프레드시트 재저장 안전성, 자동 마스킹 부재, 파서 지원 템플릿·레거시 인코딩/PDF/ZIP 한계는 README 참조
- 개발 도구의 moderate 10건은 호환성 없는 강제 다운그레이드/override 없이 남김
- 실제 롤백 재배포는 미실행. 문서의 복구 절차와 검증된 동작을 구분

## 주요 변경 파일

- e2e/workspace.spec.ts, playwright.config.ts, tsconfig.e2e.json, scripts/serve-build.mjs, ci-status.mjs
- .github/workflows/pages.yml, vite.config.ts, eslint.config.js, .gitignore, package.json/package-lock.json (0.9.0)
- src/core/parsing/stream-reader.ts, src/style.css, src/app/App.tsx, src/tests/streaming.test.ts, export.test.ts
- scripts/benchmark.mjs, docs/benchmarks/phase9-*.json
- README.md, PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, TEST-CASES.md, PERFORMANCE.md, DEPLOYMENT.md, PORTFOLIO.md

## 다음 작업

계획된 Phase 9의 배포 완료 기준을 충족했다. 이후 유지보수·실기기/스크린리더·대표 실제 로그의 한계 검증 및 미지원 파서/인코딩/내보내기 확장은 별도 사용자 지시로 진행한다. 정의된 테스트 범위를 넘어 프로젝트의 모든 요구/모든 환경을 검증했다고 주장하지 않는다.
