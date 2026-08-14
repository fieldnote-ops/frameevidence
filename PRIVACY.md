# Privacy

FrameEvidence has no maintainer-operated server, account system, analytics, telemetry, cookies, or data collection endpoint.

- The plugin reads the personal access token only from the configured host environment variable.
- Requests go directly from the machine running DeepSeek Harness to the official Figma REST API over HTTPS.
- Successful JSON responses may remain in process memory for the configured cache period and are discarded when the process exits.
- Tool results, including temporary render URLs and bounded node evidence, become part of the surrounding harness session and are subject to that harness's storage and logging policy.
- The maintainer does not receive the token, file URL, file contents, render URL, or tool result through this project.

Only use FrameEvidence with files you are authorized to access, and give the token the minimum `file_content:read` scope required.
