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
  freeNote: string | null;
};

export type AiProfileInput = {
  goalPhysique: string;
  priorityMuscles: string[];
  weeklyFrequencyTarget?: number | null;
  constraints?: string[];
  experienceLevel?: string | null;
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
