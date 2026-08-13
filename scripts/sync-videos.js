#!/usr/bin/env node
// YouTube Data API から動画一覧を取得し、data/videos.json と
// index.html の VIDEOS 配列（AUTO-GENERATED:VIDEOS-START〜END の間）を更新する。
// 実行方法: node scripts/sync-videos.js
// 事前準備: リポジトリ直下に .env を作成し、YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID を設定しておく。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const DATA_PATH = path.join(ROOT, 'data', 'videos.json');
const INDEX_PATH = path.join(ROOT, 'index.html');
const START_MARKER = '// AUTO-GENERATED:VIDEOS-START';
const END_MARKER = '// AUTO-GENERATED:VIDEOS-END';

// タグ欄から抽出するカテゴリー（index.html の CATS と一致させる）
const CATEGORIES = ['おでかけ', '保育園', 'プール', '旅行', '体験', 'おもいで'];
const UNCATEGORIZED = '未分類';

function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) {
    console.error('.env に YOUTUBE_API_KEY と YOUTUBE_CHANNEL_ID を設定してください（.env.example 参照）');
    process.exit(1);
  }
  return { apiKey, channelId };
}

async function apiGet(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${endpoint}): ${res.status} ${body}`);
  }
  return res.json();
}

async function getUploadsPlaylistId(apiKey, channelId) {
  const data = await apiGet('channels', {
    part: 'snippet,contentDetails',
    id: channelId,
    key: apiKey,
  });
  const channel = data.items && data.items[0];
  if (!channel) {
    throw new Error(
      `チャンネルが見つかりません: ${channelId}\n` +
      'YOUTUBE_CHANNEL_ID には「UC」で始まるチャンネルID（ハンドル名 @xxx や カスタムURLではない）を設定してください。'
    );
  }
  console.log(`チャンネル: ${channel.snippet.title} (${channelId})`);
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists && channel.contentDetails.relatedPlaylists.uploads;
  if (!uploadsPlaylistId) {
    throw new Error(`このチャンネルにはアップロード用プレイリストが見つかりませんでした: ${channelId}`);
  }
  console.log(`アップロード用プレイリストID: ${uploadsPlaylistId}`);
  return uploadsPlaylistId;
}

async function getAllVideoIds(apiKey, playlistId) {
  const ids = [];
  let pageToken = '';
  do {
    const data = await apiGet('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
      key: apiKey,
    });
    for (const item of data.items) ids.push(item.contentDetails.videoId);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return ids;
}

async function getVideoDetails(apiKey, ids) {
  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await apiGet('videos', {
      part: 'snippet',
      id: batch.join(','),
      key: apiKey,
    });
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
  const { apiKey, channelId } = loadEnv();
  console.log('YouTube Data API から動画一覧を取得中...');
  const playlistId = await getUploadsPlaylistId(apiKey, channelId);
  const ids = await getAllVideoIds(apiKey, playlistId);
  console.log(`${ids.length}本の動画を検出`);
  const details = await getVideoDetails(apiKey, ids);
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
