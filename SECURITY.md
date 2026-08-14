# Security

FrameEvidence is read-only, but it processes credentials and design metadata inside the host process.

- Never paste a Figma token into a model prompt or tool argument. Supply it through the configured environment variable only.
- Use a dedicated, least-privileged token with `file_content:read` scope and access only to required files.
- Requests are fixed to `https://api.figma.com/v1`; redirects, non-HTTPS source URLs, URL credentials, oversized responses, and unsafe render URLs are rejected.
- Returned node evidence and temporary render URLs may be visible to the model and stored by the surrounding harness. Do not inspect a file whose metadata must not enter that session.
- A plugin runs with the host user's authority. FrameEvidence cannot stop the host process, another same-user process, or another plugin from reading environment variables.

For a possible vulnerability, open a minimal GitHub issue without tokens, private file URLs, client data, screenshots, or exploit secrets.
