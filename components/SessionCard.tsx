import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { SessionSummary } from '../db/queries';
import { formatShortWithWeekday } from '../lib/date';
import { useSessionActions } from '../hooks/useSessionActions';
import SessionPreviewSheet from './SessionPreviewSheet';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

type Props = {
  session: SessionSummary;
  onChanged?: () => void;
};

function MenuItem({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, danger && styles.menuItemDanger]}>{label}</Text>
    </Pressable>
  );
}

export default function SessionCard({ session, onChanged }: Props) {
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const { startAsIs, saveAsTemplate, rename, remove, edit } = useSessionActions();
  const tags = session.tags ? session.tags.split(',').filter(Boolean) : [];

  const close = () => setMenu(false);
  // 메뉴 닫힘 애니메이션 후 액션 실행(Alert/네비게이션이 모달과 겹치지 않게)
  const run = (fn: () => void) => { close(); setTimeout(fn, 180); };

  return (
    <Pressable style={styles.card} onPress={() => setPreview(true)}>
      <View style={styles.topRow}>
        <Text style={styles.date}>{formatShortWithWeekday(session.date)}</Text>
        <View style={styles.topRight}>
          {tags.length > 0 && (
            <View style={styles.tagCapsule}>
              {tags.map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && <View style={styles.tagDivider} />}
                  <Text style={styles.tagText}>{t}</Text>
                </React.Fragment>
              ))}
            </View>
          )}
          <Pressable hitSlop={10} onPress={() => setMenu(true)} style={styles.menuBtn}>
            <Text style={styles.menuDots}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>{session.title?.trim() || '운동'}</Text>

      <Text style={styles.stats}>
        <Text style={styles.statNum}>{session.exercise_count}</Text>종목 · <Text style={styles.statNum}>{session.set_count}</Text>세트
        {session.duration_sec ? <Text> · <Text style={styles.statNum}>{formatDuration(session.duration_sec)}</Text></Text> : null}
      </Text>

      {session.exercise_names ? (
        <Text style={styles.exercises} numberOfLines={1}>{session.exercise_names}</Text>
      ) : null}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.menuOverlay} onPress={close}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuHeader} numberOfLines={1}>
              {session.title?.trim() || formatShortWithWeekday(session.date)}
            </Text>
            <MenuItem label="📝 운동 수정" onPress={() => run(() => edit(session))} />
            <MenuItem label="🔁 이대로 시작" onPress={() => run(() => startAsIs(session))} />
            <MenuItem label="⭐ 템플릿으로 저장" onPress={() => run(() => saveAsTemplate(session))} />
            <MenuItem label="✏️ 이름 변경" onPress={() => run(() => rename(session, onChanged))} />
            <MenuItem label="🗑 삭제" danger onPress={() => run(() => remove(session, onChanged))} />
            <Pressable style={styles.menuCancel} onPress={close}>
              <Text style={styles.menuCancelText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <SessionPreviewSheet session={preview ? session : null} onClose={() => setPreview(false)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#30D158',
    padding: 16,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#8E8E93', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 9,
    paddingHorizontal: 2,
  },
  tagText: { color: '#5AB0FF', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3 },
  tagDivider: { width: 1, height: 12, backgroundColor: '#48484A' },
  menuBtn: { paddingHorizontal: 4, marginLeft: 2 },
  menuDots: { color: '#8E8E93', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  stats: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginTop: 8 },
  statNum: { color: '#30D158', fontWeight: '700' },
  exercises: { color: '#8E8E93', fontSize: 13, marginTop: 8 },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 12,
    paddingBottom: 32,
  },
  menuHeader: { color: '#8E8E93', fontSize: 13, fontWeight: '600', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  menuItem: { paddingVertical: 16, paddingHorizontal: 12 },
  menuItemText: { color: '#FFFFFF', fontSize: 17 },
  menuItemDanger: { color: '#FF453A' },
  menuCancel: { marginTop: 8, paddingVertical: 16, alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 12 },
  menuCancelText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
