# GymTracker 프로젝트 현황 & 로드맵

> 최종 업데이트: 2026-06-16
> 이 문서는 프로젝트의 진행 상황과 향후 작업을 추적하는 살아있는 문서입니다.

---

## 1. 아키텍처 개요

| 영역 | 스택 | 비고 |
|------|------|------|
| 프론트엔드 | Expo SDK 54, expo-router, zustand, react-native-chart-kit | 저장소: `github.com/seunghw2/gymtracker` |
| 백엔드 | Spring Boot 3.4, Java 21, Spring Security 6 + JWT, JPA, MySQL 8 | 저장소: `github.com/seunghw2/gymtracker-backend` |
| 데이터 | 프론트는 백엔드 REST API 호출 (이전 로컬 SQLite에서 전환 완료) | DB: MySQL `localhost:3307/gymtracker` |
| 개발 환경 | Metro 터널(@expo/ngrok, 8081) + 백엔드 cloudflared 터널(8080) | 아이폰 Expo Go로 원격 테스트 |

---

## 2. 완료된 기능 (상세)

### 2.1 백엔드 (Spring Boot + MySQL) — 거의 전 기능 구현 완료

**인증 (`auth/`)**
- 이메일 회원가입 `POST /api/v1/auth/signup`
- 이메일 로그인 `POST /api/v1/auth/login` (BCrypt 해싱)
- 카카오 OAuth 로그인 `POST /api/v1/auth/kakao` (kapi.kakao.com 토큰 검증)
- 토큰 갱신 `POST /api/v1/auth/refresh` (refresh rotation, 이전 토큰 무효화)
- 로그아웃 `POST /api/v1/auth/logout`
- 내 정보 `GET /api/v1/auth/me`
- AccessToken 60분 / RefreshToken 14일, RefreshToken DB 저장

**운동 종목 (`exercise/`)**
- 시스템 시드 12종 자동 등록 (`DataInitializer`)
- 목록 조회 + 필터(부위/장비/브랜드) `GET /api/v1/exercises`
- 내 커스텀 운동 `GET /api/v1/exercises/custom`
- 커스텀 등록/삭제 `POST`, `DELETE /api/v1/exercises/{id}`

**운동 세션/세트 (`workout/`)**
- 세션 생성/히스토리/상세/수정(duration·gym·note)/삭제
- 세트 추가/삭제, 이전 세션 세트 조회
- Epley 공식 1RM 자동 계산

**신체기록 (`bodylog/`)**: 체중/체지방 날짜기준 upsert, 목록, 최신

**헬스장 (`gym/`)**: 유저별 목록/추가/삭제

**설정 (`settings/`)**: 유저별 key-value get/put

**통계 (`stats/`)**: 1RM 히스토리, 캘린더(월별 날짜/카운트/시간), 스트릭, 주간 카운트, 전체 운동일(workout-dates)

**공통/설정 (`config/`, `common/`)**
- 유저별 데이터 격리(모든 쿼리 userId 기준)
- 개발용 자동 인증: `DevAutoAuthFilter` + `DevDataInitializer` (local 프로파일에서 `dev@local.dev`로 무인증 통과)
- 전역 예외 처리, JWT 필터, CORS

### 2.2 프론트엔드 (Expo RN) — 화면별

**홈 (`app/(tabs)/index.tsx`)**: 주간 운동수, 연속 스트릭, 목표체중 진행바, 주간 도트, 체중 입력 다이얼 모달, 운동 시작 버튼

**운동 (`app/(tabs)/workout.tsx`)**: 세션 시작/종료(경과 타이머), 과거 날짜로 시작(date picker), 단계별 운동 추가(부위→장비→브랜드→종목) + 종목 검색, 커스텀 종목·브랜드 등록, 세트 입력(무게/횟수/완료 체크), 1RM 뱃지, 휴식 타이머, 세트 스와이프 삭제(백엔드 동기화), 종목 통째 삭제(✕), 이전 기록 자동 채움, 세션 히스토리 + 상세 모달(날짜 수정·세션 삭제·세트 삭제)

**통계 (`app/(tabs)/stats.tsx`)**: 1RM 성장 차트(종목별), 체중 차트, 목표 진행도

**캘린더 (`app/(tabs)/calendar.tsx`)**: 월 그리드, 운동일 표시, 스트릭, 월 요약(횟수/시간)

