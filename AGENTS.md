# GymTracker — 에이전트 작업 지침

이 파일은 프로젝트를 여는 모든 Claude Code 세션이 자동으로 읽는다(계정 공통). 작업 방식·구조·협업 규율을 여기에 둔다.

## Expo 버전 주의
Expo는 버전마다 API가 바뀐다. 코드 작성 전 정확한 버전 문서를 읽을 것:
https://docs.expo.dev/versions/v56.0.0/

## 응답·계획 컨펌 방식
- 사용자와의 모든 소통은 **한국어**로 한다. (기술 용어·코드 식별자는 원문 유지)
- 계획을 컨펌받을 때는 **기능 위주**로 제시한다. 구현 세부(작은 프론트 컴포넌트 변경, 파일·함수명, 스타일 등)는 설명에서 생략한다.
- 개발 관련 질문은 **큰 변화만** — 아키텍처의 큰 변경이나 DB 스키마의 큰 변경일 때만 짚는다.
- ExitPlanMode 전 계획/요약은 "왜 / 사용자 관점에서 무엇이 바뀌나 / (해당 시) 큰 구조·스키마 변화 / 확인 방법" 중심으로 간결하게.

## 두 계정 공유 — git 규율 (중요)
이 폴더는 **두 개의 Claude Code 계정이 번갈아** 사용한다(동시 사용 금지). 과거 git이 별개 히스토리로 분기된 사고가 있었다.
- 세션 **시작 전 `git pull`**, **끝나면 `commit + push`**.
- 한 번에 **한 세션에서만** 수정한다.
- 커밋 시 **의도한 파일만 명시적으로 `git add`** — 다른 세션의 미완성 변경을 함께 커밋하지 말 것.
- 커밋 메시지 끝에 `Co-Authored-By: Claude ...` 유지.

## 프로젝트 구조
- **프론트엔드**: Expo (React Native), 위치 `/Users/shstl/Claude Code/gymtracker`. expo-router(tabs), zustand(persist + AsyncStorage).
- **백엔드**: Spring Boot / Java / JPA / MySQL, 위치 `/Users/shstl/Claude Code/gymtracker-backend`, 포트 **8080**. (ddl-auto: update — 재시작 시 컬럼 자동 추가)
- **GitHub**: github.com/seunghw2/gymtracker, 브랜치 `main`.

## 실행 / 외부망 접속
- 백엔드 8080 → cloudflared **named tunnel** → 고정 도메인 `https://api.hammerslog.trade`. 프론트 `.env`의 `EXPO_PUBLIC_API_URL`이 이를 가리킨다(영구 고정 — 재시작해도 안 바뀜).
- 프론트 실행: `npx expo start --tunnel`(8081), Expo Go로 접속.
- 주의: expo/cloudflared 같은 **장기 실행 서버는 백그라운드 잡에서 자주 종료**된다 → 사용자가 직접 터미널(`!`)에서 띄우는 게 안정적.
