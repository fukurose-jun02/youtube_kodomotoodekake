// Workerの入口。/api/chat だけをここで処理し、それ以外は静的ファイル（サイト本体）を返す。
import catalog from './catalog.json';
import { handleChat } from './chat.mjs';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/chat') return handleChat(request, env, { catalog });
    return env.ASSETS.fetch(request);
  },
};
