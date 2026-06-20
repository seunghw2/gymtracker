import { ReportScreen } from '../../components/report/ReportScreen';

/** 리포트 탭 — 다른 탭과 동일하게 즉시 전환(슬라이드·뒤로가기 없음). */
export default function ReportsTab() {
  return <ReportScreen showBack={false} />;
}
