#!/usr/bin/env bash
# Liga o Radarr/Sonarr ao Streamflix: descobre as API keys geradas pelos
# containers, grava em web/.env.local e cria as pastas raiz (/media/Filmes e
# /media/Series). Idempotente: pode rodar de novo depois de recriar os volumes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/web/.env.local"

RADARR_URL="${RADARR_URL:-http://localhost:7878}"
SONARR_URL="${SONARR_URL:-http://localhost:8989}"
RADARR_ROOT="${RADARR_ROOT_FOLDER:-/media/Filmes}"
SONARR_ROOT="${SONARR_ROOT_FOLDER:-/media/Series}"

api_key() {
  local file="$1/config/config.xml"
  [ -f "$file" ] || return 1
  sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$file" | head -1
}

wait_key() {
  local name="$1" dir="$2" url="$3" key=""
  for _ in $(seq 1 60); do
    key="$(api_key "$dir" || true)"
    if [ -n "$key" ] && curl -fsS -o /dev/null -H "X-Api-Key: $key" "$url/api/v3/system/status"; then
      printf '%s' "$key"
      return 0
    fi
    sleep 2
  done
  echo "ERRO: $name não respondeu em $url. Veja: docker compose logs $name" >&2
  return 1
}

upsert() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" '
    BEGIN { FS = OFS = "=" }
    $1 == k { print k "=" v; found = 1; next }
    { print }
    END { if (!found) print k "=" v }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

ensure_root() {
  python3 - "$1" "$2" "$3" "$4" <<'PY'
import json, sys, urllib.request
name, url, key, path = sys.argv[1:5]
headers = {"X-Api-Key": key}
req = urllib.request.Request(f"{url}/api/v3/rootfolder", headers=headers)
roots = json.load(urllib.request.urlopen(req, timeout=10))
if any(r["path"].rstrip("/") == path.rstrip("/") for r in roots):
    print(f"  {name}: {path} já configurada")
else:
    body = json.dumps({"path": path}).encode()
    req = urllib.request.Request(
        f"{url}/api/v3/rootfolder",
        data=body,
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)
    print(f"  {name}: {path} criada")
PY
}

profiles() {
  python3 - "$1" "$2" "$3" <<'PY'
import json, sys, urllib.request
name, url, key = sys.argv[1:4]
req = urllib.request.Request(f"{url}/api/v3/qualityprofile", headers={"X-Api-Key": key})
rows = json.load(urllib.request.urlopen(req, timeout=10))
print(f"  {name}: " + ", ".join(f'{r["id"]}={r["name"]}' for r in rows))
PY
}

echo "Aguardando Radarr e Sonarr..."
RADARR_KEY="$(wait_key Radarr "$ROOT/radarr" "$RADARR_URL")"
SONARR_KEY="$(wait_key Sonarr "$ROOT/sonarr" "$SONARR_URL")"

upsert RADARR_URL "$RADARR_URL"
upsert RADARR_API_KEY "$RADARR_KEY"
upsert RADARR_ROOT_FOLDER "$RADARR_ROOT"
upsert SONARR_URL "$SONARR_URL"
upsert SONARR_API_KEY "$SONARR_KEY"
upsert SONARR_ROOT_FOLDER "$SONARR_ROOT"

echo "Chaves gravadas em web/.env.local:"
echo "  Radarr: ${RADARR_KEY:0:6}…${RADARR_KEY: -4}"
echo "  Sonarr: ${SONARR_KEY:0:6}…${SONARR_KEY: -4}"

echo "Pastas raiz:"
ensure_root Radarr "$RADARR_URL" "$RADARR_KEY" "$RADARR_ROOT"
ensure_root Sonarr "$SONARR_URL" "$SONARR_KEY" "$SONARR_ROOT"

echo "Perfis de qualidade:"
profiles Radarr "$RADARR_URL" "$RADARR_KEY"
profiles Sonarr "$SONARR_URL" "$SONARR_KEY"

echo
echo "Pronto. Reinicie o Next para carregar as variáveis:"
echo "  pkill -f 'next start' && (cd web && npm run build && npm start)"
