import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeArgs } from '../lib/browser.mjs';

test('chrome args pick the ANGLE backend by platform', () => {
  assert.deepEqual(chromeArgs('darwin', {}), ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']);
  const linux = chromeArgs('linux', {});
  assert.ok(linux.includes('--use-angle=vulkan') && linux.includes('--enable-features=Vulkan'), linux.join(' '));
  assert.deepEqual(chromeArgs('win32', {}), ['--enable-gpu', '--ignore-gpu-blocklist']);
});

test('FACTORY_GPU_ARGS replaces the platform set; blank is ignored', () => {
  const env = { FACTORY_GPU_ARGS: '  --use-gl=angle   --use-angle=gl-egl ' };
  assert.deepEqual(chromeArgs('linux', env), ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist']);
  assert.deepEqual(chromeArgs('darwin', { FACTORY_GPU_ARGS: ' ' }), chromeArgs('darwin', {}));
});
