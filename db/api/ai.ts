import { apiRequest } from '../../lib/api';

// ── AI 브리핑 타입(백엔드 camelCase 응답과 1:1) ──────────────────────────

export type AiConfidence = 'high' | 'medium' | 'low';
export type AiMetricDirection = 'up' | 'down' | 'flat' | null;

export type AiSummaryMetric = {
  label: string;
  value: string;
  delta: string | null;
  direction: AiMetricDirection;
};

export type AiPrescription = {
  action: string;
  why: string;
  thisWeek: string;
};

export type AiBriefing = {
  headline: string;
  summaryMetrics: AiSummaryMetric[];
  strengths: string[];
  watchouts: string[];
  prescription: AiPrescription;
  confidence: AiConfidence;
  dataCaveat: string | null;
};

export type AiReportStatus = 'SUCCESS' | 'INSUFFICIENT_DATA' | 'PROFILE_REQUIRED' | 'FAILED';

export type AiStagnation = { exercise: string; weeksFlat: number };

/** POST /ai/report · GET /ai/report/latest 응답 래퍼. */
export type AiReportResult = {
  status: AiReportStatus;
  generatedAt: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  model: string | null;
  report: AiBriefing | null;
  /** 부가 정보(입력 집계에서) — 상세 리포트 표시용. */
  stagnation: AiStagnation[] | null;
  notesQuote: string | null;
  message: string | null;
};

export type AiProfile = {
  goalPhysique: string;
  priorityMuscles: string[];
  weeklyFrequencyTarget: number | null;
  constraints: string[];
  experienceLevel: string | null;
  trainingMonths: number | null;
  splitStyle: string | null;
  sessionMinutes: number | null;
  freeNote: string | null;
};

export type AiProfileInput = {
  goalPhysique: string;
  priorityMuscles: string[];
  weeklyFrequencyTarget?: number | null;
  constraints?: string[];
  experienceLevel?: string | null;
  trainingMonths?: number | null;
  splitStyle?: string | null;
  sessionMinutes?: number | null;
  freeNote?: string | null;
};

// ── 호출 ────────────────────────────────────────────────────────────────

/** 인테이크 프로필 조회. 미설정(204)이면 null. */
export async function getAiProfile(): Promise<AiProfile | null> {
  const r = await apiRequest<AiProfile | undefined>('/api/v1/ai/profile');
  return r ?? null;
}

/** 인테이크 프로필 저장(생성/수정). */
export async function putAiProfile(input: AiProfileInput): Promise<AiProfile> {
  return apiRequest<AiProfile>('/api/v1/ai/profile', { method: 'PUT', body: input });
}

/** 인테이크 프로필 삭제(온보딩 초기화 — 개발/테스트용). */
export async function deleteAiProfile(): Promise<void> {
  await apiRequest<void>('/api/v1/ai/profile', { method: 'DELETE' });
}

// ── 통합 리포트(명세 §7) — 6종 기간을 한 스키마로 ─────────────────────────

export type ReportPeriodType = 'session' | 'week' | 'month' | 'quarter' | 'half' | 'year';
export type ReportStatusV2 = 'SUCCESS' | 'PROFILE_REQUIRED' | 'INSUFFICIENT_DATA' | 'FAILED' | 'GENERATING';

export type RPoint = { x: string; y: number };
export type RMetric = { label: string; value: string; delta: string | null; direction: AiMetricDirection };
export type RScore = { label: string; value: number; unit: string; tone: string } | null;

export type RTimelineItem = { kind: string; title: string; body: string | null; tag: string | null };
export type RExerciseLine = { name: string; sets: string; prevDelta: string | null; isPR: boolean };
export type RBalanceItem = { part: string; sets: number; target: number; status: string };
export type RGrowthItem = { name: string; change: string; direction: AiMetricDirection };
export type RStagnationItem = { name: string; weeksFlat: number };
export type RMilestone = { icon: string; text: string };
export type RTrendSeries = { metric: string; points: RPoint[] };

export type RMeasure = { current: number | null; delta: string | null; trend: RPoint[] };
export type RBodyComposition = {
  display: 'none' | 'oneLine' | 'line' | 'beforeAfter';
  weight: RMeasure | null;
  bodyFat: RMeasure | null;
  waist: RMeasure | null;
  recomp: string | null;
  comment: string | null;
};

export type RConsistency = {
  attendancePct: number; sessions: number; planned: number;
  longestGapDays: number; weeklyAvg: number; streak: number; strip: number[];
};
export type RCoachItem = {
  key: string; chapter: number; icon: string; title: string; body: string;
  badge: string | null; defaultOn: boolean;
};
export type RGoalProgress = { goalLabel: string; value: number; comment: string } | null;
export type RPrescription = { horizon: string; action: string; why: string; todo: string };

