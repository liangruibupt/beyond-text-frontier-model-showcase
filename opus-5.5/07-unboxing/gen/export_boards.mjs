import { BOARDS } from './meta.js';
import fs from 'node:fs';
fs.writeFileSync(new URL('./boards.json', import.meta.url), JSON.stringify(BOARDS, null, 2));
console.log('boards.json written; items:', Object.keys(BOARDS).join(','));
