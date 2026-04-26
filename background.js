// background.js — Service Worker
// Handles all OMDb API fetches so content scripts avoid CORS issues.

const OMDB_API_KEY = "649dca9d";
const OMDB_BASE    = "https://www.omdbapi.com/";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache (survives for the browser session; chrome.storage for cross-session)
const memCache = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_RATING") {
    handleGetRating(message.title, message.year)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    // Return true to keep the message channel open for async response
    return true;
  }
});

async function handleGetRating(title, year) {
  if (!title) throw new Error("No title provided");

  const cacheKey = normalise(title) + (year ? `_${year}` : "");

  // 1. Check in-memory cache
  if (memCache[cacheKey] && Date.now() - memCache[cacheKey].ts < CACHE_TTL_MS) {
    console.log(`[IMDB Ext] Cache hit (memory): ${title}`);
    return memCache[cacheKey].data;
  }

  // 2. Check chrome.storage cache
  const stored = await chromeStorageGet(cacheKey);
  if (stored && Date.now() - stored.ts < CACHE_TTL_MS) {
    console.log(`[IMDB Ext] Cache hit (storage): ${title}`);
    memCache[cacheKey] = stored;
    return stored.data;
  }

  // 3. Fetch from OMDb
  console.log(`[IMDB Ext] Fetching OMDb for: ${title}`);
  const baseParams = { apikey: OMDB_API_KEY, t: title, ...(year ? { y: year } : {}) };

  // Fetch movie and series in parallel — pick winner by vote count (more votes = more famous = right match)
  const [movieResult, seriesResult] = await Promise.all([
    fetchOMDb(new URLSearchParams({ ...baseParams, type: "movie" })).catch(() => null),
    fetchOMDb(new URLSearchParams({ ...baseParams, type: "series" })).catch(() => null),
  ]);

  const candidates = [movieResult, seriesResult].filter(r => r && r.Response !== "False");
  if (candidates.length === 0) throw new Error(`Not found on OMDb: "${title}"`);

  const parseVotes = r => parseInt((r.imdbVotes || "0").replace(/,/g, "")) || 0;
  const result = candidates.sort((a, b) => parseVotes(b) - parseVotes(a))[0];


  const data = {
    title:    result.Title,
    year:     result.Year,
    rating:   result.imdbRating,
    votes:    result.imdbVotes,
    genre:    result.Genre,
    runtime:  result.Runtime,
    plot:     result.Plot,
    poster:   result.Poster,
    type:     result.Type,
    imdbId:   result.imdbID
  };

  // Store in both caches
  const entry = { data, ts: Date.now() };
  memCache[cacheKey] = entry;
  await chromeStorageSet(cacheKey, entry);

  return data;
}

async function fetchOMDb(params) {
  const url = `${OMDB_BASE}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMDb HTTP error ${res.status}`);
  return res.json();
}

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// chrome.storage promise wrappers
function chromeStorageGet(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve(result[key] || null));
  });
}

function chromeStorageSet(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}
