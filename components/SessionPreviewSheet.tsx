import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import {
  SessionSummary,
  SessionSetRow,
  getSessionSets,
  getSessionExerciseNotes,
} from '../db/queries';
import { useSettingsStore } from '../store/useStore';
import { toDisplay, unitLabel } from '../lib/units';
import { formatDateWithDay } from '../lib/date';
import { formatDuration } from '../lib/format';
import { MUSCLE_KO } from '../constants/exercises';

const SET_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  WARMUP: { label: 'W', color: '#FF9F0A' },
  DROP: { label: 'D', color: '#BF5AF2' },
  FAILURE: { label: 'F', color: '#FF453A' },
};

type Props = {
  session: SessionSummary | null;
  onClose: () => void;
};

/** 세션 읽기전용 미리보기 (캘린더·운동 탭 공용). */
export default function SessionPreviewSheet({ session, onClose }: Props) {
  const { unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);
  const [sets, setSets] = useState<SessionSetRow[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!session) return;
    let alive = true;
    Promise.all([
      getSessionSets(session.id).catch(() => [] as SessionSetRow[]),
      getSessionExerciseNotes(session.id).catch(() => []),
    ]).then(([s, n]) => {
      if (!alive) return;
      setSets(s);
      const nm: Record<number, string> = {};
      for (const it of n) if (it.note) nm[it.exercise_id] = it.note;
      setNotes(nm);
    });
    return () => { alive = false; };
  }, [session?.id]);

  const groups: { id: number; name: string; brand: string | null; sets: SessionSetRow[] }[] = [];
  const map: Record<number, number> = {};
  for (const s of sets) {
    if (map[s.exercise_id] === undefined) {
      map[s.exercise_id] = groups.length;
      groups.push({ id: s.exercise_id, name: s.exercise_name, brand: s.brand, sets: [] });
    }
    groups[map[s.exercise_id]].sets.push(s);
  }

  return (
    <Modal visible={!!session} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {session?.title?.trim() || (session ? formatDateWithDay(session.date) : '')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          {session && (
            <Text style={styles.sub}>
              {formatDateWithDay(session.date)}
              {session.duration_sec ? ` · ${formatDuration(session.duration_sec)}` : ''}
            </Text>
          )}
          {session?.tags ? (
            <View style={styles.tagBadgeRow}>
              {session.tags.split(',').filter(Boolean).map(t => <Text key={t} style={styles.tagBadge}>{MUSCLE_KO[t] ?? t}</Text>)}
            </View>
          ) : null}
          {session?.note?.trim() ? (
            <Text style={styles.note}>📝 {session.note}</Text>
          ) : null}
          <ScrollView style={{ marginTop: 8 }}>
            {groups.length === 0 ? (
              <Text style={styles.emptyText}>세트 기록이 없습니다</Text>
            ) : groups.map(g => (
              <View key={g.id} style={styles.exCard}>
                <Text style={styles.exName}>{g.name}{g.brand ? ` · ${g.brand}` : ''}</Text>
                {notes[g.id] ? <Text style={styles.exNote}>📝 {notes[g.id]}</Text> : null}
                {g.sets.map(s => {
                  const badge = SET_TYPE_BADGE[s.set_type];
                  return (
                    <View key={s.id} style={styles.setRow}>
                      <Text style={styles.setNum}>
                        {badge ? <Text style={{ color: badge.color }}>{badge.label}</Text> : s.set_order}
                      </Text>
                      <Text style={styles.setVal}>
                        {s.duration_sec != null
                          ? `${s.duration_sec}초`
                          : `${toDisplay(s.weight_kg, unitKg)}${u} × ${s.reps}`}
                      </Text>
                      <Text style={styles.set1rm}>{s.estimated_1rm ? `1RM ${toDisplay(s.estimated_1rm, unitKg)}${u}` : ''}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '700', flex: 1, marginRight: 12 },
  close: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  sub: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  note: { color: '#E5E5EA', fontSize: 13, marginTop: 8, backgroundColor: '#2C2C2E', borderRadius: 8, padding: 10 },
  tagBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagBadge: { color: '#5AB0FF', fontSize: 11, fontWeight: '600', backgroundColor: '#0A2A4A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  emptyText: { color: '#48484A', fontSize: 14, paddingVertical: 8 },
  exCard: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14, marginBottom: 8 },
  exName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  exNote: { color: '#E5C07B', fontSize: 12, marginTop: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  setNum: { color: '#8E8E93', fontSize: 14, width: 28, fontWeight: '700' },
  setVal: { color: '#FFFFFF', fontSize: 15, flex: 1, fontVariant: ['tabular-nums'] },
  set1rm: { color: '#FF3B30', fontSize: 12, fontVariant: ['tabular-nums'] },
});
