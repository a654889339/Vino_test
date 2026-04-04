# AGENTS.md

## Repository Rules
- Treat `backend/` as the active backend. Do not modify `backend-node/` unless the task explicitly targets the legacy Node implementation.
- Before editing, read the closest docs and current implementation. Follow existing patterns rather than introducing a new structure by default.
- For cross-surface work, check whether the change affects `frontend/`, `frontend_outlet/`, `wechat-mp/`, `alipay-mp/`, and `backend/`.
- Do not change secrets, server addresses, certificates, deployment credentials, or private IDE config unless the task is explicitly about environment or deployment changes.
- Prefer small, bounded changes. If a task spans multiple modules or is ambiguous, produce a plan before editing.
- Do not modify generated artifacts or local-only files unless the user explicitly asks. Treat `project.private.config.json`, local caches, and test output as noise by default.
- When the task touches API behavior, verify the live implementation in `backend/` instead of relying on README or historical docs.
- Final responses must include verification status. If something was not run or could not be validated, say so explicitly.

## Working Conventions
- Use existing request/response conventions. This repository expects API success payloads with `code === 0`.
- Preserve backward compatibility for shared APIs unless the task explicitly allows a breaking change.
- For deployment-related tasks, inspect `docker-compose.yaml`, `deploy/`, and the relevant Dockerfile or nginx config before editing.
- For reviews, prioritize bugs, regressions, missing validation, and test gaps over style commentary.

## Directory Notes
- `backend/`: active Go backend used by Docker Compose.
- `backend-node/`: legacy or transitional Node backend; not the default runtime target.
- `frontend/`: main end-user H5.
- `frontend_outlet/`: outlet/service-provider H5.
- `wechat-mp/`: WeChat mini program.
- `alipay-mp/`: Alipay mini program.
