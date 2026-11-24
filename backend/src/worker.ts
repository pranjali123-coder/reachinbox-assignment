import { startWorker } from './queue/worker.js';
import { ensureIndex } from './services/search.service.js';
startWorker().then(async () => { await ensureIndex(); console.log('Email worker started'); }).catch(err => { console.error(err); process.exit(1); });
