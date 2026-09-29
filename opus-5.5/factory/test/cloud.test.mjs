import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { userData, sshConfig, associationsSettled, launchPlan, retryableLaunch, renderArgs, STATE_CHECK, DEADLINE, READY, SETUP } from '../cloud.mjs';

test('user data: deadline cron that survives reboots, key once; the install is a per-boot script that resumes after a reboot', () => {
  const s = userData({ pubkey: 'ssh-ed25519 AAAA opus55-render', deadline: 1790662016, node: 'v22.17.1' });
  assert.match(s, /^#!\/bin\/bash\nset -eux\n/);
  const [once, setup] = s.split(`cat > ${SETUP} <<'SETUP'\n`);
  assert.ok(setup, 'the install goes into the per-boot script');
  assert.ok(once.includes(`echo 1790662016 > ${DEADLINE}`));
  assert.ok(once.includes(`'*/5 * * * * root [ $(date +\\%s) -gt $(cat ${DEADLINE}) ] && /sbin/poweroff' > /etc/cron.d/`), 'cron needs % escaped');
  assert.doesNotMatch(s, /shutdown -h/, 'a scheduled shutdown is lost when the patch job reboots the instance');
  assert.ok(once.includes("echo 'ssh-ed25519 AAAA opus55-render' >> /home/ubuntu/.ssh/authorized_keys"));
  assert.match(setup, new RegExp(`^#!/bin/bash\nset -eux\n\\[ -f ${READY} \\] && exit 0\n`), 'a finished install is skipped on later boots');
  assert.ok(setup.includes('https://nodejs.org/dist/v22.17.1/node-v22.17.1-linux-x64.tar.xz'));
  assert.match(setup, /systemctl disable --now unattended-upgrades/);
  assert.match(setup, /for i in \$\(seq \d+\); do apt-get -o DPkg::Lock::Timeout=\d+ install -y -q ffmpeg/);
  assert.ok(setup.includes(`touch ${READY}\nSETUP\n`), 'the ready marker is the last step');
  assert.ok(s.trimEnd().endsWith(`exec ${SETUP}`), 'first boot runs it from user data');
});

test('state check is one word per state and valid bash', () => {
  for (const w of ['ready', 'rebooting', 'booting', 'failed']) assert.ok(STATE_CHECK.includes(`echo ${w}`), w);
  const r = spawnSync('bash', ['-n', '-c', STATE_CHECK], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const u = spawnSync('bash', ['-n', '-c', userData({ pubkey: 'k', deadline: 1, node: 'v22.0.0' })], { encoding: 'utf8' });
  assert.equal(u.status, 0, u.stderr);
});

test('ssh config goes through SSM and carries the profile and region only when given', () => {
  const c = sshConfig({ id: 'i-0123', profile: 'p1', region: 'us-east-1' });
  assert.match(c, /^Host opus55-render\n  HostName i-0123\n/);
  assert.match(c, /ProxyCommand aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p --profile p1 --region us-east-1\n/);
  assert.doesNotMatch(sshConfig({ id: 'i-0123' }), /--profile|--region/);
});

test('associations: settled when none is pending or running; none at all counts after 10 minutes; a stuck one stops blocking after 15', () => {
  assert.equal(associationsSettled([{ Status: 'Success' }, { Status: 'Failed' }, { Status: 'Skipped' }], 0), true);
  assert.equal(associationsSettled([{ Status: 'Success' }, { Status: 'InProgress' }], 5 * 60_000), false);
  assert.equal(associationsSettled([{ Status: 'Pending' }], 14 * 60_000), false);
  assert.equal(associationsSettled([{ Status: 'Pending' }], 16 * 60_000), true);
  assert.equal(associationsSettled([], 5 * 60_000), false);
  assert.equal(associationsSettled([], 11 * 60_000), true);
});

test('launch plan tries every subnet for the first type before the next type; only capacity errors move on', () => {
  assert.deepEqual(launchPlan(['a', 'b'], ['s1', 's2']), [
    { type: 'a', subnet: 's1' }, { type: 'a', subnet: 's2' }, { type: 'b', subnet: 's1' }, { type: 'b', subnet: 's2' }]);
  assert.ok(retryableLaunch('An error occurred (InsufficientInstanceCapacity) when calling the RunInstances operation'));
  assert.ok(retryableLaunch('An error occurred (Unsupported) when calling the RunInstances operation'));
  assert.ok(!retryableLaunch('An error occurred (UnauthorizedOperation) when calling the RunInstances operation'));
});

test('render args pass through, default to 6 workers, refuse --out', () => {
  assert.deepEqual(renderArgs(['--sku', 'rose']), ['--sku', 'rose', '--workers', '6']);
  assert.deepEqual(renderArgs(['--workers', '3', '--force']), ['--workers', '3', '--force']);
  assert.throws(() => renderArgs(['--out', '/tmp/x']), /--out is not supported/);
});

test('cloud.mjs with no command prints usage and exits 2 without calling AWS', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../cloud.mjs', import.meta.url))], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage: node factory\/cloud\.mjs up/);
});
