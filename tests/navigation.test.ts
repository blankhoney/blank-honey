import test from 'node:test';
import assert from 'node:assert/strict';
import { isNavigationCurrent } from '../src/client/navigation';
import { config } from '../src/config';

test('the showcase navigation entry only matches the exact root path', () => {
  assert.equal(isNavigationCurrent('/', '/'), true);
  for (const pathname of [
    '/articles/',
    '/blog/a-note/',
    '/category/engineering/',
    '/tools/',
    '/unknown/',
    '//',
    '',
  ])
    assert.equal(isNavigationCurrent(pathname, '/'), false, pathname);
});

test('articles includes article lists, blog posts and category pages', () => {
  for (const pathname of [
    '/articles/',
    '/articles/2/',
    '/blog/a-note/',
    '/blog/nested/a-note/',
    '/category/engineering/',
  ])
    assert.equal(isNavigationCurrent(pathname, '/articles/'), true, pathname);
  for (const pathname of ['/', '/article/', '/blogroll/', '/categories/', '/tools/'])
    assert.equal(isNavigationCurrent(pathname, '/articles/'), false, pathname);
});

test('each section matches its own nested routes without highlighting another entry', () => {
  for (const target of ['/articles/', '/probe/', '/map/', '/graph/', '/tools/', '/lab/']) {
    for (const pathname of [target, `${target}nested/`, `${target}nested/detail/`]) {
      assert.equal(isNavigationCurrent(pathname, target), true, `${pathname} → ${target}`);
      assert.deepEqual(
        config.navigation
          .filter((entry) => isNavigationCurrent(pathname, entry.href))
          .map((entry) => entry.href),
        [target],
        pathname,
      );
    }
  }
  for (const pathname of ['/blog/a-note/', '/category/engineering/'])
    assert.deepEqual(
      config.navigation
        .filter((entry) => isNavigationCurrent(pathname, entry.href))
        .map((entry) => entry.href),
      ['/articles/'],
      pathname,
    );
});

test('unknown paths and similarly named prefixes do not activate navigation', () => {
  for (const pathname of [
    '/unknown/',
    '/toolshed/',
    '/laboratory/',
    '/probe-extra/',
    '/graphical/',
  ])
    assert.deepEqual(
      config.navigation.filter((entry) => isNavigationCurrent(pathname, entry.href)),
      [],
      pathname,
    );
});

test('the showcase entry comes first and the six existing sections keep their order', () => {
  assert.deepEqual(config.navigation[0], { href: '/', label: '返回展示页', en: 'SHOWCASE' });
  assert.deepEqual(config.navigation.slice(1), [
    { href: '/articles/', label: '文章', en: 'ARTICLES' },
    { href: '/probe/', label: '探针', en: 'PROBE' },
    { href: '/map/', label: '地图', en: 'MAP' },
    { href: '/graph/', label: '图谱', en: 'GRAPH' },
    { href: '/tools/', label: '工具', en: 'TOOLS' },
    { href: '/lab/', label: '实验室', en: 'LAB' },
  ]);
});

test('the five showcase effects retain their identities, names and source links', () => {
  assert.deepEqual(config.hero, [
    { id: 'io724', name: '流体墨迹', source: 'https://io724.com' },
    { id: 'miniload', name: '像素云', source: 'https://miniload.top' },
    { id: 'isaca', name: '错层索引', source: 'https://isaca.pro' },
    { id: 'yantao', name: '代码札记', source: 'https://yantao.wiki' },
    { id: 'birds', name: '群鸟掠空', source: 'https://www.vantajs.com/?effect=birds' },
  ]);
});
