// cloud.mjs — 在 AWS 的 GPU 实例上出片：开机 → 同步代码 → 云端跑 render.mjs（或任意命令）→ 拉回 out/ → 关机
//   node factory/cloud.mjs up [--type g6.4xlarge,g5.4xlarge] [--hours 3]
//   node factory/cloud.mjs render <film> [render.mjs 的参数…]      同步、出片、拉回 <film>/out/
//   node factory/cloud.mjs run <命令…>                             同步后在云端 showcase/ 下跑，如 run node factory/check.mjs 03-perfume
//   node factory/cloud.mjs pull <film> | extend --hours 2 | status | down
// 账号和区域用 AWS CLI 自己的 AWS_PROFILE、AWS_REGION。实例、安全组、实例配置文件都叫 opus55-render，打 Project=opus55-showcase 标签
// 没有入站端口：ssh 走 SSM（AWS-StartSSHSession），要本机装 session-manager-plugin。实例配置文件（带 AmazonSSMManagedInstanceCore）要先建好
// 实例自带关机期限（/etc/opus55-deadline，cron 每 5 分钟看一次），到点关机即终止，忘了 down 也不会一直计费
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseArgs, isMain } from './lib/args.mjs';
import { ROOT } from './lib/serve.mjs';

export const NAME = 'opus55-render', PROJECT = 'opus55-showcase';
export const AMI = 'resolve:ssm:/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-24.04/latest/ami-id';
export const TYPES = ['g6.4xlarge', 'g5.4xlarge'];
export const READY = '/var/lib/cloud/opus55-ready', DEADLINE = '/etc/opus55-deadline', SETUP = '/var/lib/cloud/scripts/per-boot/opus55-setup.sh';
const KEY = path.join(os.homedir(), '.ssh', NAME), SSH_CONFIG = `${KEY}.config`;
const REMOTE = 'showcase';
const SYNC_EXCLUDE = ['node_modules/', '*/out/', '.playwright-mcp/', '.DS_Store'];

/**
 * 开机脚本。只跑一次的部分：关机期限、ssh 公钥。安装部分（Node 与本机同版本、ffmpeg）写成 cloud-init 的 per-boot 脚本：
 * 补丁任务可能在装到一半时重启实例，下次开机接着装，装完留下 READY 标记，之后开机直接跳过。apt 可能被补丁任务占着锁，所以带重试
 */
export function userData({ pubkey, deadline, node }) {
  return `#!/bin/bash
set -eux
echo ${deadline} > ${DEADLINE}
echo '*/5 * * * * root [ $(date +\\%s) -gt $(cat ${DEADLINE}) ] && /sbin/poweroff' > /etc/cron.d/opus55-deadline
install -d -o ubuntu -g ubuntu -m 700 /home/ubuntu/.ssh
echo '${pubkey}' >> /home/ubuntu/.ssh/authorized_keys
chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys && chmod 600 /home/ubuntu/.ssh/authorized_keys
install -d /var/lib/cloud/scripts/per-boot
cat > ${SETUP} <<'SETUP'
#!/bin/bash
set -eux
[ -f ${READY} ] && exit 0
systemctl disable --now unattended-upgrades.service apt-daily.timer apt-daily-upgrade.timer || true
curl -fsSL https://nodejs.org/dist/${node}/node-${node}-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1
export DEBIAN_FRONTEND=noninteractive
for i in $(seq 60); do apt-get -o DPkg::Lock::Timeout=600 update -q && break; sleep 10; done
for i in $(seq 10); do apt-get -o DPkg::Lock::Timeout=600 install -y -q ffmpeg rsync libvulkan1 && break; sleep 30; done
touch ${READY}
SETUP
chmod +x ${SETUP}
exec ${SETUP}
`;
}

/** 远端自检：打印一个词。ready；booting（开机脚本在跑）；rebooting（有待执行的关机或重启）；failed（cloud-init 跑完了却没有 READY） */
export const STATE_CHECK = `if [ -f ${READY} ]; then
  if [ -e /run/nologin ] || ! busctl get-property org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager ScheduledShutdown | grep -q '^(st) "" '; then echo rebooting; else echo ready; fi
else case "$(cloud-init status 2>/dev/null)" in *running*|*'not started'*) echo booting;; *) echo failed;; esac; fi`;

