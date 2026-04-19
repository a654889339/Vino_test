#!/usr/bin/env bash
# Vino MySQL 逻辑全量备份：docker exec mysqldump -> gzip -> 腾讯云 COS（对象键 db_save/YYYY-MM/DD.sql.gz）
# 依赖：宿主机 docker；腾讯云 coscli（https://cloud.tencent.com/document/product/436/63144）
# 用法：
#   ./scripts/db_backup_to_cos.sh
#   ./scripts/db_backup_to_cos.sh /path/to/.env
set -euo pipefail

export TZ=Asia/Shanghai

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/.env}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-vino-mysql}"
COSCLI_BIN="${COSCLI:-coscli}"

COS_BUCKET="${COS_BUCKET:-itsyourturnmy-1256887166}"
COS_ENDPOINT="${COS_ENDPOINT:-https://cos.ap-singapore.myqcloud.com}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[db-backup] 未找到 .env: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_NAME="${DB_NAME:-vino_db}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
COS_SECRET_ID="${COS_SECRET_ID:-}"
COS_SECRET_KEY="${COS_SECRET_KEY:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "[db-backup] .env 中 DB_PASSWORD 为空" >&2
  exit 1
fi
if [[ -z "$COS_SECRET_ID" || -z "$COS_SECRET_KEY" ]]; then
  echo "[db-backup] COS_SECRET_ID / COS_SECRET_KEY 未配置，跳过上传" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[db-backup] 未找到 docker 命令" >&2
  exit 1
fi
if ! command -v "$COSCLI_BIN" >/dev/null 2>&1; then
  echo "[db-backup] 未找到 coscli（可设置 COSCLI=/path/to/coscli），安装见 https://cloud.tencent.com/document/product/436/63144" >&2
  exit 1
fi

ym="$(date +%Y-%m)"
dd="$(date +%d)"
cos_key="db_save/${ym}/${dd}.sql.gz"
tmp="$(mktemp "${TMPDIR:-/tmp}/vino_dump.XXXXXX.sql.gz")"

cleanup() { rm -f "$tmp" 2>/dev/null || true; }
trap cleanup EXIT

echo "[db-backup] $(date -Is) 开始导出 ${DB_NAME} -> ${tmp}"

docker exec -e MYSQL_PWD="$DB_PASSWORD" "$MYSQL_CONTAINER" \
  mysqldump -u"$DB_USER" \
  --single-transaction \
  --routines \
  --events \
  --databases "$DB_NAME" \
  | gzip -c >"$tmp"

if [[ ! -s "$tmp" ]]; then
  echo "[db-backup] 导出文件为空，中止" >&2
  exit 1
fi

echo "[db-backup] $(date -Is) 上传 cos://${COS_BUCKET}/${cos_key}"

"$COSCLI_BIN" cp "$tmp" "cos://${COS_BUCKET}/${cos_key}" \
  -e "$COS_ENDPOINT" \
  -i "$COS_SECRET_ID" \
  -k "$COS_SECRET_KEY"

echo "[db-backup] $(date -Is) 完成"
