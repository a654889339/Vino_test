#!/usr/bin/env bash
# 删除当前 database 中「不在 Vino 白名单」内的所有表（与 common/config/db/vino.schema.yaml、
# backend/internal/db.ManagedModelEntities 一致）。
#
# 用法（在能连 MySQL 的机器上，例如腾讯云服务器）：
#   cd /home/ubuntu/Vino_test/scripts/mysql
#   export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=root MYSQL_PWD='...' MYSQL_DB=vino_db
#   bash drop_tables_outside_allowlist.sh --dry-run    # 仅打印将 DROP 的表
#   bash drop_tables_outside_allowlist.sh --execute    # 关闭外键检查后执行 DROP（不可逆）
#
# Docker 内连本机映射端口示例：
#   MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=root MYSQL_PWD=vino_secret_2024 MYSQL_DB=vino_db \
#     bash drop_tables_outside_allowlist.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="${SCRIPT_DIR}/vino_table_allowlist.txt"
MODE="${1:-}"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DB="${MYSQL_DB:-vino_db}"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "missing allowlist: $ALLOWLIST" >&2
  exit 1
fi

if [[ "$MODE" != "--dry-run" && "$MODE" != "--execute" ]]; then
  echo "usage: $0 --dry-run | --execute" >&2
  exit 1
fi

mapfile -t KEEP < <(grep -v '^[[:space:]]*$' "$ALLOWLIST" | grep -v '^#' || true)
if [[ ${#KEEP[@]} -eq 0 ]]; then
  echo "allowlist is empty" >&2
  exit 1
fi

in_sql=""
for t in "${KEEP[@]}"; do
  t="${t//$'\r'/}"
  [[ -z "$t" ]] && continue
  in_sql+="'${t//\'/\\\'}',"
done
in_sql="${in_sql%,}"

mysql_cli=(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DB")
mysql_rows=(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DB" -N -B)
if [[ -n "${MYSQL_PWD:-}" ]]; then
  export MYSQL_PWD
fi

drops="$("${mysql_rows[@]}" -e "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN ($in_sql)
ORDER BY table_name;
" || true)"

if [[ -z "${drops//[$'\t\r\n ']/}" ]]; then
  echo "No tables outside allowlist. Nothing to do."
  exit 0
fi

echo "=== Tables outside Vino allowlist (will be DROPped on --execute) ==="
echo "$drops"
echo "=== End list ==="

if [[ "$MODE" == "--dry-run" ]]; then
  echo "Dry-run only. Re-run with --execute after backup to apply."
  exit 0
fi

read -r -p "Type YES to DROP these tables from database '${MYSQL_DB}': " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "Aborted."
  exit 1
fi

tmpf="$(mktemp)"
{
  echo "SET FOREIGN_KEY_CHECKS = 0;"
  while IFS= read -r tbl; do
    [[ -z "${tbl//[$'\t\r\n ']/}" ]] && continue
    printf 'DROP TABLE IF EXISTS `%s`;\n' "${tbl//\`/\`\`}"
  done <<< "$drops"
  echo "SET FOREIGN_KEY_CHECKS = 1;"
} >"$tmpf"

"${mysql_cli[@]}" <"$tmpf"
rm -f "$tmpf"
echo "Done."
