#!/usr/bin/env node
// YouTube Data API（OAuth認証）から動画一覧を取得し、data/videos.json と
// data/videos.csv（Googleスプレッドシート等で開く用）と
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
const CSV_PATH = path.join(ROOT, 'data', 'videos.csv');
const CLAIMS_PATH = path.join(ROOT, 'data', 'claims.json');
const SPOTS_PATH = path.join(ROOT, 'data', 'spots.json');
const CATALOG_PATH = path.join(ROOT, 'worker', 'catalog.json');
// 子どもの当時の年齢を出すための基準日（誕生日）
const CHILD_BIRTHDAY = '2021-06-22';
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

// YouTube Data APIには「動画」と「ショート」を区別する公式フィールドが無いため、
// /shorts/{videoId} へのアクセス結果（ショートなら200のまま、通常動画なら
// /watch?v=... へリダイレクトされる）で判定する非公式だが実用的な方法を使う。
async function isShort(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (res.status === 200) return true; // ショートのURLのまま表示された
    if (res.status >= 300 && res.status < 400) return false; // /watch?v=... へリダイレクトされた＝通常動画
    return null; // 403等、想定外の応答は判定失敗として扱う
  } catch (e) {
    return null;
  }
}

async function filterOutShorts(ids) {
  const CONCURRENCY = 10;
  const results = new Array(ids.length);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const i = next++;
      results[i] = await isShort(ids[i]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const regular = [];
  const shorts = [];
  const unknown = [];
  ids.forEach((id, i) => {
    if (results[i] === true) shorts.push(id);
    else if (results[i] === false) regular.push(id);
    else unknown.push(id);
  });
  return { regular, shorts, unknown };
}

async function getVideoDetails(accessToken, ids) {
  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await apiGet('videos', { part: 'snippet,contentDetails', id: batch.join(',') }, accessToken);
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

// YouTubeのpublishedAt（UTC）を日本時間の日付（YYYY-MM-DD）にする
function toJstDate(iso) {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
      duration: (item.contentDetails && item.contentDetails.duration) || '',
    };
  });
  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  for (const v of videos) v.publishedAt = toJstDate(v.publishedAt);
  return { videos, warnings };
}

function writeDataFile(videos) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(videos, null, 2) + '\n');
  console.log(`data/videos.json を更新しました（${videos.length}件）`);
}

