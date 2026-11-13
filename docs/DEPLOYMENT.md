# 검증과 GitHub Pages 운영

대상 저장소: HeoSeongbin/LogScope-Studio. Pages는 2026-11-13에 workflow 방식으로 활성화했다. 대상 URL은 https://heoseongbin.github.io/LogScope-Studio/ 이며 main f0aef30의 run 43370929769에서 build/deploy/verify-deployment가 모두 성공했다. 실제 공개 사이트의 v0.9.0 분석·JSON 다운로드와 원문 보존도 확인했다. 상세 결과는 PROGRESS.md를 기준으로 한다.

## 로컬 검사

Node.js 24 환경에서 실행한다.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
node scripts/benchmark.mjs test-results/benchmark.json
```

타입 검사는 제품 코드와 E2E 코드를 모두 포함한다. Vitest는 src/tests만 수집하고 Playwright는 e2e만 수집한다. E2E는 Vite 개발 서버가 아닌 dist를 /LogScope-Studio/에서 제공하는 Node 정적 서버를 사용한다. 알 수 없는 파일은 404로 돌려 Worker·샘플 경로 오류를 index.html로 숨기지 않는다.

브라우저 설치/시작이 OS 앱 제어 정책에 차단되면 이를 통과로 보지 않고 정책을 우회하지 않는다. 허용된 Linux CI에서 같은 lockfile/테스트를 실행한다. Playwright mobile 프로젝트는 에뮬레이션이며 실기기 검증이 아니다.

## CI와 배포

- main/codex/** push와 PR은 타입·린트·193개 단위/통합, Production Build, 런타임 audit, 32개 Production E2E와 성능 입력 보존을 검사한다.
- 검증 브랜치/PR은 배포하지 않는다. 성공한 main만 Pages artifact를 배포한다.
- 배포 후 실제 page_url에서 Chromium으로 버전·파일 업로드·파싱/검색 Worker·원문 위치·JSON 다운로드·불필요한 외부 요청 부재를 확인한다.
- 문서/스크린샷만 바뀌면 dist가 같으므로 재검사/재배포를 생략한다. 코드/workflow/lockfile 변경은 생략하지 않는다.
- 실패 trace/screenshot/report와 측정 JSON은 validation-results/deployed-site-verification artifact에 7일 보관한다. 재시도로 실패를 숨기지 않는다(retries=0).
- E2E에는 public/samples와 명시적으로 생성한 가상 문자열만 넣는다. 실제 사용자 로그를 PR/Actions/artifact에 첨부하지 않는다.

기존 앱 버전으로 돌아가야 하면 정상 배포의 소스 커밋을 검토해 새 복구 커밋으로 main에 반영하고 동일 게이트를 통과시킨다. 공유 브랜치를 강제 reset/push하지 않는다. 이 복구 절차 자체의 실제 재배포는 아직 수행하지 않았다.

## 실제 URL 재검증

PowerShell:

```powershell
$env:E2E_BASE_URL = 'https://heoseongbin.github.io/LogScope-Studio/'
npm run test:e2e -- --project=chromium --grep 'production prefix'
Remove-Item Env:E2E_BASE_URL
```

이 검사는 가상 샘플을 브라우저 메모리에서 분석한다. 원격 서버에는 정적 자산 GET만 요청하며 로그 업로드 API는 없다. URL의 마지막 /를 유지한다. npm run test:e2e:report로 마지막 HTML 보고서를 열 수 있다. scripts/ci-status.mjs는 이 저장소 Actions의 읽기 전용 상태/보고서 확인 도구이며 GH_TOKEN/GITHUB_TOKEN 또는 기존 Git Credential Manager 인증을 메모리에서만 사용하고 토큰을 출력/저장하지 않는다.
