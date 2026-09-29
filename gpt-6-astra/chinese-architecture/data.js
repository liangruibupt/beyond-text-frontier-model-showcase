/* data.js — building recipes, stage names, category legend, evolution metrics, tour script.
 * Pure data. Units: cm unless a field is documented as module units (分° for 宋式, 斗口 for 明式).
 * Explanatory glossary text lives in glossary.js (ARCH_GLOSSARY), keyed by termKey.
 */
(function (root) {
  'use strict';

  const STAGES = [
    { zh: '台基', en: 'platform', line: '先筑台基，抬高地面、防潮防雨。' },
    { zh: '立柱', en: 'columns', line: '柱子立于柱础之上，全靠榫卯与自重站稳。' },
    { zh: '额枋', en: 'architraves', line: '阑额、普拍枋把一排柱子连成整体。' },
    { zh: '斗拱', en: 'bracket sets', line: '斗拱层把屋檩的重量传到柱头，并把屋檐挑出去。' },
    { zh: '梁栿', en: 'beams', line: '梁栿横跨柱间，是屋架的骨干。' },
    { zh: '支撑', en: 'struts & braces', line: '蜀柱、驼峰、叉手、托脚——把檩条稳稳托住。' },
    { zh: '檩槫', en: 'purlins', line: '檩（槫）沿面阔方向搭在梁架上，决定屋面曲线。' },
    { zh: '椽飞', en: 'rafters', line: '椽子钉在檩上，檐椽伸出成为出檐，飞椽再挑一层。' },
    { zh: '屋面', en: 'roof', line: '望板、苫背、铺瓦、砌脊——大屋顶完成。' },
    { zh: '装修', en: 'fittings', line: '门窗、墙体、天花：最后才是围合与装饰。' }
  ];

  const CATS = [
    { key: 'platform', zh: '台基', en: 'platform' },
    { key: 'column', zh: '柱', en: 'columns' },
    { key: 'tie', zh: '额枋', en: 'architraves' },
    { key: 'bracket', zh: '斗拱', en: 'bracket sets' },
    { key: 'beam', zh: '梁栿', en: 'beams' },
    { key: 'strut', zh: '直立支撑', en: 'posts & blocks' },
    { key: 'inclined', zh: '斜向支撑', en: 'inclined braces' },
    { key: 'purlin', zh: '檩槫', en: 'purlins' },
    { key: 'rafter', zh: '椽·飞椽', en: 'rafters' },
    { key: 'roof', zh: '屋面', en: 'roof' },
    { key: 'ceiling', zh: '天花', en: 'ceiling' },
    { key: 'window', zh: '门窗', en: 'doors & windows' },
    { key: 'wall', zh: '墙', en: 'walls' },
    { key: 'ghost', zh: '减柱处', en: 'omitted columns' },
    { key: 'context', zh: '其他', en: 'context' }
  ];

  // ---------- shared bracket recipes ----------
  const SONG_DOU = { ludou: { w: 32, h: 20 }, danCai: 15, zuCai: 21, qi: 6, thick: 10 };

  // ================= 唐 · 佛光寺东大殿 =================
  const TANG = {
    id: 'tang-foguang',
    dynasty: { zh: '唐', en: 'Tang', years: '618–907' },
    name: { zh: '佛光寺东大殿', en: 'Foguang Temple, East Hall' },
    year: 857, place: { zh: '山西五台', en: 'Wutai, Shanxi' },
    summary: {
      zh: '现存规模最大、等级最高的唐代木构。单檐庑殿顶，面阔七间、进深四间八架椽，殿堂造“金箱斗底槽”：内外柱同高，斗拱高近柱高一半，出檐近四米，屋面平缓，平梁上以大叉手直抵脊槫而不用蜀柱。',
      en: 'The largest and highest-ranking surviving Tang timber hall. Single-eave hip roof, seven bays wide and four bays (eight rafters) deep. Palace-type frame with inner and outer columns of equal height; bracket sets almost half the column height; eaves projecting nearly four metres; a gentle roof; and a great pair of inclined braces (cha shou) meeting the ridge purlin with no post beneath.'
    },
    module: { name: '分°', cm: 2.0, note: '一等材：材广 30 cm × 材厚 20.5 cm，1 分° ≈ 2 cm' },
    platform: { h: 95, margin: 285 },
    layers: [{
      depthBays: [441, 442, 442, 441],
      columns: [
        { at: 0, kind: 'eave', h: 499, d: 56 },
        { at: 1, kind: 'inner', h: 499, d: 62 },
        { at: 3, kind: 'inner', h: 499, d: 62 },
        { at: 4, kind: 'eave', h: 499, d: 56 }
      ],
      cejiao: 0.012,
      ties: ['lan-e', 'nei-e'],
      bracket: Object.assign({
        system: 'puzuo', name: '七铺作双杪双下昂', en: '7-puzuo: two hua gong and two true xia ang',
        tiers: ['hua', 'hua', 'ang', 'ang'], jump: 30, angJump: 26, angReal: true, angSlope: 0.25, angTail: 36,
        jixin: [false, true, false, true], chonggong: false, shuatou: 'batou', linggong: true, timu: true,
        inner: { tiers: ['hua', 'hua', 'hua', 'hua'], jump: 28 }, bujianPerBay: 1
      }, SONG_DOU),
      innerBracket: Object.assign({ name: '内柱铺作（四杪七铺作）', tiers: ['hua', 'hua', 'hua', 'hua'], jump: 28 }, SONG_DOU),
      cap: 'roof',
      eave: { overhang: 172, feiyan: 0, feiyanRise: 0, rafterD: 14 },
      roof: {
        method: 'juzhe', rafters: 8, rise: 0.21, purlinX: [120, 441, 662, 883, 1104, 1325, 1646], purlinD: 30, douH: 20,
        tiers: [
          { name: '明乳栿（月梁）', en: 'ru fu: exposed two-rafter beam, moon-shaped', termKey: 'ru-fu', x0: 'c0', x1: 'c1', h: 44, shape: 'moon', role: 'ming', level: 'bracket', mirror: true },
          { name: '四椽明栿（月梁）', en: 'si chuan fu: exposed four-rafter beam', termKey: 'si-chuan-fu', x0: 'c1', x1: 'c3', h: 60, shape: 'moon', role: 'ming', level: 'bracket' },
          { name: '草乳栿', en: 'cao ru fu: rough beam hidden above the ceiling', termKey: 'cao-fu', x0: 'c0', x1: 'c1', h: 40, role: 'cao', mirror: true },
          { name: '四椽草栿', en: 'cao fu: rough four-rafter beam above the ceiling', termKey: 'cao-fu', x0: 'p2', x1: 'p6', h: 56, role: 'cao' },
          { name: '平梁', en: 'ping liang: topmost beam under the ridge', termKey: 'ping-liang', x0: 'p3', x1: 'p5', h: 46 }
        ],
        strut: 'tuofeng', ridge: 'chashou', chashouW: 10, tuojiao: true, tuojiaoW: 8, roofT: 22, ridgeH: 52, ridgeW: 46
      },
      ceiling: [{ kind: 'ping-an', y: 741, x0: 'c0', x1: 'c4' }],
      section: { front: 'door', back: 'wall' }
    }],
    lowerEave: null,
    elevation: { bays: [440, 504, 504, 504, 504, 504, 440], shengqi: [0, 4, 8, 12], roofType: 'wudian', openings: ['zhiling', 'door', 'door', 'door', 'door', 'door', 'zhiling'], lattice: 'zhiling', sill: 110, eaveCurve: 0.02 },
    extraParts: [
      { id: 'fotan', cat: 'context', label: { zh: '佛坛（凹字形，唐塑三十余尊）', en: 'altar platform with the Tang statues' }, termKey: 'fo-tan', stage: 9, shapes: [{ t: 'rect', x: 481, y: 0, w: 804, h: 70 }], style: { ghost: true } }
    ],
    facts: [
      { zh: '建于唐大中十一年（857 年），面阔七间 34 m，进深四间 17.66 m，是现存唯一的唐代殿堂式建筑。', en: 'Built 857; 34 m wide, 17.66 m deep; the only surviving Tang palace-type hall.', confidence: 'high' },
      { zh: '斗拱高度约为柱高的一半，七铺作双杪双下昂，出檐 3.96 m，为现存木构中最远。', en: 'Bracket sets about half the column height; eaves project 3.96 m, the deepest surviving.', confidence: 'high' },
      { zh: '平梁之上只用一对大叉手承脊槫，不设蜀柱，是国内唯一实例。', en: 'Only a pair of great cha shou carry the ridge; no post beneath. The sole surviving example.', confidence: 'high' },
      { zh: '柱头之间只用阑额，尚无普拍枋；殿内以平闇分隔明栿与草栿。', en: 'Architraves only, no pu pai fang plate yet; a fine-grid ceiling separates the exposed beams from the rough ones above.', confidence: 'high' },
      { zh: '现状檐部未设飞椽；是否原构尚有争论。', en: 'The eaves today have no flying rafters; whether that is original is debated.', confidence: 'medium' }
    ],
    sources: ['梁思成《记五台山佛光寺的建筑》', '梁思成《图像中国建筑史》', '潘谷西《中国建筑史》']
  };

  // ================= 宋 · 晋祠圣母殿 =================
  const SONG = {
    id: 'song-shengmu',
    dynasty: { zh: '宋', en: 'Northern Song', years: '960–1127' },
    name: { zh: '晋祠圣母殿', en: 'Jinci Temple, Hall of the Sacred Mother' },
    year: 1032, place: { zh: '山西太原', en: 'Taiyuan, Shanxi' },
    summary: {
      zh: '北宋天圣年间（1023–1032）重建的祠庙主殿，重檐歇山顶，四周围廊——“副阶周匝”现存最早实例。前廊深两间：殿身前檐一列柱子被减去，由副阶梁上的“抬柱”承托上檐，形成“乳栿对六椽栿用三柱”的厅堂式屋架。柱子侧脚、生起显著，八根盘龙柱为现存最早木雕蟠龙柱。',
      en: 'Rebuilt 1023–1032. Double-eave hip-and-gable roof with a veranda ring on all sides, the earliest surviving example of fu jie zhou za. The front veranda is two bays deep: the hall\'s front eave columns were omitted and short "lifted" posts on the veranda beam carry the upper eave instead. Columns lean inward (ce jiao) and rise toward the corners (sheng qi); its eight carved dragon columns are the oldest surviving.'
    },
    module: { name: '分°', cm: 1.5, note: '殿身单材广约 22 cm，1 分° ≈ 1.5 cm（《营造法式》成书前数十年）' },
    platform: { h: 110, margin: 560 },
    layers: [{
      depthBays: [345, 370, 370, 345],
      columns: [
        { at: 0, kind: 'eave', top: 700, d: 50, lifted: true, label: '抬柱（殿身前檐柱，立于副阶乳栿上）', en: 'lifted front eave column standing on the veranda beam', termKey: 'tai-zhu' },
        { at: 1, kind: 'inner', h: 'auto', d: 60, label: '内柱（前廊后界）', en: 'inner column closing the veranda' },
        { at: 2, kind: 'inner', removed: true, d: 56, h: 700, label: '减柱处（殿内无明柱）', termKey: 'jian-zhu' },
        { at: 3, kind: 'inner', removed: true, d: 56, h: 700, label: '减柱处（神龛后）', termKey: 'jian-zhu' },
        { at: 4, kind: 'eave', h: 700, d: 50 }
      ],
      cejiao: 0.012,
      ties: ['lan-e', 'pupai-fang'],
      bracket: Object.assign({
        system: 'puzuo', name: '六铺作单杪双下昂（上檐）', en: '6-puzuo: one hua gong and two true xia ang (upper eave)',
        tiers: ['hua', 'ang', 'ang'], jump: 30, angJump: 26, angReal: true, angSlope: 0.27, angTail: 40,
        jixin: [true, true, true], chonggong: true, shuatou: 'ang', inner: { tiers: ['hua', 'hua'], jump: 30 }, bujianPerBay: 1
      }, SONG_DOU),
      innerBracket: null,
      cap: 'roof',
      eave: { overhang: 135, feiyan: 70, feiyanRise: 0.15, rafterD: 12 },
      roof: {
        method: 'juzhe', rafters: 8, rise: 0.25, purlinX: [95, 345, 530, 715, 900, 1085, 1335], purlinD: 28, douH: 18,
        tiers: [
          { name: '乳栿（前，对六椽栿）', en: 'ru fu: two-rafter beam meeting the six-rafter beam at the inner column', termKey: 'ru-fu', x0: 'c0', x1: 'c1', h: 42, level: 'bracket' },
          { name: '六椽栿', en: 'liu chuan fu: six-rafter beam', termKey: 'liu-chuan-fu', x0: 'c1', x1: 'c4', h: 62, level: 'bracket' },
          { name: '四椽栿', en: 'si chuan fu: four-rafter beam', termKey: 'si-chuan-fu', x0: 'p2', x1: 'p6', h: 50 },
          { name: '平梁', en: 'ping liang: top beam', termKey: 'ping-liang', x0: 'p3', x1: 'p5', h: 42 }
        ],
        strut: 'shuzhu', ridge: 'shuzhu+chashou', chashouW: 9, tuojiao: true, tuojiaoW: 8, roofT: 22, ridgeH: 56, ridgeW: 46
      },
      ceiling: [],
      section: { frontAt: 'c1', front: 'door', back: 'wall', backAt: 'c4' }
    }],
    lowerEave: {
      depth: 330, columnH: 385, columnD: 44, ties: ['lan-e', 'pupai-fang'], termKey: 'fu-jie',
      columnLabel: '副阶柱（廊柱）', columnTermKey: 'lang-zhu',
      bracket: Object.assign({
        system: 'puzuo', name: '五铺作双下昂（副阶，柱头用假昂）', en: '5-puzuo with two ang; false ang on the column-head sets',
        tiers: ['ang', 'ang'], jump: 30, angJump: 28, angReal: false, jixin: [true, true], chonggong: true, shuatou: 'ang', inner: { tiers: ['hua'], jump: 30 }, bujianPerBay: 1
      }, SONG_DOU),
      frontBeamTo: 'c1', beamH: 44, beamName: ['乳栿（副阶；前廊者跨两间、承抬柱）', 'veranda beam; the front one spans two bays and carries the lifted post', 'ru-fu'],
      rise: 0.28, eave: { overhang: 120, feiyan: 60, feiyanRise: 0.15, rafterD: 11 }
    },
    elevation: { bays: [340, 380, 400, 470, 400, 380, 340], shengqi: [0, 6, 12, 18, 25], roofType: 'chongyan-xieshan', openings: ['wall', 'door', 'door', 'door', 'door', 'door', 'wall'], lattice: 'pozi', sill: 100, eaveCurve: 0.035 },
    extraParts: [
      { id: 'shenkan', cat: 'context', label: { zh: '神龛与扇面墙（后内柱藏于其中）', en: 'shrine and screen wall hiding the rear inner columns' }, termKey: 'shen-kan', stage: 9, shapes: [{ t: 'rect', x: 1050, y: 0, w: 300, h: 420 }], style: { ghost: true } }
    ],
    overrides: [
      { id: 'LE-col-f', patch: { label: { zh: '蟠龙柱（副阶前檐廊柱，1087 年木雕）', en: 'coiled-dragon veranda column, carved 1087' }, termKey: 'pan-long-zhu' } }
    ],
    facts: [
      { zh: '重檐歇山，面阔七间、进深六间（含副阶），高约 19 m；“副阶周匝”为现存最早实例。', en: 'Double-eave hip-and-gable roof, seven by six bays including the veranda, about 19 m high; earliest surviving veranda ring.', confidence: 'high' },
      { zh: '前廊深两间：殿身前檐柱减去，改以副阶乳栿抬柱承上檐；梁架“乳栿对六椽栿用三柱”。', en: 'Two-bay-deep front veranda: the front eave columns are omitted and lifted posts on the veranda beam carry the upper eave.', confidence: 'high' },
      { zh: '上檐六铺作单杪双下昂用真昂；下檐五铺作双下昂，柱头铺作用假昂，一般认为是早期假昂实例。', en: 'Upper eave uses true ang; the lower-eave column-head sets use false ang, generally taken as an early example.', confidence: 'medium' },
      { zh: '四周 26 根柱皆有侧脚、生起，前廊八根木雕蟠龙柱（1087 年）为现存最早。', en: 'All 26 perimeter columns lean and rise toward the corners; the eight carved dragon columns (1087) are the earliest surviving.', confidence: 'high' }
    ],
    sources: ['柴泽俊等《太原晋祠圣母殿修缮工程报告》', '周淼《晋祠圣母殿重檐建筑形制与结构构成分析》', '潘谷西《中国建筑史》'],
    frameTerm: 'ting-tang-zao'
  };

  // ================= 辽 · 独乐寺观音阁 =================
  const LIAO_DOU = { ludou: { w: 32, h: 20 }, danCai: 15, zuCai: 21, qi: 6, thick: 10 };
  const LIAO = {
    id: 'liao-guanyin',
    dynasty: { zh: '辽', en: 'Liao', years: '907–1125' },
    name: { zh: '独乐寺观音阁', en: 'Dule Temple, Guanyin Pavilion' },
    year: 984, place: { zh: '天津蓟州', en: 'Jizhou, Tianjin' },
    summary: {
      zh: '现存最早的木构楼阁。外观两层，内部三层——中间是藏在腰檐与平坐之间的暗层。三层柱框层层叠起，上层柱脚叉在下层斗拱上（叉柱造）；暗层内以斜撑箍紧，千年来历经多次大地震而不倒。楼阁中央留出空井，容纳 16 m 高的十一面观音像。辽承唐制：斗拱硕大、出檐深远。',
      en: 'The oldest surviving multi-storey timber building. Two storeys outside, three inside: a hidden storey sits between the waist eave and the terrace. Each storey is a complete frame stacked on the one below, upper column feet forked over the bracket sets beneath (cha zhu zao); diagonal braces stiffen the hidden storey, and the pavilion has survived many earthquakes. An open well holds the 16 m statue of Guanyin. Liao work keeps the Tang manner: huge brackets, deep eaves.'
    },
    module: { name: '分°', cm: 1.6, note: '材广约 24 cm，1 分° ≈ 1.6 cm；全阁用材仅六种' },
    platform: { h: 100, margin: 280 },
    layers: [
      {
        depthBays: [351, 351, 351, 351],
        columns: [
          { at: 0, kind: 'eave', h: 420, d: 52 }, { at: 1, kind: 'inner', h: 454, d: 56, label: '内柱（较檐柱高一跳）', en: 'inner column, one jump taller' },
          { at: 3, kind: 'inner', h: 454, d: 56, label: '内柱（较檐柱高一跳）', en: 'inner column, one jump taller' }, { at: 4, kind: 'eave', h: 420, d: 52 }
        ],
        cejiao: 0.01, ties: ['lan-e', 'pupai-fang', 'nei-e'],
        bracket: Object.assign({ system: 'puzuo', name: '四杪七铺作（下檐柱头，隔跳偷心）', en: '7-puzuo with four hua gong, alternate jumps open', tiers: ['hua', 'hua', 'hua', 'hua'], jump: 30, jixin: [false, true, false, true], chonggong: true, shuatou: 'batou', inner: { tiers: ['hua', 'hua', 'hua'], jump: 30 }, bujianPerBay: 1 }, LIAO_DOU),
        innerBracket: Object.assign({ name: '内柱铺作（双杪）', tiers: ['hua', 'hua'], jump: 30 }, LIAO_DOU),
        cap: 'eave',
        eave: { overhang: 150, feiyan: 70, feiyanRise: 0.15, rafterD: 12, rise: 0.32, innerX: 140 },
        section: { front: 'door', back: 'wall' }
      },
      {
        columns: [
          { at: 0, kind: 'eave', h: 190, d: 46, inset: 26, joint: 'chazhu', label: '平坐柱（暗层）', en: 'terrace column in the hidden storey', termKey: 'ping-zuo-zhu' },
          { at: 1, kind: 'inner', h: 190, d: 50, joint: 'chazhu', label: '暗层内柱', en: 'hidden-storey inner column', termKey: 'ping-zuo-zhu' },
          { at: 3, kind: 'inner', h: 190, d: 50, joint: 'chazhu', label: '暗层内柱', en: 'hidden-storey inner column', termKey: 'ping-zuo-zhu' },
          { at: 4, kind: 'eave', h: 190, d: 46, inset: 26, joint: 'chazhu', label: '平坐柱（暗层）', en: 'terrace column in the hidden storey', termKey: 'ping-zuo-zhu' }
        ],
        cejiao: 0.008, ties: ['lan-e', 'pupai-fang'],
        bracket: Object.assign({ system: 'puzuo', name: '平坐铺作（出三杪）', en: 'terrace bracket set, three hua gong', tiers: ['hua', 'hua', 'hua'], jump: 28, jixin: [false, true, true], chonggong: true, shuatou: false, cap: 'fang', inner: { tiers: ['hua'], jump: 28 }, bujianPerBay: 1 }, LIAO_DOU),
        cap: 'pingzuo', pingzuo: { floorH: 26, braces: true, voidBays: [1, 2], railH: 95 }
      },
      {
        columns: [
          { at: 0, kind: 'eave', h: 330, d: 48, inset: 44, joint: 'chazhu' }, { at: 1, kind: 'inner', h: 364, d: 52, joint: 'chazhu', label: '上层内柱', en: 'upper inner column' },
          { at: 3, kind: 'inner', h: 364, d: 52, joint: 'chazhu', label: '上层内柱', en: 'upper inner column' }, { at: 4, kind: 'eave', h: 330, d: 48, inset: 44, joint: 'chazhu' }
        ],
        cejiao: 0.01, ties: ['lan-e', 'pupai-fang', 'nei-e'],
        bracket: Object.assign({ system: 'puzuo', name: '七铺作双杪双下昂（上檐）', en: '7-puzuo: two hua gong and two true xia ang (upper eave)', tiers: ['hua', 'hua', 'ang', 'ang'], jump: 30, angJump: 26, angReal: true, angSlope: 0.25, angTail: 34, jixin: [false, true, false, true], chonggong: true, shuatou: 'batou', inner: { tiers: ['hua', 'hua'], jump: 30 }, bujianPerBay: 1 }, LIAO_DOU),
        innerBracket: Object.assign({ name: '内柱铺作（四杪，承四椽栿与藻井）', tiers: ['hua', 'hua', 'hua', 'hua'], jump: 28 }, LIAO_DOU),
        cap: 'roof',
        eave: { overhang: 150, feiyan: 75, feiyanRise: 0.15, rafterD: 12 },
        roof: {
          method: 'juzhe', rafters: 8, rise: 0.26, purlinX: [150, 351, 526, 702, 878, 1053, 1254], purlinD: 28, douH: 18,
          tiers: [
            { name: '乳栿', en: 'ru fu: two-rafter beam', termKey: 'ru-fu', x0: 'c0', x1: 'c1', h: 42, level: 'bracket', mirror: true, role: 'ming' },
            { name: '四椽明栿（承斗八藻井）', en: 'exposed four-rafter beam carrying the octagonal cupola', termKey: 'si-chuan-fu', x0: 'c1', x1: 'c3', h: 56, level: 'bracket', role: 'ming' },
            { name: '四椽草栿', en: 'rough four-rafter beam above the ceiling', termKey: 'cao-fu', x0: 'p2', x1: 'p6', h: 52, role: 'cao' },
            { name: '平梁', en: 'ping liang: top beam', termKey: 'ping-liang', x0: 'p3', x1: 'p5', h: 44 }
          ],
          strut: 'tuofeng', ridge: 'shuzhu+chashou', chashouW: 9, tuojiao: true, tuojiaoW: 8, roofT: 22, ridgeH: 56, ridgeW: 46
        },
        ceiling: [{ kind: 'ping-an', y: { gap: 8 }, x0: 'c1', x1: 'c3', zaojing: true }]
      }
    ],
    lowerEave: null,
    elevation: { bays: [365, 420, 467, 420, 365], shengqi: [0, 3, 6], roofType: 'xieshan', openings: ['zhiling', 'door', 'door', 'door', 'zhiling'], upperOpenings: ['zhiling', 'door', 'door', 'door', 'zhiling'], lattice: 'zhiling', sill: 100, eaveCurve: 0.03 },
    extraParts: [
      { id: 'xumizuo', cat: 'context', label: { zh: '须弥座', en: 'statue pedestal' }, termKey: 'guan-yin', stage: 9, shapes: [{ t: 'rect', x: 502, y: 0, w: 400, h: 120 }], style: { ghost: true } },
      { id: 'guanyin', cat: 'context', label: { zh: '十一面观音像（高约 16 m，辽塑）', en: 'Eleven-headed Guanyin, about 16 m, Liao' }, termKey: 'guan-yin', stage: 9, style: { ghost: true }, shapes: [{ t: 'poly', pts: [[600, 120], [804, 120], [790, 700], [770, 1200], [760, 1450], [740, 1560], [720, 1640], [702, 1690], [684, 1640], [664, 1560], [644, 1450], [634, 1200], [614, 700]] }] }
    ],
    facts: [
      { zh: '辽统和二年（984 年）重建，面阔五间约 20 m，进深四间约 14 m，通高 23 m；外二层内三层，中为平坐暗层。', en: 'Rebuilt 984; about 20 m by 14 m, 23 m high; two storeys outside, three inside with a hidden terrace storey.', confidence: 'high' },
      { zh: '上层柱叉立于下层斗拱之上（叉柱造）；暗层内设斜撑、斜戗柱，加强整体刚度。', en: 'Upper columns are forked onto the bracket sets below (cha zhu zao); diagonal braces stiffen the hidden storey.', confidence: 'high' },
      { zh: '全阁斗拱共 24 种：下檐柱头四杪七铺作隔跳偷心，平坐出三杪，上檐双杪双下昂七铺作，昂尾压于草栿下。', en: '24 kinds of bracket sets: lower eave with four hua gong, terrace with three, upper eave with two hua gong and two ang whose tails press under the rough beams.', confidence: 'high' },
      { zh: '普拍枋在此为现存最早实例；梁断面高宽约 2:1，比后世更合理。', en: 'Earliest surviving pu pai fang plate; beam sections about 2:1, more efficient than later practice.', confidence: 'medium' }
    ],
    sources: ['梁思成《蓟县独乐寺观音阁山门考》', '潘谷西《中国建筑史》', '朱涵瑞、杨一帆《谈辽代木结构建筑营造技术》'],
    frameTerm: 'dian-tang-zao'
  };

  // ================= 金 · 崇福寺弥陀殿 =================
  const JIN_DOU = { ludou: { w: 32, h: 20 }, danCai: 15, zuCai: 21, qi: 6, thick: 10 };
  const JIN = {
    id: 'jin-mituo',
    dynasty: { zh: '金', en: 'Jin', years: '1115–1234' },
    name: { zh: '崇福寺弥陀殿', en: 'Chongfu Temple, Amitabha Hall' },
    year: 1143, place: { zh: '山西朔州', en: 'Shuozhou, Shanxi' },
    summary: {
      zh: '金皇统三年（1143 年）建，面阔七间约 41 m，单檐歇山顶，是现存辽金三大佛殿之一。殿内大胆减柱、移柱：前排金柱只保留四根并移至开间中心，以巨大的大内额承托梁架，佛坛前豁然开阔。柱头七铺作双杪双下昂，补间伸出 45° 斜栱；前檐格子门窗棂花十余种，被誉为“金代五绝”之一。',
      en: 'Built 1143, seven bays and about 41 m wide under a single hip-and-gable roof; one of the three great Liao–Jin Buddhist halls. Columns were boldly omitted and shifted inside: only four front inner columns remain, moved to mid-bay, and a huge interior lintel carries the frame, opening the space before the altar. Column-head sets are 7-puzuo with two hua gong and two ang; intermediate sets throw out 45° diagonal arms. The front lattice doors show more than a dozen patterns.'
    },
    module: { name: '分°', cm: 1.75, note: '材广约 26 cm，1 分° ≈ 1.75 cm' },
    platform: { h: 200, margin: 330 },
    layers: [{
      depthBays: [560, 575, 575, 560],
      columns: [
        { at: 0, kind: 'eave', h: 640, d: 64 },
        { at: 1, kind: 'inner', removed: true, d: 66, label: '减柱处（前槽金柱减去，移至开间中心）', en: 'omitted front inner column, shifted to mid-bay', termKey: 'jian-zhu' },
        { at: 3, kind: 'inner', h: 'auto', d: 70, label: '后金柱（佛坛后）', en: 'rear inner column behind the altar' },
        { at: 4, kind: 'eave', h: 640, d: 64 }
      ],
      cejiao: 0.014,
      ties: ['lan-e', 'pupai-fang', 'da-nei-e'],
      bracket: Object.assign({
        system: 'puzuo', name: '七铺作双杪双下昂（单栱偷心，施斜栱）', en: '7-puzuo: two hua gong, two ang; single arms, open jumps, with diagonal arms',
        tiers: ['hua', 'hua', 'ang', 'ang'], jump: 30, angJump: 27, angReal: true, angSlope: 0.27, angTail: 34,
        jixin: [false, true, false, true], chonggong: false, shuatou: 'ang', inner: { tiers: ['hua', 'hua'], jump: 30 }, xiegong: true, bujianPerBay: 1
      }, JIN_DOU),
      innerBracket: null,
      cap: 'roof',
      eave: { overhang: 150, feiyan: 75, feiyanRise: 0.16, rafterD: 13 },
      roof: {
        method: 'juzhe', rafters: 8, rise: 0.27, purlinX: [150, 560, 847, 1135, 1423, 1710, 2120], purlinD: 30, douH: 20,
        tiers: [
          { name: '乳栿（前，搭于大内额）', en: 'front two-rafter beam landing on the great lintel', termKey: 'ru-fu', x0: 'c0', x1: 'c1', h: 46, level: 'bracket' },
          { name: '乳栿（后）', en: 'rear two-rafter beam', termKey: 'ru-fu', x0: 'c3', x1: 'c4', h: 46, level: 'bracket' },
          { name: '四椽栿（前端由大内额承托）', en: 'four-rafter beam, front end carried by the great lintel', termKey: 'si-chuan-fu', x0: 'p2', x1: 'p6', h: 60 },
          { name: '平梁', en: 'ping liang: top beam', termKey: 'ping-liang', x0: 'p3', x1: 'p5', h: 46 }
        ],
        strut: 'shuzhu', ridge: 'shuzhu+chashou', chashouW: 9, tuojiao: true, tuojiaoW: 8, roofT: 24, ridgeH: 70, ridgeW: 52
      },
      ceiling: [],
      section: { front: 'gezi', back: 'wall' }
    }],
    lowerEave: null,
    elevation: { bays: [520, 590, 620, 660, 620, 590, 520], shengqi: [0, 6, 12, 18], roofType: 'xieshan', openings: ['gezi', 'gezi', 'gezi', 'gezi', 'gezi', 'gezi', 'gezi'], lattice: 'gezi', sill: 0, eaveCurve: 0.035 },
    extraParts: [
      { id: 'fotan', cat: 'context', label: { zh: '凹字形佛坛（西方三圣，金塑）', en: 'U-shaped altar with the Jin statues' }, termKey: 'fo-tan', stage: 9, shapes: [{ t: 'rect', x: 760, y: 0, w: 1060, h: 90 }], style: { ghost: true } }
    ],
    facts: [
      { zh: '金皇统三年（1143 年）建，面阔七间 41.3 m，进深四间，单檐歇山，通高约 21 m。', en: 'Built 1143; seven bays, 41.3 m wide, four bays deep, single hip-and-gable roof about 21 m high.', confidence: 'high' },
      { zh: '减柱、移柱并用：前排原应六根金柱只用四根，两根移至开间中心；金代原构仅佛坛后四根金柱，以大内额承重。', en: 'Columns omitted and shifted: of six front inner columns only four are used, two moved to mid-bay; a great lintel carries the load.', confidence: 'high' },
      { zh: '柱头铺作七铺作双杪双下昂，单栱偷心造，施 45° 斜栱；侧脚、生起明显。', en: 'Column-head sets 7-puzuo with two hua gong and two ang, single arms, open jumps, 45° diagonal arms; strong lean and rise.', confidence: 'high' },
      { zh: '前檐格扇棂花十余种，与匾额、塑像、壁画、琉璃脊饰并称“金代五绝”。', en: 'Over a dozen lattice patterns on the front doors, one of the hall\'s "five Jin treasures".', confidence: 'high' }
    ],
    sources: ['柴泽俊、李正云《朔州崇福寺弥陀殿修缮工程报告》', '赵寿堂等《朔州崇福寺弥陀殿七铺作下昂造斗栱算法溯源》', '潘谷西《中国建筑史》'],
    frameTerm: 'ting-tang-zao'
  };

  // ================= 元 · 永乐宫三清殿 =================
  const YUAN_DOU = { ludou: { w: 32, h: 20 }, danCai: 15, zuCai: 21, qi: 6, thick: 10 };
  const YUAN = {
    id: 'yuan-sanqing',
    dynasty: { zh: '元', en: 'Yuan', years: '1271–1368' },
    name: { zh: '永乐宫三清殿', en: 'Yongle Palace, Hall of the Three Purities' },
    year: 1262, place: { zh: '山西芮城', en: 'Ruicheng, Shanxi' },
    summary: {
      zh: '元中统三年（1262 年）建成的全真教祖庭主殿，单檐庑殿顶，面阔七间、进深四间八椽。殿堂形制：下架明栿承平棊、藻井，上架草栿。殿内只留八根金柱围出内槽神坛，前槽整排内柱都减去，为 403 m² 的《朝元图》壁画留出完整墙面。六铺作单杪双下昂，斗拱已明显缩小；屋面比唐宋更陡。1959 年因三门峡水库整体迁建。',
      en: 'Completed 1262 as the main hall of a Quanzhen Daoist patriarchal temple. Single hip roof, seven by four bays. Palace-type frame: exposed beams below carry a coffered ceiling with cupolas; rough beams above. Only eight inner columns enclose the altar; the whole front row of inner columns was omitted to leave unbroken walls for 403 m² of murals. Bracket sets are 6-puzuo and noticeably smaller; the roof is steeper than Tang or Song. The hall was moved in its entirety in 1959.'
    },
    module: { name: '分°', cm: 1.4, note: '五等材（材广约 20 cm），1 分° ≈ 1.4 cm' },
    platform: { h: 150, margin: 320 },
    layers: [{
      depthBays: [382, 382, 382, 382],
      columns: [
        { at: 0, kind: 'eave', h: 560, d: 56 },
        { at: 1, kind: 'inner', removed: true, d: 58, h: 560, label: '减柱处（前槽内柱整排减去，为壁画留墙）', en: 'front inner columns omitted for the murals', termKey: 'jian-zhu' },
        { at: 2, kind: 'inner', h: 560, d: 60, label: '金柱（内槽前）', en: 'inner column, front of the shrine bay' },
        { at: 3, kind: 'inner', h: 560, d: 60, label: '金柱（内槽后）', en: 'inner column, rear of the shrine bay' },
        { at: 4, kind: 'eave', h: 560, d: 56 }
      ],
      cejiao: 0.008,
      ties: ['lan-e', 'pupai-fang', 'nei-e'],
      bracket: Object.assign({
        system: 'puzuo', name: '六铺作单杪双下昂', en: '6-puzuo: one hua gong and two xia ang',
        tiers: ['hua', 'ang', 'ang'], jump: 30, angJump: 26, angReal: true, angSlope: 0.27, angTail: 34,
        jixin: [true, true, true], chonggong: true, shuatou: 'ang', inner: { tiers: ['hua', 'hua'], jump: 30 }, bujianPerBay: 2
      }, YUAN_DOU),
      innerBracket: Object.assign({ name: '内柱铺作（双杪）', tiers: ['hua', 'hua'], jump: 30 }, YUAN_DOU),
      cap: 'roof',
      eave: { overhang: 135, feiyan: 70, feiyanRise: 0.15, rafterD: 12 },
      roof: {
        method: 'juzhe', rafters: 8, rise: 0.30, purlinX: [125, 382, 573, 764, 955, 1146, 1400], purlinD: 28, douH: 18,
        tiers: [
          { name: '四椽明栿（前槽，跨两间）', en: 'exposed four-rafter beam spanning the two front bays', termKey: 'si-chuan-fu', x0: 'c0', x1: 'c2', h: 56, level: 'bracket', role: 'ming' },
          { name: '乳栿（内槽）', en: 'two-rafter beam across the shrine bay', termKey: 'ru-fu', x0: 'c2', x1: 'c3', h: 42, level: 'bracket', role: 'ming' },
          { name: '乳栿（后槽）', en: 'rear two-rafter beam', termKey: 'ru-fu', x0: 'c3', x1: 'c4', h: 42, level: 'bracket', role: 'ming' },
          { name: '四椽草栿', en: 'rough four-rafter beam above the ceiling', termKey: 'cao-fu', x0: 'p2', x1: 'p6', h: 52, role: 'cao' },
          { name: '平梁', en: 'ping liang: top beam', termKey: 'ping-liang', x0: 'p3', x1: 'p5', h: 42 }
        ],
        strut: 'shuzhu', ridge: 'shuzhu+chashou', chashouW: 7, tuojiao: true, tuojiaoW: 6, roofT: 22, ridgeH: 64, ridgeW: 50
      },
      ceiling: [{ kind: 'ping-qi', y: { gap: 12 }, x0: 'c0', x1: 'c4', zaojing: true }],
      section: { front: 'door', back: 'wall' }
    }],
    lowerEave: null,
    elevation: { bays: [340, 400, 430, 500, 430, 400, 340], shengqi: [0, 3, 6, 8], roofType: 'wudian', openings: ['zhiling', 'door', 'door', 'door', 'door', 'door', 'zhiling'], lattice: 'zhiling', sill: 100, eaveCurve: 0.025 },
    extraParts: [
      { id: 'shentan', cat: 'context', label: { zh: '神坛（内槽）', en: 'altar platform in the inner bay' }, termKey: 'fo-tan', stage: 9, shapes: [{ t: 'rect', x: 800, y: 0, w: 330, h: 80 }], style: { ghost: true } }
    ],
    facts: [
      { zh: '元中统三年（1262 年）建成，面阔七间 28.4 m，进深四间八椽 15.3 m，单檐庑殿；1959 年因三门峡水库整体迁建至今址。', en: 'Completed 1262; 28.4 m by 15.3 m, single hip roof; relocated whole in 1959 for the Sanmenxia reservoir.', confidence: 'high' },
      { zh: '殿堂形制，下架明栿承平棊与七眼藻井，上架草栿；减柱造，殿内仅八根金柱围出内槽。', en: 'Palace-type frame: exposed beams carry a coffered ceiling with seven cupolas, rough beams above; only eight inner columns remain.', confidence: 'high' },
      { zh: '外檐六铺作单杪双下昂，用五等材，斗拱比唐宋明显缩小；屋面举高约 1/3.3，更陡。', en: '6-puzuo sets in the fifth timber grade, clearly smaller than Tang or Song; roof rise about 1/3.3, steeper.', confidence: 'medium' },
      { zh: '殿内《朝元图》壁画 403 m²，是减柱留墙的直接动因。', en: 'The 403 m² Chaoyuan mural is the reason the front inner columns were omitted.', confidence: 'high' }
    ],
    sources: ['杜仙洲《永乐宫的建筑》', '杨怡菲、李路珂、席九龙《山西芮城永乐宫元代天花、藻井研究》', '潘谷西《中国建筑史》'],
    frameTerm: 'dian-tang-zao'
  };

  // ================= 明 · 长陵祾恩殿 =================
  const MING_DOU = { ludou: { w: 3, h: 2 }, danCai: 1.4, zuCai: 2, qi: 0.6, thick: 1.25 };
  const MING = {
    id: 'ming-changling',
    dynasty: { zh: '明', en: 'Ming', years: '1368–1644' },
    name: { zh: '长陵祾恩殿', en: 'Changling Mausoleum, Hall of Eminent Favour' },
    year: 1427, place: { zh: '北京昌平', en: 'Changping, Beijing' },
    summary: {
      zh: '明成祖长陵的祭殿，1427 年建成，仿皇宫奉天殿规制：重檐庑殿顶，面阔九间 66.6 m、进深五间 29.1 m，立于三层汉白玉台基上。六十根整材金丝楠木柱，三十二根重檐金柱高 12.6 m，明间四柱直径逾 1.1 m。斗拱缩小到檐柱高的约五分之一，密排成饰，用假昂与溜金斗拱；梁架为抬梁式，九架梁、七架梁、五架梁、三架梁层层抬起，用瓜柱、脊瓜柱加角背——叉手、托脚已不再使用。柱子不再侧脚、生起，也不减柱。',
      en: 'The sacrificial hall of the Yongle emperor\'s tomb, completed 1427 on the model of the palace throne hall: double-eave hip roof, nine bays (66.6 m) by five (29.1 m) on a three-tier marble platform. Sixty columns of solid nanmu; the 32 tall inner columns reach 12.6 m and the four central ones exceed 1.1 m in diameter. Bracket sets shrink to about one fifth of the eave-column height and crowd the eaves as ornament, with false ang and liu jin sets. The frame is tai liang: stacked beams carrying nine, seven, five and three purlins on short posts with stiffeners; no inclined braces remain. Columns neither lean nor rise, and none are omitted.'
    },
    module: { name: '斗口', cm: 12.5, note: '斗口约 12.5 cm；明清官式以斗口为模数' },
    platform: { h: 313, margin: 900 },
    layers: [{
      depthBays: [582, 582, 582],
      columns: [
        { at: 0, kind: 'eave', h: 1258, d: 100, label: '重檐金柱（高 12.58 m，承上檐）', en: 'tall inner column carrying the upper eave, 12.58 m', termKey: 'jin-zhu' },
        { at: 1, kind: 'inner', h: 'auto', d: 112, label: '里金柱（明间四柱径逾 1.1 m）', en: 'innermost column; the four central ones exceed 1.1 m across', termKey: 'jin-zhu' },
        { at: 2, kind: 'inner', h: 'auto', d: 112, label: '里金柱', en: 'innermost column', termKey: 'jin-zhu' },
        { at: 3, kind: 'eave', h: 1258, d: 100, label: '重檐金柱（高 12.58 m，承上檐）', en: 'tall inner column carrying the upper eave, 12.58 m', termKey: 'jin-zhu' }
      ],
      cejiao: 0,
      ties: ['e-fang', 'ping-ban-fang'], innerTies: ['e-fang'],
      bracket: Object.assign({
        system: 'doukou', name: '重翘重昂九踩（上檐，溜金斗拱）', en: '9-cai: two qiao and two false ang, liu jin type (upper eave)',
        tiers: ['qiao', 'qiao', 'ang', 'ang'], jump: 3, angJump: 3, angReal: false, jixin: [true, true, true, true], chonggong: true, shuatou: 'mayun', inner: { tiers: ['qiao', 'qiao'], jump: 3 }, bujianPerBay: 6, liujin: true
      }, MING_DOU),
      innerBracket: null,
      cap: 'roof',
      eave: { overhang: 90, feiyan: 45, feiyanRise: 0.2, rafterD: 11 },
      roof: {
        method: 'jujia', rafters: 10, steps: [0.5, 0.5, 0.65, 0.75, 0.9], purlinX: [0, 218, 437, 655, 873, 1091, 1310, 1528, 1746], purlinD: 34, douH: 12, purlinAssembly: 'lin3',
        tiers: [
          { name: '九架梁（大梁，承九檩）', en: 'great beam carrying nine purlins', termKey: 'jiu-jia-liang', x0: 'p1', x1: 'p9', h: 96, noTuojiao: true },
          { name: '七架梁', en: 'seven-purlin beam', termKey: 'qi-jia-liang', x0: 'p2', x1: 'p8', h: 84 },
          { name: '五架梁', en: 'five-purlin beam', termKey: 'wu-jia-liang', x0: 'p3', x1: 'p7', h: 74 },
          { name: '三架梁', en: 'three-purlin beam', termKey: 'san-jia-liang', x0: 'p4', x1: 'p6', h: 64 }
        ],
        strut: 'guazhu', ridge: 'guazhu+jiaobei', tuojiao: false, roofT: 28, ridgeH: 80, ridgeW: 60
      },
      ceiling: [],
      section: null
    }],
    lowerEave: {
      depth: 582, columnH: 640, columnD: 84, ties: ['e-fang', 'ping-ban-fang'], termKey: 'chong-yan',
      columnLabel: '檐柱（下檐）', columnTermKey: 'yan-zhu',
      bracket: Object.assign({
        system: 'doukou', name: '单翘重昂七踩（下檐）', en: '7-cai: one qiao and two false ang (lower eave)',
        tiers: ['qiao', 'ang', 'ang'], jump: 3, angJump: 3, angReal: false, jixin: [true, true, true], chonggong: true, shuatou: 'mayun', inner: { tiers: ['qiao'], jump: 3 }, bujianPerBay: 6
      }, MING_DOU),
      beamH: 72, beamName: ['桃尖梁（抱头梁，插入金柱）', 'tao jian liang: eave beam tenoned into the tall inner column', 'tao-jian-liang'],
      rise: 0.5, eave: { overhang: 80, feiyan: 40, feiyanRise: 0.2, rafterD: 10 },
      section: { front: 'linghua', back: 'wall' }
    },
    elevation: { bays: [600, 680, 720, 760, 1034, 760, 720, 680, 600], shengqi: [0], roofType: 'chongyan-wudian', openings: ['wall', 'linghua', 'linghua', 'linghua', 'linghua', 'linghua', 'linghua', 'linghua', 'wall'], lattice: 'linghua', sill: 0, eaveCurve: 0.015 },
    extraParts: [],
    facts: [
      { zh: '明宣德二年（1427 年）建成，重檐庑殿，面阔九间 66.56 m、进深五间 29.12 m，正脊至地 25.1 m，立于三层汉白玉台基。', en: 'Completed 1427; double-eave hip roof, 66.56 m by 29.12 m, ridge 25.1 m above ground, on a three-tier marble platform.', confidence: 'high' },
      { zh: '六十根整材金丝楠木柱，三十二根重檐金柱高 12.58 m，明间四柱底径达 1.12 m；无侧脚生起，亦无减柱。', en: 'Sixty solid nanmu columns; 32 tall inner columns of 12.58 m; the four central ones 1.12 m across at the base; no lean, rise, or omitted columns.', confidence: 'high' },
      { zh: '上檐重翘重昂九踩溜金斗拱，下檐单翘重昂七踩；昂皆为假昂，平身科每间六至八攒。', en: 'Upper eave 9-cai liu jin sets, lower eave 7-cai; all ang are false; six to eight intermediate sets per bay.', confidence: 'high' },
      { zh: '抬梁式梁架以瓜柱、脊瓜柱与角背承檩，不用叉手、托脚；举架五举至九举。剖面为示意，梁架层数依官式通则简化。', en: 'Tai liang frame with short posts and stiffeners, no inclined braces; roof steps from 0.5 to 0.9. The section is schematic, following official practice.', confidence: 'medium' }
    ],
    sources: ['明十三陵特区《长陵祾恩殿》资料', '程昊淼、张昕《明代皇家金丝楠木大殿建筑艺术特征分析》', '梁思成《清式营造则例》', '潘谷西《中国建筑史》'],
    frameTerm: 'tai-liang'
  };

  const BUILDINGS = [TANG, SONG, LIAO, JIN, YUAN, MING];

  const EVOLUTION = {
    metrics: [
      { key: 'bracketRatio', zh: '斗拱高 ÷ 檐柱高', en: 'bracket height ÷ column height', fmt: v => '约 1/' + (1 / v).toFixed(1) },
      { key: 'overhangRatio', zh: '出檐 ÷ 檐柱高', en: 'eave projection ÷ column height', fmt: v => '约 ' + v.toFixed(2) },
      { key: 'slopeRatio', zh: '举高 ÷ 前后撩檐距', en: 'rise ÷ span', fmt: v => '约 1/' + (1 / v).toFixed(1) },
      { key: 'bujianPerBay', zh: '每间补间铺作', en: 'intermediate sets per bay', fmt: v => v + ' 朵' },
      { key: 'hasChashou', zh: '叉手·托脚', en: 'inclined braces', fmt: v => v ? '有' : '无' },
      { key: 'removedColumns', zh: '减柱（剖面内）', en: 'omitted columns in section', fmt: v => v ? v + ' 处' : '无' }
    ]
  };

  const TRENDS = [
    { zh: '斗拱：由结构走向装饰', text: '唐代斗拱高近柱高一半，每间只一朵补间；明代缩到约五分之一，一间密排六至八攒，昂变成不斜插的假昂——受力靠梁，斗拱成了檐下的装饰带。' },
    { zh: '斜向支撑：从有到无', text: '唐宋辽金元的屋架里，叉手托住脊槫，托脚顶住各檩，辽代楼阁暗层还有斜撑。明代官式改用直立的瓜柱、脊瓜柱加角背，斜向构件从大木作中消失。' },
    { zh: '屋面：越来越陡，出檐越来越短', text: '唐代举高约 1/4.8、出檐近四米；宋代用“举折”画出柔和曲线；明清用“举架”逐步加陡到九举，斗拱缩小后出檐也随之收短。' },
    { zh: '柱：侧脚生起淡出，减柱移柱起落', text: '宋代柱子明显内倾（侧脚）、角柱升高（生起）；金元为了大空间大胆减柱、移柱，以大内额承重；明官式回归整齐柱网，侧脚生起几近消失。' },
    { zh: '昂：真昂→假昂→溜金', text: '唐辽真昂斜插、后尾压在梁下，是杠杆式挑檐构件；宋代副阶出现假昂，只留昂嘴；明清假昂普遍，补间以“溜金”秤杆后尾搭在金檩上。' },
    { zh: '门窗：直棂→格子→菱花', text: '唐辽多用直棂窗、板门；宋金格子门流行，弥陀殿棂花十余种；明清官式定型为三交六椀菱花格扇，图案越繁复，等级越高。' }
  ];

  const TOUR = [
    { building: 'tang-foguang', build: true, title: '唐 · 佛光寺东大殿', text: '先看唐代。从台基到屋面，木构逐层搭起：柱、额、斗拱、梁、檩、椽、瓦。留意斗拱有多大、出檐有多远。', dur: 17000 },
    { building: 'tang-foguang', select: 'L0-br-c0$', title: '雄大的斗拱', text: '七铺作双杪双下昂，高近柱高一半。真昂斜插，后尾压在草栿下，用杠杆把屋檐挑出近四米。' },
    { building: 'tang-foguang', lens: 'L0-frame', title: '大叉手', text: '平梁上一对大叉手直抵脊槫，不用蜀柱——现存唯一实例。托脚斜顶各檩：唐代屋架里斜向构件很多。' },
    { building: 'tang-foguang', explode: true, title: '拆开看', text: '屋面、椽、檩、支撑、梁栿、斗拱、柱，一层层叠上去，靠榫卯与重力咬合，不用一根钉子。' },
    { building: 'song-shengmu', build: true, title: '宋 · 晋祠圣母殿', text: '重檐歇山，四周围廊（副阶周匝）。前廊深两间：殿身前檐柱被减去，改由副阶梁上的“抬柱”承托上檐。', dur: 17000 },
    { building: 'song-shengmu', lens: 'LE-br-f', title: '假昂出现', text: '下檐（副阶）柱头铺作已用假昂——只有昂嘴，不再斜插；上檐仍用真昂。这是斗拱装饰化的开端。' },
    { building: 'song-shengmu', filter: ['column', 'ghost'], title: '侧脚与生起', text: '四周柱子微微内倾（侧脚），角柱略高（生起），构架向心而稳。勾选“夸大侧脚·生起”会更明显。' },
    { building: 'liao-guanyin', build: true, title: '辽 · 独乐寺观音阁', text: '外看两层，内有三层——中间是平坐暗层。辽承唐风，斗拱依旧硕大，斗拱多达二十四种。', dur: 17000 },
    { building: 'liao-guanyin', lens: 'L1-frame', title: '暗层斜撑与叉柱造', text: '暗层里的斜撑像现代桁架一样把整层箍紧；上层柱脚叉在下层斗拱上（叉柱造）。千年间多次大地震而不倒。' },
    { building: 'jin-mituo', build: true, title: '金 · 崇福寺弥陀殿', text: '前排金柱减去、移位，以大内额承重，佛坛前豁然开阔——减柱、移柱盛行的时代。', dur: 17000 },
    { building: 'jin-mituo', lens: 'L0-br-c0$', title: '斜栱', text: '柱头七铺作双杪双下昂；补间还伸出 45° 斜栱（点“正视”看）。斜栱好看但受力意义不大——装饰意味更浓了。' },
    { building: 'jin-mituo', select: 'L0-front-open', title: '格子门棂花', text: '前檐格子门棂花十余种，是金代小木作精品。双击门窗，或点右下角立面图，看各代棂花式样。' },
    { building: 'yuan-sanqing', build: true, title: '元 · 永乐宫三清殿', text: '殿内仅八根金柱围着神坛，前槽整排内柱都减去，为壁画留出大片墙面。斗拱开始缩小，屋面更陡。', dur: 17000 },
    { building: 'ming-changling', build: true, title: '明 · 长陵祾恩殿', text: '重檐庑殿、六十根金丝楠木柱。斗拱缩到檐柱高约五分之一、密排成饰；假昂、溜金斗拱定型。', dur: 17000 },
    { building: 'ming-changling', lens: 'L0-frame', title: '抬梁式', text: '九架梁、七架梁、五架梁、三架梁层层抬起，用瓜柱、脊瓜柱加角背——叉手、托脚消失了。' },
    { building: 'ming-changling', explode: true, title: '再拆一次', text: '与唐代拆解对比：构件更多、更小、更规整，斗口制统一了尺度。结构越成熟，斗拱越退居装饰。' },
    { building: 'ming-changling', evo: true, title: '回看六朝', text: '斗拱由大变小、由结构转装饰；斜撑消失；屋面变陡、出檐变短；减柱盛于金元，明官式不用。按 V 可随时打开这张对比。', dur: 22000 }
  ];

  root.ARCH_DATA = { BUILDINGS, STAGES, CATS, EVOLUTION, TRENDS, TOUR, SONG_DOU };
})(typeof window !== 'undefined' ? window : globalThis);
