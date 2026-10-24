// Writes what I've been playing on Steam to stdout as JSON. Run every few minutes by
// .github/workflows/steam.yml, which publishes the result to the `live` branch so the site
// can read it. The API key stays in GitHub's secrets and never reaches the website.
//
// Needs STEAM_KEY (secret) and STEAM_ID (17 digits) in the environment.
const key = process.env.STEAM_KEY;
const id = process.env.STEAM_ID;
if (!key || !id) {
  console.error('STEAM_KEY and STEAM_ID are needed.');
  process.exit(1);
}
const api = 'https://api.steampowered.com';
const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${res.status} from Steam`);
  return res.json();
};
const list = (v) => (Array.isArray(v) ? v : []);
const art = (appid) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
const q = `key=${encodeURIComponent(key)}`;

const [summary, recent, owned] = await Promise.all([
  getJson(`${api}/ISteamUser/GetPlayerSummaries/v2/?${q}&steamids=${encodeURIComponent(id)}`),
  getJson(`${api}/IPlayerService/GetRecentlyPlayedGames/v1/?${q}&steamid=${encodeURIComponent(id)}&count=8`),
  // Only used for "last played" times; fine to do without.
  getJson(`${api}/IPlayerService/GetOwnedGames/v1/?${q}&steamid=${encodeURIComponent(id)}&include_appinfo=0&include_played_free_games=1`).catch(() => null),
]);
const player = list(summary?.response?.players)[0] || {};
const last = new Map(list(owned?.response?.games).map((g) => [g.appid, g.rtime_last_played || 0]));
const games = list(recent?.response?.games)
  .map((g) => ({
    appid: g.appid,
    name: g.name,
    minutes2w: g.playtime_2weeks || 0,
    minutesTotal: g.playtime_forever || 0,
    lastPlayed: last.get(g.appid) || null,
    art: art(g.appid),
  }))
  .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || b.minutes2w - a.minutes2w);
const appid = Number(player.gameid) || null;
const steam = {
  online: (player.personastate || 0) > 0,
  playing: player.gameextrainfo ? { appid, name: player.gameextrainfo, art: appid ? art(appid) : null } : null,
  games,
};
process.stdout.write(JSON.stringify({ updated: new Date().toISOString(), steam }, null, 1) + '\n');
