import * as fs from 'fs';
import * as path from 'path';

/**
 * 알림 딥링크가 실제 expo-router 라우트를 가리키는지 검증한다.
 * 라우트 개편으로 (tabs)/workout 이 삭제됐는데 리마인더가 계속 그 경로로
 * 딥링크해 알림 탭 시 Unmatched(404)로 빠지던 회귀를 막는다.
 * (네이티브 모듈을 import하지 않도록 소스 텍스트 + 파일시스템만 본다.)
 */
const ROOT = path.resolve(__dirname, '../../');
const APP = path.join(ROOT, 'app');

// 딥링크 문자열을 넘기는 소스들. 여기 들어간 '/...' 라우트 리터럴을 검사한다.
const SOURCES = ['lib/reminders.ts', 'components/NotificationBridge.tsx'];

/** 소스에서 라우트형 문자열 리터럴('/...')만 추출(한글 본문/타이틀은 제외). */
function extractRouteLiterals(src: string): string[] {
  const found = new Set<string>();
  const re = /['"](\/[A-Za-z0-9()/_-]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) found.add(m[1]);
  return [...found];
}

/** 라우트 경로가 app/ 아래 실제 파일로 해석되는지. */
function routeExists(route: string): boolean {
  const rel = route.replace(/^\//, '');
  const candidates = [
    path.join(APP, `${rel}.tsx`),
    path.join(APP, `${rel}.ts`),
    path.join(APP, rel, 'index.tsx'),
    path.join(APP, rel, 'index.ts'),
  ];
  return candidates.some(p => fs.existsSync(p));
}

describe('알림 딥링크 라우트', () => {
  const links = SOURCES.flatMap(f =>
    extractRouteLiterals(fs.readFileSync(path.join(ROOT, f), 'utf8')).map(route => ({ f, route })),
  );

  it('검사할 딥링크가 하나 이상 추출된다(테스트 자체 유효성)', () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)('$f 의 $route 는 실제 라우트로 존재한다', ({ route }) => {
    expect(routeExists(route)).toBe(true);
  });

  it('워크아웃 리마인더는 /workout(독립 라우트)을 가리키고, 삭제된 /(tabs)/workout 은 안 쓴다', () => {
    const reminderLinks = extractRouteLiterals(
      fs.readFileSync(path.join(ROOT, 'lib/reminders.ts'), 'utf8'),
    );
    expect(reminderLinks).toContain('/workout');
    expect(reminderLinks).not.toContain('/(tabs)/workout');
  });
});
