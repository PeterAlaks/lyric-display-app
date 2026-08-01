import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrapMatch = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/);

assert.ok(bootstrapMatch, 'index.html must contain the first-paint bootstrap');

const runFirstPaintBootstrap = ({ hash = '', pathname = '/', search = '' } = {}) => {
  const dataset = {};
  vm.runInNewContext(bootstrapMatch[1], {
    URL,
    document: { documentElement: { dataset } },
    window: {
      location: {
        hash,
        origin: 'http://localhost:4000',
        pathname,
        search,
      },
    },
  });
  return dataset.lyricDisplaySurface;
};

test('output routes are transparent before React loads in hash and browser routing modes', () => {
  assert.equal(runFirstPaintBootstrap({ hash: '#/output1' }), 'transparent');
  assert.equal(runFirstPaintBootstrap({ hash: '#/output6?preview=true' }), 'transparent');
  assert.equal(runFirstPaintBootstrap({ pathname: '/output2' }), 'transparent');
  assert.equal(runFirstPaintBootstrap({ hash: '#/lyric-video-live-output' }), 'transparent');
  assert.equal(runFirstPaintBootstrap({ hash: '#/lyric-video-export-frame' }), 'transparent');
});

test('projection routes are black from the first paint', () => {
  assert.equal(runFirstPaintBootstrap({ hash: '#/output1?projection=true' }), 'projection');
  assert.equal(runFirstPaintBootstrap({ pathname: '/stage', search: '?projection=1' }), 'projection');
  assert.equal(
    runFirstPaintBootstrap({ hash: '#/lyric-video-live-output?projection=true' }),
    'projection'
  );
});

test('interactive and opaque display routes keep their normal page background', () => {
  assert.equal(runFirstPaintBootstrap(), undefined);
  assert.equal(runFirstPaintBootstrap({ hash: '#/stage' }), undefined);
  assert.equal(runFirstPaintBootstrap({ hash: '#/time' }), undefined);
});

test('first-paint surface styles precede the application module', () => {
  const surfaceStylePosition = indexHtml.indexOf('html[data-lyric-display-surface="transparent"]');
  const applicationModulePosition = indexHtml.indexOf('<script type="module" src="/src/main.jsx"></script>');

  assert.ok(surfaceStylePosition >= 0, 'transparent first-paint styles must exist');
  assert.ok(applicationModulePosition >= 0, 'application module must exist');
  assert.ok(surfaceStylePosition < applicationModulePosition, 'surface styles must load before React');
});
