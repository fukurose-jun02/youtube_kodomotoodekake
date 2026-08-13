#!/usr/bin/env node
// YouTube Data API（OAuth認証）から動画一覧を取得し、data/videos.json と
// index.html の VIDEOS 配列（AUTO-GENERATED:VIDEOS-START〜END の間）を更新する。
// 実行方法: node scripts/sync-videos.js
//
// 事前準備（.env に設定）:
//   YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET
//     Google Cloud Console > APIs & Services > 認証情報 >
//     OAuth クライアント ID を作成（アプリケーションの種類: デスクトップアプリ）
//   YOUTUBE_OAUTH_REFRESH_TOKEN
//     初回実行時にブラウザでの認証を行うと自動で .env に書き込まれる（以降は不要）
//
// 限定公開（Unlisted）の動画も含めて自分のチャンネルの全動画を取得するため、
// APIキーではなくOAuth（チャンネル所有者としてのログイン）を使う。

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const DATA_PATH = path.join(ROOT, 'data', 'videos.json');
const INDEX_PATH = path.join(ROOT, 'index.html');
const START_MARKER = '// AUTO-GENERATED:VIDEOS-START';
const END_MARKER = '// AUTO-GENERATED:VIDEOS-END';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

// タグ欄から抽出するカテゴリー（index.html の CATS と一致させる）
const CATEGORIES = ['おでかけ', '保育園', 'プール', '旅行', '体験', 'おもいで'];
const UNCATEGORIZED = '未分類';

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
    console.error(
      '.env に YOUTUBE_OAUTH_CLIENT_ID と YOUTUBE_OAUTH_CLIENT_SECRET を設定してください。\n' +
      'Google Cloud Console > APIs & Services > 認証情報 で\n' +
      '「OAuth クライアント ID」（アプリケーションの種類: デスクトップアプリ）を作成し、\n' +
      '発行されたクライアントIDとシークレットを.envに追記してください。'
    );
    process.exit(1);
  }
  return { clientId, clientSecret, refreshToken: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN || '' };
}

// .envファイル内のYOUTUBE_OAUTH_REFRESH_TOKEN行を更新（なければ追記）。他の行はそのまま保持。
function saveRefreshToken(refreshToken) {
  const raw = readEnvFile();
  const lines = raw.length ? raw.split('\n') : [];
  const key = 'YOUTUBE_OAUTH_REFRESH_TOKEN';
  let found = false;
  const updated = lines.map(line => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${refreshToken}`;
    }
    return line;
  });
  if (!found) {
    if (updated.length && updated[updated.length - 1] !== '') updated.push('');
    updated.push(`${key}=${refreshToken}`);
  }
  fs.writeFileSync(ENV_PATH, updated.join('\n').replace(/\n*$/, '\n'));
  console.log('.env に YOUTUBE_OAUTH_REFRESH_TOKEN を保存しました（次回以降はブラウザ認証不要）');
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`OAuthトークン取得エラー: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function openBrowser(url) {
  execFile('open', [url], () => {}); // macOS向け。失敗しても無視（手動で開いてもらえばよい）
}

// ブラウザでのOAuth認証（初回のみ）。ローカルに一時サーバーを立てて認可コードを受け取る。
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

      console.log('\nブラウザで認証してください（自動で開かない場合は下記URLを開いてください）:');
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
    throw new Error(`YouTube API error (${endpoint}): ${res.status} ${body}`);
  }
  return res.json();
}

async function getMyUploadsPlaylistId(accessToken) {
  const data = await apiGet('channels', { part: 'snippet,contentDetails', mine: 'true' }, accessToken);
  const channel = data.items && data.items[0];
  if (!channel) throw new Error('認証したGoogleアカウントに紐づくYouTubeチャンネルが見つかりません');
  console.log(`チャンネル: ${channel.snippet.title}`);
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists && channel.contentDetails.relatedPlaylists.uploads;
  if (!uploadsPlaylistId) throw new Error('アップロード用プレイリストが見つかりませんでした');
  return uploadsPlaylistId;
}

async function getAllVideoIds(accessToken, playlistId) {
  const ids = [];
  let pageToken = '';
  do {
    const params = { part: 'contentDetails', playlistId, maxResults: 50 };
    if (pageToken) params.pageToken = pageToken;
    const data = await apiGet('playlistItems', params, accessToken);
    for (const item of data.items) ids.push(item.contentDetails.videoId);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return ids;
}

async function getVideoDetails(accessToken, ids) {
  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await apiGet('videos', { part: 'snippet', id: batch.join(',') }, accessToken);
    details.push(...data.items);
  }
  return details;
}

function pickCategory(tags, videoId, title, warnings) {
  const found = (tags || []).find(tag => CATEGORIES.includes(tag));
  if (found) return found;
  warnings.push(`  - [${videoId}] ${title}`);
  return UNCATEGORIZED;
}

function buildVideos(details) {
  const warnings = [];
  const videos = details.map(item => {
    const s = item.snippet;
    return {
      id: item.id,
      title: s.title,
      desc: (s.description || '').trim(),
      cat: pickCategory(s.tags, item.id, s.title, warnings),
      year: new Date(s.publishedAt).getFullYear(),
      publishedAt: s.publishedAt,
    };
  });
  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  for (const v of videos) delete v.publishedAt;
  return { videos, warnings };
}

function writeDataFile(videos) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(videos, null, 2) + '\n');
  console.log(`data/videos.json を更新しました（${videos.length}件）`);
}

function formatEntry(v) {
  const esc = s => JSON.stringify(s);
  return `  { id:${esc(v.id)}, title:${esc(v.title)}, desc:${esc(v.desc)}, cat:${esc(v.cat)}, year:${v.year} },`;
}

function updateIndexHtml(videos) {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`index.html に ${START_MARKER} / ${END_MARKER} マーカーが見つかりません`);
  }
  const block = [
    START_MARKER,
    'const VIDEOS = [',
    ...videos.map(formatEntry),
    '];',
    END_MARKER,
  ].join('\n');
  const updated = html.slice(0, startIdx) + block + '\n' + html.slice(endIdx + END_MARKER.length);
  fs.writeFileSync(INDEX_PATH, updated);
  console.log('index.html の VIDEOS 配列を更新しました');
}

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);
  console.log('YouTube Data API から動画一覧を取得中...');
  const playlistId = await getMyUploadsPlaylistId(accessToken);
  const ids = await getAllVideoIds(accessToken, playlistId);
  console.log(`${ids.length}本の動画を検出`);
  const details = await getVideoDetails(accessToken, ids);
  const { videos, warnings } = buildVideos(details);

  writeDataFile(videos);
  updateIndexHtml(videos);

  if (warnings.length) {
    console.warn(`\n⚠ カテゴリータグが未設定/該当なしのため「${UNCATEGORIZED}」で仮登録した動画（${warnings.length}件）:`);
    console.warn(warnings.join('\n'));
    console.warn('YouTube Studio側でタグを設定後、再実行してください。');
  }

  console.log('\n差分を確認してから git commit / push してください。');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { formatEntry, updateIndexHtml, buildVideos, pickCategory };
