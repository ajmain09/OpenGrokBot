# OpenGrokBot — Workspace Automation & Safety Rules

## Trusted Operations
Within this OpenGrokBot workspace, the following operations are pre-reviewed and trusted:
1. **Safe File Operations**:
   - Reading project files and listing project directories.
   - Searching source code (`grep`, `glob`, text search).
   - Reading non-secret configuration files (`team.json`, `package.json`, `tsconfig*.json`).
   - Creating and editing source files in `client/`, `server/`, `shared/`, `scripts/`, `desktop/`.
   - Creating and updating output files in `Documents/OpenGrokBot/Outputs` and `data/`.
2. **Safe Terminal Commands**:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `node scripts/build-verify.js`
   - `git status`
   - `git log`
   - `git diff`
3. **Browser Automation**:
   - Research navigation, public business searches, read-only inspection using dedicated profile `lead-hunt`.
   - Read-only review using dedicated profile `marketing`.

## Approval-Gated Protected Operations
Stop and require explicit confirmation for:
1. Destructive deletion of files outside temporary/scratch dirs.
2. Direct sending of outbound WhatsApp, email, or social media messages.
3. Accessing, logging, or exposing user credentials, tokens, or private secrets.
4. Unrestricted shell commands outside reviewed project scripts.
