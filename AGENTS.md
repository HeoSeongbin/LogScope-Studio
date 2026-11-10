# 에이전트 작업 규칙

작업 전에 PROJECT.md, docs/PROGRESS.md, docs/DECISIONS.md와 현재 소스, Git 상태를 확인한다. 현재 Phase와 변경 영향을 분석하고 기존 정상 기능을 보존한다.

실제 동작하는 기능과 관련 단위 테스트를 구현한다. 원본 텍스트와 위치 정보를 보존하며 로그에 없는 시간, 식별자, 통계를 만들지 않는다. 로그를 서버로 보내거나 브라우저 저장소에 자동 저장하지 않는다.

작업 후 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`를 실행하고 결과를 기록한다. 검증하지 않은 기능을 완료 처리하지 않는다. README.md와 docs/PROGRESS.md를 최신화하고 중요한 결정은 docs/DECISIONS.md에 ADR로 기록한다. 미완료 작업과 다음 Phase를 명시한다.

최초 구현 범위는 Phase 0과 Phase 1이다. 후속 기능은 사용자 지시 후 확장한다.