/** ~/.ssh/opus55-render.config：主机名是实例 ID，经 SSM 转发；账号和区域写进 ProxyCommand，手动 ssh 也能用 */
export function sshConfig({ id, profile, region }) {
  const aws = ['aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p',
    profile && `--profile ${profile}`, region && `--region ${region}`].filter(Boolean).join(' ');
  return `Host ${NAME}
  HostName ${id}
  User ubuntu
  IdentityFile ${KEY}
  IdentitiesOnly yes
  UserKnownHostsFile ${KEY}.known_hosts
  StrictHostKeyChecking accept-new
  ServerAliveInterval 30
  ConnectTimeout 60
  ProxyCommand ${aws}
`;
}

/**
 * 账号里的 SSM 关联（比如 AWS-RunPatchBaseline）会在新实例注册后自动跑，打补丁后还可能重启。
 * 全部跑完（没有 Pending / InProgress）才算安顿好；开机 10 分钟还一条都没有，就当账号里没有关联。
 * 有的关联会一直卡着（如 CloudWatchAgentUpdate），开机 15 分钟后不再等；之后真重启了，remote() 会等好再重跑
 */
export function associationsSettled(statuses, ageMs) {
  if (ageMs > 15 * 60_000) return true;
  if (!statuses.length) return ageMs > 10 * 60_000;
  return statuses.every(s => !['Pending', 'InProgress'].includes(s.Status));
}

/** 按顺序试 类型 × 子网，容量不够或该可用区不支持就换下一个 */
export function launchPlan(types, subnets) {
  return types.flatMap(type => subnets.map(subnet => ({ type, subnet })));
}
export const retryableLaunch = msg => /InsufficientInstanceCapacity|Unsupported|InstanceLimitExceeded/.test(msg);

/** render 的参数原样交给云端 render.mjs；--out 指到云端的目录拉不回来，所以不收 */
export function renderArgs(argv) {
  if (argv.includes('--out')) throw new Error('cloud render writes to <film>/out/ and pulls it back; --out is not supported');
  return argv.includes('--workers') ? argv : [...argv, '--workers', '6'];
}

// ——— 以下是命令行 ———