**설정 (`app/(tabs)/settings.tsx`)**: 계정/로그아웃, 목표(체중/체지방/휴식시간), kg 단위 토글, 헬스장 관리, 커스텀 운동 관리

**인증 (`app/(auth)/`)**: 로그인/회원가입/카카오 화면 (현재 dev 모드로 우회 중)

**인프라**: SQLite → REST API 전면 전환(`db/queries.ts`), 토큰 자동 갱신 클라이언트(`lib/api.ts`), 루트 `GestureHandlerRootView` 적용

### 2.3 개발 환경 정비 (완료)
- GitHub SSH 키 등록 → push 시 모바일 승인 불필요
- Claude Code `bypassPermissions` 설정 → 명령 자동 승인
- Expo SDK 54 의존성 정합(expo-crypto 등 9개 버전 정렬)
- 터널 기반 아이폰 원격 테스트 환경

---

## 3. 향후 작업 (세분화)

### AI 리포트 v2 (애널리스트) — 🚧 진행 중 (2026-06-16)
명세: 6종 기간(session/week/month/quarter/half/year)을 **하나의 2층 컴포넌트**로 렌더 + 기간 스코프 채팅. "계산은 코드, 해석만 LLM".
- [x] 백엔드 통합 리포트 `GET /api/v1/ai/v2/report?type=` — 명세 §7 스키마(`AiReportV2`). 서술은 기존 주간 LLM 파이프라인 재사용(기간만 교체), 구조화 detail은 코드 매핑(`ReportV2Service`)
- [x] 백엔드 기간 스코프 채팅 `POST /api/v1/ai/v2/chat`(`AiChatService`) — 해당 기간 facts만 주입, 스코프 밖 질문은 정직하게 거절
- [x] 프론트 통합 타입/호출(`db/api/ai.ts`), 단일 2층 렌더러(`components/ReportView.tsx`), 기간 셀렉터 화면(`app/ai/reports.tsx`), 채팅 화면(`app/ai/chat.tsx`)
- [x] 로컬 JWT 발급으로 백엔드 실호출 테스트 완료(week/month SUCCESS, 채팅·스코프 가드 검증)
- [x] 아카이브 리스트(과거 리포트 혼합 목록) — `GET /v2/archive` + `back` 파라미터로 과거 인스턴스 조회(`app/ai/archive.tsx`)
- [x] 세션 리포트(운동 종료 후 진입) — `type=session`(`ReportPeriod.resolveSession`) + 종목별 detail.exercises(`ReportView` 렌더)
- [ ] 하단 "리포트 탭" 신설(현재 AI 화면 경유)
- [ ] 목표 진척 게이지(분기+), 요일 히트맵(주간), 체중 추세 포인트, 일관성 score, 타임라인 세션 단위화

### 세션 기본기 보완 — ✅ 완료 (2026-05-30)
- [x] 세션 이름(title) — 백엔드 `WorkoutSession.title` 컬럼/DTO 추가, 시작·세션중·상세·히스토리에서 입력/표시
- [x] 세션 도중 취소 — 헤더 "취소" 버튼 → 백엔드 세션 삭제 후 종료(빈 세션 잔존 방지)
- [x] 스크롤(스피너) 데이트피커 — `components/DatePickerSheet.tsx`(확인/취소 모달), 시작·상세 공용
- [x] 완료 세트 값 수정 — 백엔드 `PATCH /workouts/sets/{id}`(1RM 재계산), 세션중·상세에서 인라인 수정
- [x] 세션 메모(note) 입력 UI — 세션중·상세에서 입력
- [x] 시작 시 헬스장 선택(gymId) — 시작 박스 헬스장 선택, 헤더/상세에 헬스장명 표시
- (메모) prod는 `ddl-auto: validate`라 배포 시 title 컬럼 정식 마이그레이션 필요

### 기본 CRUD 보완 — ✅ 완료 (2026-05-29)
- [x] 과거 날짜로 운동 시작 + 상세 모달에서 세션 날짜 수정 (백엔드 `UpdateSessionRequest.date` 추가)
- [x] 운동 선택 모달 종목 검색(이름 부분일치)
- [x] 진행 중 세션에서 종목 통째 삭제(완료 세트는 백엔드도 삭제)
- [x] 세트 스와이프 삭제 백엔드 동기화(완료 세트 setId 추적 → `DELETE /sets/{id}`)
- [x] 과거 세션 삭제 + 개별 세트 삭제(상세 모달)
- (범위 밖) 과거 세트 값 인라인 수정(백엔드 `PATCH /sets` 부재)

