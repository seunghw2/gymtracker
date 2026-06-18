import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiText } from './api';
import { todayStr } from './date';

/** 운동 기록 CSV를 받아 공유 시트로 내보낸다. */
export async function exportWorkoutsCsv(): Promise<void> {
  const csv = await apiText('/api/v1/stats/export');
  const stamp = todayStr();
  const file = new File(Paths.cache, `gymtracker-${stamp}.csv`);
  try {
    file.create({ overwrite: true });
  } catch {
    /* 이미 존재 등 무시 */
  }
  file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: '운동 기록 내보내기' });
  }
}