const env = process.env;
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function aws(args, { json = true } = {}) {
  const out = execFileSync('aws', [...args, ...(json ? ['--output', 'json'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return json ? JSON.parse(out || 'null') : out.trim();
}
const region = () => env.AWS_REGION || env.AWS_DEFAULT_REGION || aws(['configure', 'get', 'region'], { json: false });
const ssh = (cmd, opts = {}) => spawnSync('ssh', ['-F', SSH_CONFIG, NAME, cmd], { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', timeout: opts.timeout });
const rsync = (from, to, extra = []) => {
  const r = spawnSync('rsync', ['-az', ...extra, '-e', `ssh -F ${SSH_CONFIG}`, from, to], { stdio: 'inherit' });
  if (r.status) throw new Error(`rsync ${from} → ${to} failed (${r.status})`);
};

function find() {
  const r = aws(['ec2', 'describe-instances', '--filters', `Name=tag:Name,Values=${NAME}`, `Name=tag:Project,Values=${PROJECT}`,
    'Name=instance-state-name,Values=pending,running,stopping,stopped', '--query', 'Reservations[].Instances[]']);
  if (r.length > 1) throw new Error(`more than one ${NAME} instance: ${r.map(i => i.InstanceId).join(', ')}`);
  return r[0] ?? null;
}
function need() {
  const i = find();
  if (!i) { console.error(`no ${NAME} instance; start one with: node factory/cloud.mjs up`); process.exit(2); }
  fs.writeFileSync(SSH_CONFIG, sshConfig({ id: i.InstanceId, profile: env.AWS_PROFILE, region: region() }));
  return i;
}

function securityGroup(vpc) {
  const g = aws(['ec2', 'describe-security-groups', '--filters', `Name=group-name,Values=${NAME}`, `Name=vpc-id,Values=${vpc}`, '--query', 'SecurityGroups[0].GroupId']);
  if (g) return g;
  log(`creating security group ${NAME} (no inbound rules)`);
  return aws(['ec2', 'create-security-group', '--group-name', NAME, '--vpc-id', vpc, '--description', 'opus55 showcase GPU render: SSM only, no inbound',
    '--tag-specifications', `ResourceType=security-group,Tags=[{Key=Project,Value=${PROJECT}}]`, '--query', 'GroupId']);
}

function launch({ types, hours }) {
  try { aws(['iam', 'get-instance-profile', '--instance-profile-name', NAME]); }
  catch { console.error(`instance profile ${NAME} not found. Create a role ${NAME} with AmazonSSMManagedInstanceCore and an instance profile of the same name (see factory/README.md 云端出片)`); process.exit(2); }
  if (!fs.existsSync(KEY)) execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', NAME, '-f', KEY], { stdio: 'ignore' });
  const vpc = aws(['ec2', 'describe-vpcs', '--filters', 'Name=is-default,Values=true', '--query', 'Vpcs[0].VpcId']);
  if (!vpc) throw new Error('no default VPC in this region');
  const subnets = aws(['ec2', 'describe-subnets', '--filters', `Name=vpc-id,Values=${vpc}`, 'Name=default-for-az,Values=true', '--query', 'Subnets[].SubnetId']);
  const sg = securityGroup(vpc), deadline = Math.floor(Date.now() / 1000 + hours * 3600);
  const ud = path.join(os.tmpdir(), `${NAME}-userdata.sh`);
  fs.writeFileSync(ud, userData({ pubkey: fs.readFileSync(`${KEY}.pub`, 'utf8').trim(), deadline, node: process.version }));
  const tags = `ResourceType=instance,Tags=[{Key=Name,Value=${NAME}},{Key=Project,Value=${PROJECT}}]`;
  for (const { type, subnet } of launchPlan(types, subnets)) {
    try {
      const id = aws(['ec2', 'run-instances', '--image-id', AMI, '--instance-type', type, '--subnet-id', subnet, '--security-group-ids', sg,
        '--iam-instance-profile', `Name=${NAME}`, '--instance-initiated-shutdown-behavior', 'terminate', '--metadata-options', 'HttpTokens=required',
        '--user-data', `file://${ud}`, '--tag-specifications', tags, `ResourceType=volume,Tags=[{Key=Project,Value=${PROJECT}}]`,
        '--query', 'Instances[0].InstanceId']);
      log(`launched ${id} (${type}, ${subnet}); powers itself off after ${new Date(deadline * 1000).toISOString()}`);
      return id;
    } catch (e) {
      const msg = String(e.stderr || e.message);
      if (!retryableLaunch(msg)) throw new Error(msg);
      log(`${type} in ${subnet}: ${msg.match(/\((\w+)\)/)?.[1] ?? 'unavailable'}, trying the next one`);
    }
  }
  throw new Error(`no capacity for ${types.join(', ')} in any subnet of ${vpc}`);
}

/** 等到 SSM 在线、账号里的 SSM 关联跑完（含补丁后的重启）、开机脚本做完、没有待执行的关机 */
async function settle(id) {
  const t0 = Date.now();
  let last = '';
  const say = s => { if (s !== last) log(`  … ${s}`); last = s; };
  for (;;) {
    if (Date.now() - t0 > 40 * 60_000) throw new Error(`${id} did not settle in 40 minutes`);
    const inst = aws(['ec2', 'describe-instances', '--instance-ids', id, '--query', 'Reservations[0].Instances[0]']);
    if (inst.State.Name !== 'running') { say(`instance ${inst.State.Name}`); await sleep(10_000); continue; }
    const ping = aws(['ssm', 'describe-instance-information', '--filters', `Key=InstanceIds,Values=${id}`, '--query', 'InstanceInformationList[0].PingStatus']);
    if (ping !== 'Online') { say('waiting for the SSM agent'); await sleep(10_000); continue; }
    const st = aws(['ssm', 'describe-instance-associations-status', '--instance-id', id, '--query', 'InstanceAssociationStatusInfos[].{Name:Name,Status:Status}']) ?? [];
    if (!associationsSettled(st, Date.now() - Date.parse(inst.LaunchTime))) {
      say(`account SSM associations running (${st.filter(s => /Pending|InProgress/.test(s.Status)).map(s => s.Name).join(', ') || 'none reported yet'})`);
      await sleep(15_000); continue;
    }
    const r = ssh(STATE_CHECK, { quiet: true, timeout: 120_000 }), state = r.status === 0 ? r.stdout.trim() : 'unreachable';
    if (state === 'ready') return;
    if (state === 'failed') throw new Error(`${id}: the boot script failed; see: ssh -F ${SSH_CONFIG} ${NAME} sudo tail -40 /var/log/cloud-init-output.log`);
    say({ unreachable: 'ssh not reachable yet (booting or rebooting)', booting: 'boot script installing node and ffmpeg', rebooting: 'a reboot is pending' }[state] ?? state);
    await sleep(15_000);
  }
}

/** 代码同步上去；package-lock 变了（或第一次）才装依赖和 Chromium */
function sync() {
  rsync(`${ROOT}/`, `${NAME}:${REMOTE}/`, ['--delete', ...SYNC_EXCLUDE.flatMap(x => ['--exclude', x])]);
  const r = ssh(`cd ${REMOTE} && (cmp -s package-lock.json ~/.opus55-lock || (npm ci --no-audit --no-fund && sudo npx playwright install-deps chromium && npx playwright install chromium && cp package-lock.json ~/.opus55-lock))`);
  if (r.status) throw new Error(`installing dependencies on the instance failed (${r.status})`);
}

/** 云端跑一条命令；连接断了（多半是补丁任务重启了实例）就等安顿好再跑一次。render.mjs 能断点续做，重跑不浪费 */
async function remote(id, cmd) {
  for (let attempt = 0; ; attempt++) {
    const r = ssh(`cd ${REMOTE} && ${cmd}`);
    if (r.status !== 255 || attempt === 2) return r.status ?? 1;
    log('connection lost; waiting for the instance and trying again');
    await settle(id); sync();
  }
}
const quote = a => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
const filmDir = film => {
  if (!film || !fs.existsSync(path.join(ROOT, film, 'meta.js'))) { console.error(`not a film directory: ${film ?? '(none)'}`); process.exit(2); }
  return film;
};
const pull = film => { fs.mkdirSync(path.join(ROOT, film, 'out'), { recursive: true }); rsync(`${NAME}:${REMOTE}/${film}/out/`, path.join(ROOT, film, 'out') + '/'); log(`pulled ${film}/out/`); };

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { o } = parseArgs(rest);
  switch (cmd) {
    case 'up': {
      const hours = +(o.hours ?? 3), types = typeof o.type === 'string' ? o.type.split(',') : TYPES;
      let i = find();
      const id = i ? i.InstanceId : launch({ types, hours });
      if (i) log(`reusing ${id} (${i.InstanceType}, ${i.State.Name})`);
      if (i?.State.Name === 'stopped') aws(['ec2', 'start-instances', '--instance-ids', id]);
      need(); await settle(id); sync();
      if (i) ssh(`echo $(( $(date +%s) + ${Math.round(hours * 3600)} )) | sudo tee ${DEADLINE} >/dev/null`);
      log(`ready: ${id}. ssh -F ${SSH_CONFIG} ${NAME}`);
      break;
    }
    case 'render': {
      const [film, ...args] = rest, id = need().InstanceId;
      filmDir(film); await settle(id); sync();
      const status = await remote(id, ['node', 'factory/render.mjs', film, ...renderArgs(args)].map(quote).join(' '));
      pull(film);
      process.exit(status);
    }
    case 'run': {
      if (!rest.length) { console.error('usage: node factory/cloud.mjs run <command…>'); process.exit(2); }
      const id = need().InstanceId;
      await settle(id); sync();
      process.exit(await remote(id, rest.map(quote).join(' ')));
    }
    case 'pull': need(); pull(filmDir(rest[0])); break;
    case 'extend': {
      need();
      const r = ssh(`echo $(( $(date +%s) + ${Math.round(+(o.hours ?? 1) * 3600)} )) | sudo tee ${DEADLINE} >/dev/null && date -u -d @$(cat ${DEADLINE})`);
      process.exit(r.status ?? 1);
    }
    case 'status': {
      const i = find();
      if (!i) { log(`no ${NAME} instance`); break; }
      need();
      log(`${i.InstanceId}  ${i.InstanceType}  ${i.State.Name}  ${i.Placement.AvailabilityZone}  launched ${i.LaunchTime}`);
      if (i.State.Name === 'running') ssh(`echo "powers off after $(date -u -d @$(cat ${DEADLINE}))"; nvidia-smi --query-gpu=name,utilization.gpu,memory.used --format=csv,noheader; uptime`, { timeout: 120_000 });
      break;
    }
    case 'down': {
      const i = find();
      if (!i) { log(`no ${NAME} instance`); break; }
      aws(['ec2', 'terminate-instances', '--instance-ids', i.InstanceId]);
      log(`terminating ${i.InstanceId}`);
      break;
    }
    default:
      console.error('usage: node factory/cloud.mjs up [--type t1,t2] [--hours 3] | render <film> [render args] | run <command…> | pull <film> | extend --hours N | status | down');
      process.exit(2);
  }
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
