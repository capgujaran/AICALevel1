# Host the Compass chatbot gateway

The GitHub Pages frontend includes the chat panel and retrieval preview. A separate Node server performs the Compass model call. The provider credential must never be copied into a Pages asset, committed into Git, entered in the browser, or supplied as a frontend build variable.

## Environment on the gateway host

Configure these through the hosting provider's secrets/settings:

| Variable | Value |
| --- | --- |
| `KUST_PROD_KUIAA` | Existing Compass API credential, server secret |
| `COMPASS_MODELS` | Existing comma-separated configured chat model names |
| `AICA_COMPASS_MODEL` | Optional API model ID from that configured list; otherwise the first model is used |
| `AICA_GATEWAY_MODE` | `hosted` |
| `AICA_GATEWAY_TOKEN` | Random access token of at least 32 characters, shared only with authorized demo users |
| `AICA_ALLOWED_ORIGINS` | `https://capgujaran.github.io` |
| `PORT` | Hosting provider's HTTP port; otherwise `AICA_CHAT_PORT` defaults to 8781 |

The origin is the scheme and host only, not the Pages repository path. Hosted mode refuses startup without authentication or with HTTP frontend origins. The shared-token arrangement is for a controlled demo; an organizational deployment should replace it with identity-backed access and quota management.

## Start command

From the repository root, with Node 22.8 or later:

```sh
node AICA/p2p-audit/gateway/compass.mjs
```

Or build the provided image from the repository root:

```sh
docker build -f AICA/p2p-audit/deployment/compass.Dockerfile -t aica-compass .
```

Use a hosting service supporting a long-running Node HTTP process or container. Put the service behind the host's HTTPS termination. `/health` is the health-check path; `/chat` accepts authenticated POST requests. The Docker image copies only the gateway and static tool modules, not local `.env` files or course material. The process binds to all container interfaces in hosted mode and to loopback in local mode.

## Connect the deployed frontend

After hosting, enter the resulting `https://your-host/chat` URL and gateway access token in the chatbot's **Connection** section. Values remain in tab memory. Alternatively set only the public gateway URL in `AICA/p2p-audit/site/chat-config.json` and push to `main` to preconfigure the URL for users. Do not put a token or provider credential in that JSON. Users still enter their gateway access token.

The chatbot can answer tool questions using the curated guide. To ask about results, run the audit and select **Allow retrieved audit-result summaries to be sent to Compass for this run**. Preview the excerpts before asking. Questions and edited narratives may contain sensitive information even when identifiers and raw records are omitted by the initial summary builder.

## Local use with the existing KU `.env`

The original project copy automatically reads only the Compass credential/model settings from the KU workspace `.env` into server memory. It does not print or copy credentials. If running from the clean published checkout, set `AICA_ENV_FILE` to the existing KU `.env` path locally, or set the Compass variables directly. Start with `npm run compass` from `AICA/p2p-audit`. The local chatbot defaults to `http://127.0.0.1:8781/chat` and permits the original localhost frontend on port 8773; `AICA_ALLOWED_ORIGINS` can specify another exact local origin. No gateway token is required in loopback-only local mode unless one is configured.

## Retrieval and limits

The browser uses BM25-style keyword retrieval with audit vocabulary aliases over the tool guide and current-run summaries. It sends only selected run excerpts, not entire extracts. The server retrieves the guide again from its own trusted corpus, supplies excerpts as untrusted data to Compass, and validates the answer's citation IDs and numeric values against its cited sources. Source cards open the corresponding workspace or finding locally. These checks prevent unsupported references and new numeric tokens; they do not guarantee semantic accuracy.

Chat is read-only, bounded to one provider call per question, with no automatic retries or provider fallback. Context changes cancel pending requests and clear the conversation. Server context is request-local with no transcript persistence. Global calls are limited to 100 per hour per process, address calls to 30, with at most three concurrent requests. Limits are in-memory and reset on process restart; use shared quotas and authenticated user limits for a production service. CORS does not replace authentication. Provider processing/retention depends on your Compass agreement; this implementation does not claim zero retention.

API contract verified against [Core42 Compass API reference](https://www.core42.ai/compass/documentation/compass-api-reference) and [chat completion documentation](https://www.core42.ai/compass/documentation/chat-completion).
