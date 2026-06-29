import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SEM } from '../constants/colors';

export type IconName =
  | 'person' | 'target' | 'timer' | 'tag' | 'dumbbell'
  | 'bell' | 'calendar' | 'scale' | 'sliders' | 'chat'
  | 'info' | 'download' | 'mail' | 'shield' | 'tool' | 'logout' | 'gear';

/** 설정 행용 모노라인 아이콘(뉴트럴 — 색은 의미를 담지 않음, N-U1 보존). */
export function SettingIcon({ name, size = 16, color = SEM.ink3 }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 1.4, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const dot = { fill: color };
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {name === 'person' && (<>
        <Circle cx={8} cy={5.4} r={2.6} {...p} />
        <Path d="M3.6 13.4c0-2.6 2-4.1 4.4-4.1s4.4 1.5 4.4 4.1" {...p} />
      </>)}
      {name === 'target' && (<>
        <Circle cx={8} cy={8} r={6} {...p} /><Circle cx={8} cy={8} r={3} {...p} /><Circle cx={8} cy={8} r={0.9} {...dot} />
      </>)}
      {name === 'timer' && (<>
        <Circle cx={8} cy={9} r={5} {...p} /><Path d="M8 9V6M6.4 2.5h3.2" {...p} />
      </>)}
      {name === 'tag' && (<>
        <Path d="M3 3.2h4.6l6 6-4.4 4.4-6-6z" {...p} /><Circle cx={6} cy={6.2} r={1} {...dot} />
      </>)}
      {name === 'dumbbell' && (<>
        <Path d="M2 6.4v3.2M4 5.4v5.2M12 5.4v5.2M14 6.4v3.2M4 8h8" {...p} />
      </>)}
      {name === 'bell' && (<>
        <Path d="M8 2a3.8 3.8 0 00-3.8 3.8c0 3.6-1.4 4.7-1.4 4.7h10.4s-1.4-1.1-1.4-4.7A3.8 3.8 0 008 2zM6.6 13.2a1.5 1.5 0 002.8 0" {...p} />
      </>)}
      {name === 'calendar' && (<>
        <Rect x={2.5} y={3.2} width={11} height={10.6} rx={1.6} {...p} /><Path d="M2.5 6.6h11M5.6 2.2v2M10.4 2.2v2" {...p} />
      </>)}
      {name === 'scale' && (<>
        <Path d="M8 3v10M4.5 13.5h7M3 6.5h10M8 3.2 3 6.5M8 3.2 13 6.5M3 6.5 1.5 9.5a2 2 0 004 0zM13 6.5 11.5 9.5a2 2 0 004 0z" {...p} />
      </>)}
      {name === 'sliders' && (<>
        <Path d="M2 5.5h12M2 10.5h12" {...p} /><Circle cx={5.5} cy={5.5} r={1.7} {...dot} /><Circle cx={10.5} cy={10.5} r={1.7} {...dot} />
      </>)}
      {name === 'chat' && (<>
        <Path d="M2.6 5.2a2 2 0 012-2h6.8a2 2 0 012 2v3.6a2 2 0 01-2 2H7l-3 2.4v-2.4h-.4a2 2 0 01-2-2z" {...p} />
      </>)}
      {name === 'info' && (<>
        <Circle cx={8} cy={8} r={6} {...p} /><Path d="M8 7.4v3.6M8 5.2v.1" {...p} />
      </>)}
      {name === 'download' && (<>
        <Path d="M8 2.5v7M5 6.5l3 3 3-3M3 12.5h10" {...p} />
      </>)}
      {name === 'mail' && (<>
        <Rect x={2.5} y={3.5} width={11} height={9} rx={1.5} {...p} /><Path d="M2.8 4.6 8 8.6 13.2 4.6" {...p} />
      </>)}
      {name === 'shield' && (<>
        <Path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" {...p} />
      </>)}
      {name === 'tool' && (<>
        <Path d="M10.6 2.4a3 3 0 00-3.9 3.9l-4.1 4.1 1.5 1.5 4.1-4.1a3 3 0 003.9-3.9L10 3.8 9 4.8 8 3.8z" {...p} />
      </>)}
      {name === 'logout' && (<>
        <Path d="M6 3.5H3.5v9H6M9 8h5M11.5 5.5 14 8l-2.5 2.5" {...p} />
      </>)}
      {name === 'gear' && (<>
        <Circle cx={8} cy={8} r={2.2} {...p} />
        <Path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7 3.5 3.5" {...p} />
      </>)}
    </Svg>
  );
}
