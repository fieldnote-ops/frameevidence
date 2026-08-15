# FrameEvidence

[![Self-test](https://github.com/fieldnote-ops/frameevidence/actions/workflows/self-test.yml/badge.svg?branch=main)](https://github.com/fieldnote-ops/frameevidence/actions/workflows/self-test.yml)

**Bounded, read-only design evidence for agent harnesses.** FrameEvidence lets an agent inspect layout, typography, paints, component references, and variable bindings through the Figma REST API before it writes code. Version 0.1 is packaged as a plugin for DeepSeek Harness.

FrameEvidence is deliberately read-only. Version 0.1 provides two tools:

- `figma_inspect` returns a bounded, implementation-focused node tree instead of dumping Figma's full JSON schema into the model context.
- `figma_render` returns a temporary PNG, JPG, SVG, or PDF render URL for one node.

## Evidence at a glance

| Surface | Current boundary |
| --- | --- |
| Figma access | Read-only REST requests to `https://api.figma.com/v1`; redirects are rejected and no tool writes to Figma. |
| Credential handling | The PAT is read from a named host environment variable, never accepted as a model tool argument, and never returned in tool or probe output. |
| Context control | Raw responses are byte-capped; depth and returned node count are bounded before design evidence reaches the model. |
| Maintainer infrastructure | No maintainer server, analytics, telemetry, OAuth broker, or credential store is involved. |
| Verified today | 15 credential-free tests and clean-profile DSH rc.6/`latest`/`next` consumers pass. A real Figma file has **not** yet completed the opt-in probe. |

## Install

Install the repository into the Web profile:

```sh
dsh plugin --profile web add github:fieldnote-ops/frameevidence#97f67c9a049a26c9e8b38e7e764d2572897a6429
```

The full commit above is the last publicly verified runtime revision. Inspect `main` for ongoing development, but pin a reviewed commit when a real design token is in scope.

Set a Figma personal access token with the `file_content:read` scope before starting DSH:

```sh
export FIGMA_ACCESS_TOKEN='...'
npx @deepseek-ai/dsh web
```

Then give the agent a Figma file or node URL and ask it to inspect the design before implementation.

## Opt-in live API probe

To close the real-API evidence gap without sending data to a maintainer, clone this repository, run `npm ci --ignore-scripts --registry=https://registry.npmjs.org`, and inject `FIGMA_ACCESS_TOKEN` plus a caller-selected node URL as `FRAMEEVIDENCE_URL` through the process environment. Then run:

```sh
npm run live:smoke
```

The probe is never automatic. It executes both `figma_inspect` and `figma_render`, then creates a new `0600` `frameevidence-live-smoke.json`. It refuses to overwrite prior evidence and records no token, design URL, file key, node id, node name, raw API response, or temporary render URL.

## Security and data boundary

- The token is read only from the host environment. It is never accepted as a model tool argument and is never returned in output.
- Requests go only to `https://api.figma.com/v1` and redirects are rejected.
- The plugin is read-only and requests only Figma file/node JSON or rendered assets.
- Responses have a byte cap, node trees have a node cap, and successful reads are cached in memory to reduce rate-limit pressure.
- Figma render URLs are temporary and should not be treated as durable storage.
- The project has no maintainer-operated server, analytics, or telemetry. See [PRIVACY.md](./PRIVACY.md) and [SECURITY.md](./SECURITY.md).

## Figma plan limitations

Figma's REST rate limits depend on seat and plan. Viewer/Collab seats can have very low Tier 1 quotas; Dev/Full seats receive per-minute quotas. The Variables REST API is Enterprise-only, so v0.1 preserves bound variable ids but does not fetch variable values.

## Configuration

| Key | Default | Meaning |
| --- | ---: | --- |
| `tokenEnv` | `FIGMA_ACCESS_TOKEN` | Host environment variable containing the PAT |
| `defaultDepth` | `4` | Default Figma subtree depth |
| `maxDepth` | `8` | Maximum model-requestable depth |
| `maxNodes` | `300` | Maximum nodes returned to the model |
| `timeoutMs` | `30000` | HTTP timeout |
| `maxResponseBytes` | `8388608` | Raw API response cap |
| `cacheTtlMs` | `300000` | In-memory GET cache duration |

## Development

```sh
npm install
npm run check
```

## Non-goals for v0.1

- Writing to Figma
- OAuth or multi-user token storage
- Full design-to-code generation
- Claiming pixel-perfect implementation without browser comparison
- Fetching Enterprise Variables values

MIT licensed.

## Project status

FIELD NOTE built FrameEvidence as an AI-assisted, human-reviewed interoperability experiment. Unit tests use synthetic Figma API responses, and the release workflow uses HarnessProof to install the plugin's locked dependencies in an isolated copy before checking clean-profile composition and Web boot across DSH rc.6, `latest`, and experimental `next`, all without a Figma credential. An opt-in, credential-safe live probe is available but has not yet been executed against a real Figma file; Marketplace acceptance also remains unverified. There is no independent-user adoption, purchase validation, or income yet.

FrameEvidence is an independent open-source project. It is not affiliated with, sponsored by, or endorsed by Figma, Inc. or DeepSeek. Figma and DeepSeek names are used only to identify compatibility with their respective products and services.
