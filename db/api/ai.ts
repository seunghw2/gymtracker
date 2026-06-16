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
export type ReportStatusV2 = 'SUCCESS' | 'PROFILE_REQUIRED' | 'INSUFFICIENT_DATA' | 'FAILED';

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
  comment: string | null;
};
export type RGoalProgress = { goalLabel: string; value: number; comment: string } | null;
export type RPrescription = { horizon: string; action: string; why: string; todo: string };

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
};

export type AiReportV2Response = { status: ReportStatusV2; message: string | null; report: AiReportV2 | null };

/** 통합 리포트 조회/생성. type별 완료된 직전 기간 회고. */
export async function getReportV2(type: ReportPeriodType, force = false): Promise<AiReportV2Response> {
  const qs = `?type=${type}${force ? '&force=true' : ''}`;
  return apiRequest<AiReportV2Response>(`/api/v1/ai/v2/report${qs}`, { method: 'GET' });
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
