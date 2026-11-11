// A tiny Cloudflare Worker that starts the "Steam and Last.fm" GitHub Action every ten minutes.
//
// The Action is scheduled to run every ten minutes on its own, but GitHub treats schedules as
// best effort and in practice runs it every few hours. Starting it by hand (a
// "workflow_dispatch") isn't delayed like that, and Cloudflare's Cron Triggers do run on time,
// so this worker asks GitHub to start it on each tick. The Steam key stays in GitHub; all this
// worker holds is a GitHub token that can only start Actions on this one repository.
//
// Settings (Workers > this worker > Settings):
//   GITHUB_TOKEN  secret: a fine-grained GitHub token for this repository, with
//                 "Actions: Read and write" and nothing else
//   REPO          optional, defaults to celarry/personalwebsite
//   BRANCH        optional, defaults to main
// The schedule itself is in wrangler.toml, or under Settings > Trigger Events in the dashboard.

const WORKFLOW = 'steam.yml';

async function start(env) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const repo = env.REPO || 'celarry/personalwebsite';
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lawrenceqi.com recorder tick',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.BRANCH || 'main' }),
  });
  // GitHub answers 204 with no body when the run has been queued.
  if (res.status !== 204) throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      start(env).catch((err) => {
        // Shows up under the worker's Logs in the Cloudflare dashboard.
        console.error(`Couldn't start the recorder: ${err.message}`);
        throw err;
      })
    );
  },
  // Visiting the worker's address does nothing but say what it is, so nobody can use it to
  // start runs.
  async fetch() {
    return new Response('This worker starts the Steam and Last.fm recorder for lawrenceqi.com every ten minutes.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
