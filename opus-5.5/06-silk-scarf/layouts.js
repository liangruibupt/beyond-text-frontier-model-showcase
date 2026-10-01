// layouts.js — 每种比例 × 每个镜头的构图：主体锚点（画面比例坐标，y 向下）、占画面高度、最大宽度、文字区 [x, y, w, h]、对齐
// 四款的镜头各不相同，但只有四种构图：开场（字幕一句）、过程（主体居中偏右，无字或一句）、产品（标题 + 副标）、片尾。
// 每个镜头 id 归到其中一种（KIND）；9:16 是粗排，只交付 16:9 和 1:1
import { SHOTS } from './meta.js';

export const KIND = {
  dh_cave: 'open', dh_fly: 'line', dh_ceiling: 'line', dh_drape: 'line', dh_hero: 'title',
  sj_warp: 'open', sj_weave: 'line', sj_lift: 'line', sj_fold: 'line', sj_box: 'title',
  qh_paint: 'open', qh_bloom: 'line', qh_slip: 'line', qh_pool: 'line', qh_hero: 'title',
  yh_dusk: 'open', yh_crane: 'line', yh_glide: 'line', yh_land: 'line', yh_hero: 'title',
  end: 'end',
};
const ROWS = {
  '9x16': {
    open: { anchor: [0.45, 0.36], size: 0.42, maxW: 0.78, align: 'center', zones: { cap: [0.08, 0.62, 0.74, 0.1] } },
    line: { anchor: [0.45, 0.38], size: 0.46, maxW: 0.78, align: 'center', zones: { cap: [0.08, 0.66, 0.74, 0.08] } },
    title: { anchor: [0.45, 0.33], size: 0.42, align: 'center', zones: { title: [0.08, 0.58, 0.74, 0.1], sub: [0.08, 0.69, 0.74, 0.05] } },
    end: { anchor: [0.45, 0.27], size: 0.32, align: 'center', zones: { logo: [0.1, 0.48, 0.7, 0.08], brand: [0.1, 0.56, 0.7, 0.04], line1: [0.1, 0.615, 0.7, 0.055], line2: [0.1, 0.675, 0.7, 0.07], line3: [0.1, 0.75, 0.7, 0.05] } },
  },
  '1x1': {
    open: { anchor: [0.5, 0.42], size: 0.62, maxW: 0.8, align: 'center', zones: { cap: [0.08, 0.8, 0.84, 0.1] } },
    line: { anchor: [0.5, 0.44], size: 0.66, maxW: 0.8, align: 'center', zones: { cap: [0.08, 0.84, 0.84, 0.08] } },
    title: { anchor: [0.5, 0.38], size: 0.6, align: 'center', zones: { title: [0.08, 0.73, 0.84, 0.12], sub: [0.08, 0.86, 0.84, 0.06] } },
    end: { anchor: [0.5, 0.26], size: 0.4, align: 'center', zones: { logo: [0.1, 0.5, 0.8, 0.1], brand: [0.1, 0.6, 0.8, 0.05], line1: [0.1, 0.67, 0.8, 0.07], line2: [0.1, 0.74, 0.8, 0.11], line3: [0.1, 0.85, 0.8, 0.07] } },
  },
  '16x9': {
    open: { anchor: [0.64, 0.5], size: 0.8, maxW: 0.56, align: 'left', zones: { cap: [0.06, 0.42, 0.34, 0.16] } },
    line: { anchor: [0.62, 0.5], size: 0.84, maxW: 0.6, align: 'left', zones: { cap: [0.06, 0.8, 0.4, 0.1] } },
    title: { anchor: [0.68, 0.5], size: 0.86, align: 'left', zones: { title: [0.07, 0.32, 0.4, 0.22], sub: [0.07, 0.55, 0.4, 0.08] } },
    end: { anchor: [0.73, 0.5], size: 0.7, align: 'left', zones: { logo: [0.07, 0.2, 0.45, 0.16], brand: [0.07, 0.36, 0.45, 0.07], line1: [0.07, 0.5, 0.45, 0.08], line2: [0.07, 0.59, 0.45, 0.13], line3: [0.07, 0.73, 0.45, 0.08] } },
  },
};
export const LAYOUTS = Object.fromEntries(Object.entries(ROWS).map(([ar, R]) => [ar, Object.fromEntries(SHOTS.map(s => [s, R[KIND[s]]]))]));