### 우선순위 A — 미완성 핵심 기능

**A1. 통계 "볼륨" 탭 구현** — ✅ 완료 (2026-05-29)
- [x] 백엔드: 볼륨(Σ 무게×횟수) 집계 API `GET /api/v1/stats/volume` (최근 8회 윈도우)
- [x] 부위별 볼륨 분해 (`byMuscle`)
- [x] 프론트: 일자별 총볼륨 추이 차트 + 부위별 볼륨 차트
- [x] 빈 데이터 처리
- (보류) 주/월 토글은 추후

**A2. 체지방 기록/차트** (백엔드는 이미 지원)
- [ ] 홈 체중 모달에 체지방(%) 입력 필드 추가
- [ ] `upsertBodyLog`에 body_fat_pct 전달 연결
- [ ] 통계에 체지방 추이 차트 추가
- [ ] 설정의 목표 체지방률과 진행도 연동

**A3. 세션 시작 시 헬스장 선택** (백엔드 gymId 지원, UI만 없음)
- [ ] `handleStartWorkout`에 헬스장 선택 모달/드롭다운 추가
- [ ] `createWorkoutSession(date, gymId)` 연결
- [ ] 세션 히스토리·상세에 헬스장명 표시

### 우선순위 B — 운영/품질

**B1. 실제 인증 활성화** (현재 dev 자동인증 우회)
- [ ] 프론트: 로그인 강제 흐름 복원(`_layout.tsx` guest→login)
- [ ] 백엔드: 운영 시 `DevAutoAuthFilter`/`DevDataInitializer` 비활성(프로파일 분리 확인)
- [ ] 카카오 로그인 실 REST API 키 설정 + redirect URI 등록
- [ ] 로그인/회원가입 화면 e2e 검증

**B2. 고정 도메인 배포** (가비아 + Cloudflare)
- [ ] 가비아 도메인 구입
- [ ] Cloudflare 무료 가입 → 도메인 등록 → 네임서버 변경
- [ ] `cloudflared` named tunnel로 `api.도메인` 고정 연결
- [ ] 프론트 `EXPO_PUBLIC_API_URL` 고정 도메인으로 변경
- [ ] (선택) 백엔드 클라우드 배포로 전환

**B3. kg/lb 단위 토글 반영**
- [ ] `unitKg` 설정값을 실제 무게 표시/입력에 적용(변환 유틸)
- [ ] 홈·운동·통계 전반 단위 일관 적용

### 우선순위 C — 보완

- [ ] **C1. 세션 메모(note)** 프론트 입력 UI (백엔드 지원됨)
- [ ] **C2. 스트릭 로직 통일** — 클라 계산 제거하고 백엔드 `/stats/streak` 사용
- [ ] **C3. 자동화 테스트** — 백엔드 단위/통합 테스트, 프론트 핵심 흐름 테스트
- [ ] **C4. 운영 DB 마이그레이션** — `ddl-auto=validate` + Flyway 도입(README 권장사항)
- [ ] **C5. 휴식 타이머 라이브 액티비티(다이나믹 아일랜드/잠금화면)** — 앱을 벗어나도 잠금화면·다이나믹 아일랜드에 휴식 카운트다운 실시간 표시.
  - 요구: iOS ActivityKit Live Activity → **Expo Go 불가**, 네이티브 위젯 익스텐션 + config plugin + **정식(dev) 빌드** 필요(Apple 개발자 설정 포함). 안드로이드는 대응 위젯/포그라운드 서비스 별도.
  - 규모 큼(네이티브). 현재는 앱 내 모든 탭 표시 + 잠금화면 종료 알림으로 대체 중. dev build 전환 시 착수.

---

## 4. 운영 메모
- cloudflared(임시 터널) 재시작 시 `*.trycloudflare.com` URL이 바뀜 → `gymtracker/.env`의 `EXPO_PUBLIC_API_URL` 갱신 후 Metro 재시작 필요. (B2 완료 시 해소)
- `.env`는 `.gitignore` 처리됨(터널 URL·카카오 키 미커밋).
