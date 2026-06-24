import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { ACCENT, AI } from '../constants/colors';

/**
 * 리포트 비동기 생성 로딩 — "오비탈": 중앙 맥동 코어 + 공전하는 입자들.
 * percent(실제 진행률)·step(단계 텍스트)는 서버 폴링값을 받아 그대로 표시한다.
 */
export default function BriefingLoading({ percent, step }: { percent?: number | null; step?: string | null }) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const label = step || '리포트 준비 중…';

  // 코어 맥동
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [pulse]);
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });

  // 진행바 부드러운 보간
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: pct, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  }, [pct, bar]);
  const barWidth = bar.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  // 단계 점(3): percent 구간으로 강조
  const stage = pct < 15 ? 0 : pct < 90 ? 1 : 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.orbitArea}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <Orbit size={120} duration={4200} dot={6} color={ACCENT} />
        <Orbit size={168} duration={6800} reverse dot={5} color="#FF7A6E" />
        <Orbit size={92} duration={3000} dot={4} color="#FFB3AC" />
        <Animated.View style={[styles.core, { transform: [{ scale: coreScale }] }]} />
      </View>

      <Text style={styles.title}>리포트 만드는 중</Text>
      <Text style={styles.step}>{label}</Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      <View style={styles.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[styles.dot, i === stage && styles.dotOn]} />)}
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>다른 화면으로 가도 백그라운드에서 계속 만들어요.</Text>
        <Text style={styles.hintText}>완료되면 홈 🔔 알림함에 알려드릴게요.</Text>
      </View>
    </View>
  );
}

function Orbit({ size, duration, reverse, dot, color }: { size: number; duration: number; reverse?: boolean; dot: number; color: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(rot, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [rot, duration]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  return (
    <Animated.View style={[styles.orbit, { width: size, height: size, transform: [{ rotate: spin }] }]}>
      <View style={{ position: 'absolute', top: -dot / 2, left: size / 2 - dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20 },
  orbitArea: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  glow: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: ACCENT },
  core: { width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,59,48,0.12)', borderRadius: 999 },

  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  step: { color: AI.textSub, fontSize: 13, marginTop: 8 },

  barTrack: { width: 200, height: 5, borderRadius: 3, backgroundColor: '#26262B', overflow: 'hidden', marginTop: 22 },
  barFill: { height: 5, borderRadius: 3, backgroundColor: ACCENT },

  dots: { flexDirection: 'row', gap: 7, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3A3A3C' },
  dotOn: { backgroundColor: ACCENT, width: 18 },

  hint: { marginTop: 26, alignItems: 'center', gap: 3, paddingHorizontal: 24 },
  hintText: { color: AI.faint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