// ── 데이터 탭 21카드 확장(명세 §6) — 없는 블록은 null → 자동 숨김 ──────────
export type RTone = 'ok' | 'good' | 'warn' | 'bad';
export type RRoutineAdherence = { completedSessions: number; plannedSessions: number; onPlanDays: number; planTargetDays: number };
export type RVolBar = { label: string; tons: number; tone: RTone };
export type RWeekdayBar = { day: string; count: number; active: boolean };
export type RMuscleFreqDays = { part: string; perWeek: number; low: boolean };
export type RSlice = { label: string; pct: number; rank: number };
export type RBalancePair = { leftLabel: string; leftPct: number; rightLabel: string; rightPct: number };
export type ROverload = { up: number; hold: number; stall: number; total: number; pct: number };
export type RRepRange = { strengthPct: number; hyperPct: number; endurancePct: number; avgE1rmPct: number };
export type RIntensityScore = { value: number; delta: string | null; spark: RPoint[] };
export type RRelStrength = { lift: string; multiple: number; grade: string; barPct: number };
export type RPrItem = { name: string; value: string; isNew: boolean };
export type RLbm = { current: number | null; delta: string | null; trend: RPoint[] | null; comment: string | null };
export type RGoalItem = { label: string; detail: string; pct: number; tone: RTone };
export type RSessionStats = { sessions: number; sets: number; reps: number; avgMin: number; setsPerSession: number; prs: number };
export type RDensityRest = { densityKgPerMin: number; avgRest: string | null; totalRestMin: number; note: string | null };
export type RDiversity = { exercises: number; equipment: number; newCount: number };
export type RTimeBucket = { label: string; count: number; peak: boolean };
export type RRecoveryItem = { part: string; days: number; tone: RTone };
export type RHighlight = { kind: string; label: string; value: string; tone: RTone };
export type RCards = {
  routineAdherence: RRoutineAdherence | null;
  volumeBars: RVolBar[] | null;
  weekdayFreq: RWeekdayBar[] | null;
  muscleFreqDays: RMuscleFreqDays[] | null;
  muscleVolumeShare: RSlice[] | null;
  muscleBalance: RBalancePair[] | null;
  overload: ROverload | null;
  repRange: RRepRange | null;
  intensityScore: RIntensityScore | null;
  relativeStrength: RRelStrength[] | null;
  prTimeline: RPrItem[] | null;
  lbm: RLbm | null;
  goals: RGoalItem[] | null;
  sessionStats: RSessionStats | null;
  densityRest: RDensityRest | null;
  diversity: RDiversity | null;
  timeOfDay: RTimeBucket[] | null;
  recovery: RRecoveryItem[] | null;
  highlights: RHighlight[] | null;
};

export type AiReportV2 = {
  id: string;
  period: { type: ReportPeriodType; label: string; start: string; end: string; nextReportEtaDays: number | null };
  confidence: AiConfidence;
  dataCaveat: string | null;
  headline: string;
  summary: { score: RScore; metrics: RMetric[]; oneLiner: string };
  detail: {
    timeline: RTimelineItem[];
    exercises: RExerciseLine[] | null;
    balance: RBalanceItem[] | null;
    growth: RGrowthItem[] | null;
    stagnation: RStagnationItem[] | null;
    milestones: RMilestone[] | null;
    trends: RTrendSeries[] | null;
    heatmap: number[] | null;
  };
  bodyComposition: RBodyComposition | null;
  goalProgress: RGoalProgress;
  prescription: RPrescription;
  notesQuote: string | null;
  suggestedQuestions: string[];
  consistency: RConsistency | null;
  coaching: RCoachItem[] | null;
  cards: RCards | null;
};

export type AiReportV2Response = {
  status: ReportStatusV2;
  message: string | null;
  report: AiReportV2 | null;
  percent?: number | null;
  step?: string | null;
};

/**
 * 통합 리포트 조회/생성. back=n이면 n기간 이전(아카이브).
 * range를 주면 그 임의 달력 구간(주/월/분기/반기·진행 중)으로 분석한다(back 무시).
 */
export async function getReportV2(
  type: ReportPeriodType,
  back = 0,
  force = false,
  range?: { from: string; to: string; label?: string },
): Promise<AiReportV2Response> {
  let qs = `?type=${type}&back=${back}${force ? '&force=true' : ''}`;
  if (range) {
    qs += `&from=${range.from}&to=${range.to}${range.label ? `&label=${encodeURIComponent(range.label)}` : ''}`;
  }
  return apiRequest<AiReportV2Response>(`/api/v1/ai/v2/report${qs}`, { method: 'GET' });
}

export type ArchiveEntry = { id: string; type: ReportPeriodType; label: string; start: string; end: string; back: number };

/** 과거 리포트 아카이브(시간 역순 혼합 목록). */
export async function getArchive(): Promise<{ items: ArchiveEntry[] }> {
  return apiRequest<{ items: ArchiveEntry[] }>('/api/v1/ai/v2/archive', { method: 'GET' });
}

export type ChatTurn = { role: 'user' | 'ai'; content: string };
export type ChatReply = { content: string; suggestedQuestions: string[] };

/** 기간 스코프 채팅 — 답변은 해당 리포트 기간에 한정. */
export async function askReportChat(input: {
  reportId: string; period: ReportPeriodType; question: string; history: ChatTurn[];
}): Promise<ChatReply> {
  return apiRequest<ChatReply>('/api/v1/ai/v2/chat', { method: 'POST', body: input });
}

/** 주간 브리핑 생성/캐시 조회. */
export async function generateAiReport(opts: { from?: string; to?: string; force?: boolean } = {}): Promise<AiReportResult> {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.force) params.set('force', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<AiReportResult>(`/api/v1/ai/report${qs}`, { method: 'POST' });
}

/** 최근 성공 브리핑. */
export async function getLatestAiReport(): Promise<AiReportResult> {
  return apiRequest<AiReportResult>('/api/v1/ai/report/latest');
}
