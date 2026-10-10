# AICA Level 1 · Purchase-to-Payment Audit Lab

**[Open the audit tool](https://capgujaran.github.io/AICALevel1/)**

A Day 3 group-project prototype using the AICA course's navy and magenta palette. Explore a synthetic purchase-to-payment population, run evidence-linked audit controls and prepare a human-reviewed workpaper.

- Four evidence extracts: invoices, purchase orders, goods receipts and payments.
- Seven deterministic controls with specialist tool agents and a visible execution trace.
- Five seeded demo exceptions, linked source rows and named reviewer decisions.
- Draft and accepted-findings HTML reports, decisions CSV and evidence JSON exports.
- A six-minute, four-presenter demonstration guide.
- A Compass RAG chatbot with retrieved guide/run excerpts, source citations and links back to the findings.

The core workflow runs in the browser without an API key. Uploaded extracts stay in tab memory, and reload clears the workspace. Optional model drafting needs a separately hosted, approved gateway; each request previews the exact summary before sending. Do not enter provider API keys in this public frontend.

**Compass chat:** the interface is included on the public site. Public model answers require a separately hosted Compass gateway; its URL is initially unconfigured. See [Compass hosting instructions](AICA/p2p-audit/deployment/compass-hosting.md) and the supplied Dockerfile. The local gateway can use the existing KU Compass configuration. Provider credentials stay server-side; users enter only a gateway access token. Opt in to send retrieved result summaries for the current run, inspect the excerpts and ask your question. Conversations reset when the audit context changes.

## Use the demo

1. Open the tool and select **Run audit**.
2. Open **Exceptions** to inspect source records and narratives.
3. Record a reviewer name, decision and supporting basis.
4. Open **Review & report** to download the workpaper.

Synthetic demonstration: 30 invoice records, AED 48,000 invoice value, five exceptions and AED 8,850 distinct affected invoice value. Exceptions require investigation; flagged value is not a confirmed loss.

## Develop locally

Requires Node.js 22.8 or later. No package installation is required.

```sh
cd AICA/p2p-audit
npm test
npm run serve
```

Open `http://127.0.0.1:8773`. `npm run build` generates the static site in `dist/`.

## Deployment

The `.github/workflows/aica-pages.yml` workflow tests, builds and deploys on pushes to `main` or manual dispatch. It publishes only `AICA/p2p-audit/dist`. The KU repository, AICA course originals and imported working evidence are excluded. GitHub Pages hosts the frontend; the optional AI gateway needs separate hosting.

See the [application guide](AICA/p2p-audit/README.md) for schemas, agent roles, limitations and gateway configuration, and the [validation record](AICA/p2p-audit/VALIDATION.md) for test coverage and remaining browser checks.

This is an AICA-themed learning prototype inspired by KU Internal Audit workflows. The project mark is an original illustration, not an official ICAI logo.
