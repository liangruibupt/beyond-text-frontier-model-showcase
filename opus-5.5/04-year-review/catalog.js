// catalog.js — 有集的商品目录（虚构）：品类、商品名（字幕和配音里说的简称）、模型、颜色、价格（纯数据）
// kind 是程序建模的外形（js/models/）：pouch 立袋 · box 盒 · pack 软包 · can 罐 · bottle 瓶
// colors：[主体, 标签, 点缀]；price 日常价，deal 双11 到手价

export const KINDS = ['pouch', 'box', 'pack', 'can', 'bottle'];

/** 品类，按这个顺序排：统计里订单数相同的品类，排前面的在前 */
export const CATS = {
  coffee: { zh: '咖啡', en: 'coffee' },
  drinks: { zh: '饮料', en: 'drinks' },
  snacks: { zh: '零食', en: 'snacks' },
  home: { zh: '日用', en: 'home' },
  baby: { zh: '母婴', en: 'baby' },
  outdoor: { zh: '户外', en: 'outdoor' },
  gaming: { zh: '游戏', en: 'gaming' },
};

const item = (cat, zh, en, kind, colors, price, deal) => ({ cat, name: { zh, en }, kind, colors, price: { CNY: price[0], USD: price[1] }, deal: { CNY: deal[0], USD: deal[1] } });

export const ITEMS = {
  'cf-beans': item('coffee', '咖啡豆', 'coffee beans', 'pouch', ['#5a3a26', '#f1e3cc', '#c98a3d'], [99, 15], [69, 10]),
  'cf-drip': item('coffee', '挂耳咖啡', 'drip bags', 'box', ['#e9dcc6', '#6b4630', '#c98a3d'], [59, 9], [39, 6]),
  'cf-capsule': item('coffee', '胶囊咖啡', 'coffee capsules', 'box', ['#2f2a28', '#d9a441', '#f3ead8'], [79, 12], [55, 8]),
  'cf-coldbrew': item('coffee', '冷萃咖啡', 'cold brew', 'bottle', ['#3a2417', '#f4efe6', '#8fb3c9'], [49, 7], [35, 5]),
  'cf-geisha': item('coffee', '瑰夏咖啡豆', 'Geisha beans', 'pouch', ['#1f3b35', '#e9c46a', '#f4ecdf'], [169, 25], [129, 19]),
  'dr-energy': item('drinks', '能量饮料', 'energy drinks', 'can', ['#16c2d5', '#1b1238', '#f5f06a'], [72, 11], [49, 7]),
  'dr-soda': item('drinks', '苏打水', 'sparkling water', 'can', ['#dff3f2', '#3a8fb7', '#f2f7f7'], [39, 6], [29, 4]),
  'dr-oat': item('drinks', '燕麦奶', 'oat milk', 'box', ['#f5ecd9', '#6f8f4e', '#d8b56a'], [59, 9], [42, 6]),
  'dr-tea': item('drinks', '冰红茶', 'iced tea', 'bottle', ['#c2542d', '#fbe7c6', '#2f6b45'], [36, 5], [25, 4]),
  'sn-nuts': item('snacks', '每日坚果', 'mixed nuts', 'pouch', ['#e4a444', '#fff4de', '#7a4b23'], [69, 10], [49, 7]),
  'sn-chips': item('snacks', '薯片', 'chips', 'pouch', ['#f4c542', '#d9372b', '#fff7e0'], [29, 4], [19, 3]),
  'sn-jerky': item('snacks', '牛肉干', 'beef jerky', 'pouch', ['#8a2f22', '#f2dfc4', '#e7b04b'], [59, 9], [39, 6]),
  'hm-tissue': item('home', '抽纸', 'tissues', 'pack', ['#f7f4ee', '#7cb7c9', '#e8a0a8'], [49, 7], [32, 5]),
  'hm-detergent': item('home', '洗衣液', 'laundry liquid', 'bottle', ['#4f86c6', '#f4f7fb', '#9ad0e6'], [69, 10], [45, 7]),
  'hm-bags': item('home', '垃圾袋', 'bin bags', 'box', ['#5c6b73', '#e9eef0', '#9fd1a8'], [25, 4], [16, 2]),
  'bb-diapers': item('baby', '纸尿裤', 'diapers', 'pack', ['#f6f1ea', '#8fc9e8', '#f4a38c'], [159, 24], [109, 16]),
  'bb-wipes': item('baby', '湿巾', 'baby wipes', 'pack', ['#eef7f2', '#7fcbb0', '#f6d27a'], [39, 6], [26, 4]),
  'bb-formula': item('baby', '奶粉', 'formula', 'can', ['#f4efe3', '#2c3a5c', '#e7b86b'], [299, 45], [229, 34]),
  'bb-bottle': item('baby', '奶瓶', 'baby bottles', 'bottle', ['#f2f5f7', '#f4a38c', '#8fc9e8'], [129, 19], [89, 13]),
  'od-gas': item('outdoor', '气罐', 'gas canisters', 'can', ['#e8742c', '#1f3a2a', '#f2e9d6'], [45, 7], [29, 4]),
  'od-meal': item('outdoor', '自热米饭', 'camp meals', 'box', ['#d9482b', '#fbe9c9', '#2f6b45'], [39, 6], [26, 4]),
  'od-lantern': item('outdoor', '营地灯', 'lanterns', 'box', ['#2f6b45', '#f1e6c8', '#f2b233'], [189, 28], [129, 19]),
  'gm-cards': item('gaming', '游戏点卡', 'game cards', 'box', ['#6b3cf0', '#f2eeff', '#35e6f0'], [100, 15], [88, 13]),
  'gm-controller': item('gaming', '手柄', 'controllers', 'box', ['#1b1238', '#35e6f0', '#9a5cff'], [399, 59], [299, 45]),
  'gm-headset': item('gaming', '耳机', 'headsets', 'box', ['#26203a', '#ff5c8a', '#f2eeff'], [499, 75], [359, 55]),
};

export const CATALOG = { cats: CATS, items: ITEMS };
