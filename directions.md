# DIRECTIONS — Build v2 of Domain‑to‑Biz (Full‑Site Generator)

> **Target stack** · Next.js (builder dashboard) · FastHTML/htmx (generated sites)  
> **Infra** · Vercel (UX) · Supabase (Postgres + Queues + Storage) · Fly.io workers  
> **Payments** · Stripe Checkout  
> Queue‑first architecture (no timeouts)

---

## 0. Prerequisites

1. **Tools**

   ```bash
   brew install supabase flyctl
   npm install -g pnpm
   ```

2. **Secrets** – add to your local `.env` **and** Vercel/Fly envs

   ```env
   SUPABASE_URL=…
   SUPABASE_SERVICE_ROLE_KEY=…
   FLY_API_TOKEN=…
   STRIPE_SECRET_KEY=…
   VERCEL_DEPLOY_HOOK_URL=…
   ```

---

## 1. Branch and clean‑up

```bash
git checkout -b feat/async-generator
pnpm install
```

---

## 2. Add Supabase Queues

1. **Enable the extension**

   ```sql
   create extension if not exists supabase_queues;
   ```

2. **Create a queue and enqueue payload**

   ```sql
   select queues.enqueue(
     queue   => 'site_jobs',
     payload => json_build_object(
       'site_id', :site_id,
       'domain',  :domain
     )
   );
   ```

🔹 **Ask Claude ►**  
*Generate TypeScript Supabase client code that enqueues into `site_jobs` and returns the job ID.*

---

## 3. Convert the `/api/submit` route to **enqueue‑only**

```ts
export const POST = async (req: Request) => {
  const { domain } = await req.json();
  const { data: job } = await supabase.rpc(
    'enqueue_site_generation',
    { domain }
  );
  return Response.json({ jobId: job.id }, { status: 202 });
};
```

---

## 4. Worker skeleton (FastAPI + LangGraph)

```bash
mkdir worker && cd worker
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn supabase langgraph openai
```

Create `worker/main.py`:

```python
from supabase import create_client
from langgraph import Graph
# init …
def process_job(job):
    # 1. call agents → site.json
    # 2. render templates
    # 3. upload to Storage or push to Git
    # 4. POST to Vercel hook
```

🔹 **Ask Claude ►**  
*Fill in `process_job` so it downloads the queue payload, calls OpenAI to draft `site.json`, renders Jinja templates in `templates/htmx/`, uploads them to Supabase Storage, and triggers the Vercel Deploy Hook.*

---

## 5. Containerise & deploy the worker

`worker/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install -r requirements.txt
CMD ["python", "poller.py"]
```

```bash
fly launch --name domaintobiz-worker --dockerfile worker/Dockerfile
fly scale count 1
```

---

## 6. htmx / FastHTML site templates

```
templates/
  htmx/
    index.html.jinja
    pricing.html.jinja
    waitlist.html.jinja
    dashboard.html.jinja
    partials/
      navbar.html.jinja
      footer.html.jinja
```

Structure expected in `site.json`:

```json5
{
  "brand": { "name": "", "primaryColor": "" },
  "pages": [
    { "slug": "/",          "template": "index"     },
    { "slug": "/pricing",   "template": "pricing"   },
    { "slug": "/waitlist",  "template": "waitlist"  },
    { "slug": "/dashboard", "template": "dashboard" }
  ],
  "modules": {
    "waitlist": true,
    "stripePaywall": true
  }
}
```

🔹 **Ask Claude ►**  
*Create Jinja templates for the pages above using htmx for forms (`hx-post`, `hx-swap="outerHTML"`).*

---

## 7. Add common modules

| Module | File | Endpoint |
| ------ | ---- | -------- |
| **Wait‑list** | `templates/htmx/waitlist.html.jinja` | `/api/waitlist` (Edge) |
| **Stripe Paywall** | `<button hx-post="/api/pay">` | `/api/pay` (Edge) |

`/api/pay` sample:

```ts
import Stripe from 'stripe';
export const POST = async (req: Request) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: \`\${origin}/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url:  \`\${origin}/cancel\`
    // +price_id etc.
  });
  return Response.redirect(session.url!, 303);
};
```

🔹 **Ask Claude ►**  
*Add a Stripe webhook handler (`/api/stripe/webhook`) that flips `sites.paid = true` after `checkout.session.completed` and triggers a redeploy.*

---

## 8. Realtime progress UI

```ts
supabase.channel('public:site_jobs')
  .on('postgres_changes', { 
       event: 'UPDATE',
       schema: 'public',
       table: 'site_jobs',
       filter: `id=eq.\${jobId}` },
       payload => setProgress(payload.new.status))
  .subscribe();
```

Render a progress bar and swap to “Visit your site” when `status === "completed"`.

---

## 9. “Export to GitHub” premium flow (optional)

* Worker flag `"export": true`
* Use GitHub REST API to create repo and push rendered code
* Fire user‑provided Vercel Deploy Hook

🔹 **Ask Claude ►**  
*Generate Python code that accepts a `github_access_token`, creates a new private repo with the rendered site, and returns the `html_url`.*

---

## 10. Pricing & plan logic

| Plan | Free | Starter | Pro |
|------|------|---------|-----|
| Ideas preview | ✓ | ✓ | ✓ |
| Deploy sites  | ✗ | 2 /mo | 10 /mo |
| Re‑generate   | ✗ | ✓ | ✓ |
| Export to Git | ✗ | ✗ | ✓ |

Store quotas in `plans` table; enforce in Edge route **before** enqueueing.

---

## 11. Ship it

```bash
git add .
git commit -m "Async generator, htmx templates, Stripe paywall"
git push origin feat/async-generator
```

Create a PR, merge, and **celebrate** 🎉

---

## 12. Post‑launch TODOs

* Usage billing for OpenAI tokens  
* Custom domain connection wizard  
* Email onboarding sequence via Resend  
* “Clone & edit in VS Code Web” button

---

### How to work with this file in Cursor

1. Save it as **`DIRECTIONS.md`**.  
2. Open it; when you see a **🔹 Ask Claude ►** line, highlight the whole prompt and hit **⌘ K** (or right‑click → *Ask Claude*) to let Sonnet 4.0 generate the snippet.  
3. Copy the generated code into the indicated file, adjust if needed, and commit.

Happy building!
