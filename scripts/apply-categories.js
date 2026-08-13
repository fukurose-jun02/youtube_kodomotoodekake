#!/usr/bin/env node
// scripts/category-mapping.json（動画ID → カテゴリー）の内容を、YouTube側の
// 各動画の「タグ」欄に反映する一回限りのスクリプト。
// 実行方法: node scripts/apply-categories.js
//
// sync-videos.js は読み取り専用スコープ（youtube.readonly）のため、
// 書き込みにはこのスクリプト専用の別スコープ・別リフレッシュトークンを使う
// （sync-videos.js 側の認証情報を汚さないように分離）。
//
// 事前準備（.env に設定、YOUTUBE_OAUTH_CLIENT_ID/SECRET は sync-videos.js と共用):
//   YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET
//   YOUTUBE_OAUTH_WRITE_REFRESH_TOKEN
//     初回実行時にブラウザでの認証（書き込み権限に同意）を行うと自動で.envに書き込まれる

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const MAPPING_PATH = path.join(__dirname, 'category-mapping.json');
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
// videos.update（タグの書き換え）には読み取り専用スコープでは不十分なため、書き込み用スコープを使う
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const REFRESH_TOKEN_KEY = 'YOUTUBE_OAUTH_WRITE_REFRESH_TOKEN';

const CATEGORIES = ['おでかけ', '保育園', 'プール', '旅行', '体験', 'おもいで'];

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return '';
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function loadEnv() {
  const raw = readEnvFile();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('.env に YOUTUBE_OAUTH_CLIENT_ID と YOUTUBE_OAUTH_CLIENT_SECRET を設定してください（sync-videos.js と共用）。');
    process.exit(1);
  }
  return { clientId, clientSecret, refreshToken: process.env[REFRESH_TOKEN_KEY] || '' };
}

function saveRefreshToken(refreshToken) {
  const raw = readEnvFile();
  const lines = raw.length ? raw.split('\n') : [];
  let found = false;
  const updated = lines.map(line => {
    if (line.trim().startsWith(`${REFRESH_TOKEN_KEY}=`)) {
      found = true;
      return `${REFRESH_TOKEN_KEY}=${refreshToken}`;
    }
    return line;
  });
  if (!found) {
    if (updated.length && updated[updated.length - 1] !== '') updated.push('');
    updated.push(`${REFRESH_TOKEN_KEY}=${refreshToken}`);
  }
  fs.writeFileSync(ENV_PATH, updated.join('\n').replace(/\n*$/, '\n'));
  console.log(`.env に ${REFRESH_TOKEN_KEY} を保存しました（次回以降はブラウザ認証不要）`);
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OAuthトークン取得エラー: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

function openBrowser(url) {
  execFile('open', [url], () => {});
}

function runInteractiveAuth(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    let redirectUri = '';
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (!code && !error) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(error
        ? '<p>認証がキャンセルされました。ターミナルに戻ってください。</p>'
        : '<p>認証が完了しました。このタブは閉じてターミナルに戻ってください。</p>');
      server.close();
      if (error) {
        reject(new Error(`認証がキャンセルされました: ${error}`));
        return;
      }
      try {
        const tokens = await postForm(TOKEN_ENDPOINT, {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });
        resolve(tokens);
      } catch (e) {
        reject(e);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPE);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log('\nブラウザで認証してください（書き込み権限への同意が必要です。自動で開かない場合は下記URLを開いてください）:');
      console.log(authUrl.toString());
      openBrowser(authUrl.toString());
    });
  });
}

async function getAccessToken(env) {
  if (env.refreshToken) {
    try {
      const tokens = await postForm(TOKEN_ENDPOINT, {
        client_id: env.clientId,
        client_secret: env.clientSecret,
        refresh_token: env.refreshToken,
        grant_type: 'refresh_token',
      });
      return tokens.access_token;
    } catch (e) {
      console.warn('保存済みのリフレッシュトークンが無効になっていました。再認証します。');
    }
  }
  const tokens = await runInteractiveAuth(env.clientId, env.clientSecret);
  if (tokens.refresh_token) saveRefreshToken(tokens.refresh_token);
  return tokens.access_token;
}

async function apiGet(endpoint, params, accessToken) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (GET ${endpoint}): ${res.status} ${body}`);
  }
  return res.json();
}

async function apiPut(endpoint, params, body, accessToken) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`YouTube API error (PUT ${endpoint}): ${res.status} ${errBody}`);
  }
  return res.json();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getSnippets(accessToken, ids) {
  const map = new Map();
  for (const batch of chunk(ids, 50)) {
    const data = await apiGet('videos', { part: 'snippet', id: batch.join(',') }, accessToken);
    for (const item of data.items) map.set(item.id, item.snippet);
  }
  return map;
}

async function main() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const ids = Object.keys(mapping);
  for (const [id, cat] of Object.entries(mapping)) {
    if (!CATEGORIES.includes(cat)) {
      throw new Error(`不正なカテゴリー: ${id} -> ${cat}`);
    }
  }
  console.log(`${ids.length}件の動画にカテゴリータグを反映します。`);

  const env = loadEnv();
  const accessToken = await getAccessToken(env);

  console.log('現在のタグ状況を取得中...');
  const snippets = await getSnippets(accessToken, ids);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    const snippet = snippets.get(id);
    if (!snippet) {
      console.warn(`⚠ [${id}] videos.listで見つかりませんでした。スキップします。`);
      failed++;
      continue;
    }
    const targetCat = mapping[id];
    const existingTags = snippet.tags || [];
    if (existingTags.includes(targetCat)) {
      skipped++;
      continue;
    }
    // 他のカテゴリータグが誤って付いていた場合は入れ替え、それ以外のタグは保持する
    const otherTags = existingTags.filter(t => !CATEGORIES.includes(t));
    const newTags = [...otherTags, targetCat];
    const newSnippet = { ...snippet, tags: newTags };
    try {
      await apiPut('videos', { part: 'snippet' }, { id, snippet: newSnippet }, accessToken);
      updated++;
      console.log(`✓ [${id}] ${snippet.title} → ${targetCat}`);
    } catch (e) {
      failed++;
      console.error(`✗ [${id}] ${snippet.title}: ${e.message}`);
    }
  }

  console.log(`\n完了: 更新${updated}件 / 既に反映済み${skipped}件 / 失敗${failed}件`);
  console.log('\nYouTube側のタグを更新しました。node scripts/sync-videos.js を再実行して data/videos.json と index.html に反映してください。');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