function csvCell(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// YouTube Studioから読み取った著作権の申立（data/claims.json）。無ければ申立列は空にする
function loadClaims() {
  if (!fs.existsSync(CLAIMS_PATH)) return {};
  return JSON.parse(fs.readFileSync(CLAIMS_PATH, 'utf8')).videos || {};
}

// 申立が複数ある動画は、曲名・歌手名とも同じ順番で ' ; ' でつなぐ（歌手名が無い申立は空欄）
const CLAIM_SEPARATOR = ' ; ';

// 「〇〇行ってきた」などのスポット名と住所（data/spots.json）。無ければ空にする
function loadSpots() {
  if (!fs.existsSync(SPOTS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf8')).videos || {};
}

// 公開日（YYYY-MM-DD）時点の年齢を「〇歳〇ヶ月」で返す。誕生日より前の公開日は空文字
function calcAge(dateStr, birthday = CHILD_BIRTHDAY) {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
  if (months < 0) return '';
  return `${Math.floor(months / 12)}歳${months % 12}ヶ月`;
}

function placeOf(spot) {
  return spot ? `${spot.pref}${spot.city}` : '';
}

// 先頭にBOMを付け、Excel等でも日本語が文字化けしないようにする
function buildCsv(videos, claims = loadClaims(), spots = loadSpots()) {
  const header = ['id', 'title', 'cat', 'year', 'published', 'url', 'desc', '申立_曲名', '申立_歌手名', '年齢', 'スポット名', '住所'];
  const rows = videos.map(v => {
    const list = claims[v.id] || [];
    const spot = spots[v.id];
    return [
      v.id, v.title, v.cat, v.year, v.publishedAt, `https://www.youtube.com/watch?v=${v.id}`, v.desc,
      list.map(c => c.title).join(CLAIM_SEPARATOR),
      list.map(c => c.artist || '').join(CLAIM_SEPARATOR),
      calcAge(v.publishedAt),
      spot ? spot.spot : '',
      placeOf(spot),
    ].map(csvCell).join(',');
  });
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}

function writeCsvFile(videos) {
  fs.writeFileSync(CSV_PATH, buildCsv(videos));
  console.log(`data/videos.csv を更新しました（${videos.length}件）`);
}

// YouTubeの長さ（ISO 8601。例: PT1H2M3S）を「1:02:03」「12:34」にする。不明なら空文字
function formatDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return '';
  const [h, min, sec] = [m[1], m[2], m[3]].map(x => Number(x || 0));
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${String(min).padStart(2, '0')}:${ss}` : `${min}:${ss}`;
}

// 年齢・長さ・スポット名・住所は、あるものだけ末尾に足す（画面側は無ければ表示しない）
// チャット（worker/）がGeminiに渡す動画の一覧。説明は先頭60文字まで（Geminiへ渡す量を抑えるため）
function buildCatalog(videos, spots = loadSpots()) {
  return videos.map(v => {
    const spot = spots[v.id];
    return {
      id: v.id,
      title: v.title,
      cat: v.cat,
      date: v.publishedAt.slice(0, 7),
      age: calcAge(v.publishedAt),
      spot: spot ? spot.spot : '',
      place: placeOf(spot),
      desc: (v.desc || '').replace(/\s+/g, ' ').slice(0, 60),
    };
  });
}

function writeCatalogFile(videos) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(buildCatalog(videos), null, 2) + '\n');
  console.log(`worker/catalog.json を更新しました（${videos.length}件）`);
}

function formatEntry(v, spots = loadSpots()) {
  const esc = s => JSON.stringify(s);
  const extra = [];
  const age = calcAge(v.publishedAt);
  if (age) extra.push(`age:${esc(age)}`);
  const dur = formatDuration(v.duration);
  if (dur) extra.push(`dur:${esc(dur)}`);
  const spot = spots[v.id];
  if (spot) extra.push(`spot:${esc(spot.spot)}`, `place:${esc(placeOf(spot))}`);
  return `  { id:${esc(v.id)}, title:${esc(v.title)}, desc:${esc(v.desc)}, cat:${esc(v.cat)}, year:${v.year}${extra.length ? ', ' + extra.join(', ') : ''} },`;
}

function updateIndexHtml(videos) {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  const spots = loadSpots();
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`index.html に ${START_MARKER} / ${END_MARKER} マーカーが見つかりません`);
  }
  const block = [
    START_MARKER,
    'const VIDEOS = [',
    ...videos.map(v => formatEntry(v, spots)),
    '];',
    END_MARKER,
  ].join('\n');
  const updated = html.slice(0, startIdx) + block + html.slice(endIdx + END_MARKER.length);
  fs.writeFileSync(INDEX_PATH, updated);
  console.log('index.html の VIDEOS 配列を更新しました');
}

// 0本のまま書き込むと既存データが消えるため、何も書き込まずに終了する。
function failEmpty(reason) {
  throw new Error(`${reason}。data/ と index.html は更新していません。\n`
    + '  対処: .env の YOUTUBE_OAUTH_REFRESH_TOKEN を空にして再実行し、認証画面で正しいチャンネル（.env の YOUTUBE_CHANNEL_ID）を選んでください');
}

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);
  console.log('YouTube Data API から動画一覧を取得中...');
  const playlistId = await getMyUploadsPlaylistId(accessToken);
  const ids = await getAllVideoIds(accessToken, playlistId);
  console.log(`${ids.length}本のアップロードを検出（動画+ショート合計）`);
  // 認証時に別のチャンネルを選ぶと0本になり、data/ と index.html を空で上書きしてしまうため、ここで止める
  if (ids.length === 0) failEmpty('アップロードが0本でした。認証時に選んだチャンネルが違う可能性があります');

  console.log('ショート判定中...');
  const { regular, shorts, unknown } = await filterOutShorts(ids);
  console.log(`動画: ${regular.length}本 / ショート: ${shorts.length}本${unknown.length ? ` / 判定失敗: ${unknown.length}本` : ''}`);
  const targetIds = regular.concat(unknown);
  if (unknown.length) {
    console.warn(`⚠ 判定に失敗した${unknown.length}本は念のため「動画」として扱います:`);
    console.warn(unknown.map(id => `  - ${id}`).join('\n'));
  }

  const details = await getVideoDetails(accessToken, targetIds);
  const { videos, warnings } = buildVideos(details);
  if (videos.length === 0) failEmpty('掲載対象の動画が0本でした');

  writeDataFile(videos);
  writeCsvFile(videos);
  writeCatalogFile(videos);
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

module.exports = { toJstDate, calcAge, formatDuration, buildCatalog, buildCsv, formatEntry, updateIndexHtml, buildVideos, pickCategory };
