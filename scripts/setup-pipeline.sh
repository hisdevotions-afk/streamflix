#!/usr/bin/env bash
# Sobe a esteira completa: Radarr/Sonarr (setup-arr.sh) + qBittorrent como
# downloader + Prowlarr conectado aos dois. Idempotente.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/web/.env.local"
QBT_URL="${QBITTORRENT_URL:-http://localhost:8080}"
PROWLARR_URL="${PROWLARR_URL:-http://localhost:9696}"

api_key() {
  local file="$1/config/config.xml"
  [ -f "$file" ] || return 1
  sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$file" | head -1
}

wait_http() {
  local url="$1" name="$2"
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$url"; then return 0; fi
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

echo "== Radarr/Sonarr =="
"$ROOT/scripts/setup-arr.sh"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
QBT_URL="${QBITTORRENT_URL:-$QBT_URL}"
PROWLARR_URL="${PROWLARR_URL:-$PROWLARR_URL}"

mkdir -p "$HOME/Downloads/streamflix/complete/radarr" \
         "$HOME/Downloads/streamflix/complete/sonarr" \
         "$HOME/Downloads/streamflix/incomplete"

echo "== Aguardando qBittorrent e Prowlarr =="
wait_http "$QBT_URL" "qBittorrent"
wait_http "$PROWLARR_URL" "Prowlarr"

PKEY="$(api_key "$ROOT/prowlarr")"
if [ -z "$PKEY" ]; then
  echo "ERRO: API key do Prowlarr não encontrada em prowlarr/config/config.xml" >&2
  exit 1
fi

echo "== qBittorrent: senha, pastas e categorias =="
QBT_PASS="$(
  QBT_URL="$QBT_URL" \
  QBT_USER="${QBITTORRENT_USERNAME:-admin}" \
  QBT_PASS="${QBITTORRENT_PASSWORD:-}" \
  python3 - <<'PY'
import http.cookiejar
import json
import os
import re
import secrets
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

base = os.environ["QBT_URL"].rstrip("/")
user = os.environ.get("QBT_USER") or "admin"
password = os.environ.get("QBT_PASS") or ""

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def request(path, data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(
        base + path,
        data=body,
        method="POST" if body is not None else "GET",
        headers={"Referer": base},
    )
    return opener.open(req, timeout=20)

def login(candidate):
    try:
        with request("/api/v2/auth/login", {"username": user, "password": candidate}) as res:
            return res.status in (200, 204)
    except urllib.error.HTTPError:
        return False

def temp_password():
    proc = subprocess.run(
        ["docker", "logs", "streamflix_qbittorrent"],
        capture_output=True, text=True,
    )
    match = re.search(r"temporary password is provided for this session:\s*(\S+)", proc.stdout + proc.stderr)
    return match.group(1) if match else None

final = password if password and login(password) else None
changed = False

if not final:
    temp = temp_password()
    if not temp or not login(temp):
        sys.exit("Não autenticou no qBittorrent. Defina QBITTORRENT_PASSWORD ou recrie ./qbittorrent/config.")
    final = "sfx-" + secrets.token_hex(10)
    prefs = {"web_ui_password": final}
    request("/api/v2/app/setPreferences", {"json": json.dumps(prefs)})
    if not login(final):
        sys.exit("Falha ao gravar a nova senha do qBittorrent.")
    changed = True

prefs = {
    "web_ui_host_header_validation_enabled": False,
    "save_path": "/downloads/complete",
    "temp_path_enabled": True,
    "temp_path": "/downloads/incomplete",
}
request("/api/v2/app/setPreferences", {"json": json.dumps(prefs)})

for category in ("radarr", "sonarr"):
    try:
        request("/api/v2/torrents/createCategory", {
            "category": category,
            "savePath": f"/downloads/complete/{category}",
        })
    except urllib.error.HTTPError as err:
        if err.code != 409:
            raise

print(final, end="")
if changed:
    print("  (senha nova)", file=sys.stderr)
PY
)"

upsert QBITTORRENT_URL "$QBT_URL"
upsert QBITTORRENT_USERNAME "${QBITTORRENT_USERNAME:-admin}"
upsert QBITTORRENT_PASSWORD "$QBT_PASS"
echo "  downloader configurado (credenciais em web/.env.local)"

echo "== Conectando qBittorrent ao Radarr/Sonarr =="
RADARR_KEY="$(grep '^RADARR_API_KEY=' "$ENV_FILE" | cut -d= -f2)"
SONARR_KEY="$(grep '^SONARR_API_KEY=' "$ENV_FILE" | cut -d= -f2)"

python3 - "$RADARR_KEY" "$SONARR_KEY" "$QBT_PASS" "$PKEY" <<'PY'
import json
import sys
import urllib.error
import urllib.request

radarr_key, sonarr_key, qbt_pass, prowlarr_key = sys.argv[1:5]
RADARR = "http://localhost:7878"
SONARR = "http://localhost:8989"
PROWLARR = "http://localhost:9696"

def call(base, key, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={"X-Api-Key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()[:400]

def wire_downloader(name, base, key, category_field, category):
    status, existing = call(base, key, "/api/v3/downloadclient")
    if status != 200:
        print(f"  {name}: falha ao listar clientes ({status})")
        return
    if any(client.get("name") == "qBittorrent" for client in existing):
        print(f"  {name}: qBittorrent já conectado")
        return

    _, schema = call(base, key, "/api/v3/downloadclient/schema")
    impl = next(item for item in schema if item["implementation"] == "QBittorrent")
    fields = {field["name"]: field.get("value") for field in impl["fields"]}
    fields.update({
        "host": "qbittorrent",
        "port": 8080,
        "useSsl": False,
        "urlBase": "",
        "apiKey": "",
        "username": "admin",
        "password": qbt_pass,
        category_field: category,
        "initialState": 0,
        "sequentialOrder": False,
        "firstAndLast": False,
        "contentLayout": 0,
    })
    body = {
        "enable": True,
        "protocol": "torrent",
        "priority": 1,
        "removeCompletedDownloads": True,
        "removeFailedDownloads": True,
        "name": "qBittorrent",
        "implementation": impl["implementation"],
        "implementationName": impl["implementationName"],
        "configContract": impl["configContract"],
        "fields": [{"name": k, "value": v} for k, v in fields.items()],
        "tags": [],
    }
    status, result = call(base, key, "/api/v3/downloadclient/test", "POST", body)
    if status >= 300:
        print(f"  {name}: teste falhou ({status}) {result}")
        return
    status, result = call(base, key, "/api/v3/downloadclient", "POST", body)
    print(f"  {name}: conectado ({status})" if status < 300 else f"  {name}: erro {status} {result}")

def wire_prowlarr_app(impl_name, target_url, target_key, categories):
    status, apps = call(PROWLARR, prowlarr_key, "/api/v1/applications")
    if status != 200:
        print(f"  Prowlarr: falha ao listar apps ({status})")
        return
    if any(app.get("name") == impl_name for app in apps):
        print(f"  Prowlarr: {impl_name} já conectado")
        return

    _, schema = call(PROWLARR, prowlarr_key, "/api/v1/applications/schema")
    impl = next(item for item in schema if item["implementation"] == impl_name)
    fields = {field["name"]: field.get("value") for field in impl["fields"]}
    fields.update({
        "prowlarrUrl": "http://prowlarr:9696",
        "baseUrl": target_url,
        "apiKey": target_key,
        "authUsername": "",
        "authPassword": "",
        "syncCategories": categories,
        "syncRejectBlocklistedTorrentHashesWhileGrabbing": False,
    })
    if impl_name == "Sonarr":
        fields.update({"animeSyncCategories": [5070], "syncAnimeStandardFormatSearch": True})

    body = {
        "name": impl_name,
        "syncLevel": "fullSync",
        "implementation": impl["implementation"],
        "implementationName": impl["implementationName"],
        "configContract": impl["configContract"],
        "fields": [{"name": k, "value": v} for k, v in fields.items()],
        "tags": [],
    }
    status, result = call(PROWLARR, prowlarr_key, "/api/v1/applications/test", "POST", body)
    if status >= 300:
        print(f"  Prowlarr/{impl_name}: teste falhou ({status}) {result}")
        return
    status, result = call(PROWLARR, prowlarr_key, "/api/v1/applications", "POST", body)
    print(f"  Prowlarr/{impl_name}: conectado ({status})" if status < 300 else f"  Prowlarr/{impl_name}: erro {status} {result}")

wire_downloader("Radarr", RADARR, radarr_key, "movieCategory", "radarr")
wire_downloader("Sonarr", SONARR, sonarr_key, "tvCategory", "sonarr")

movie_categories = [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080, 2090]
tv_categories = [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5090]
wire_prowlarr_app("Radarr", "http://radarr:7878", radarr_key, movie_categories)
wire_prowlarr_app("Sonarr", "http://sonarr:8989", sonarr_key, tv_categories)
PY

echo
echo "Esteira pronta: Radarr :7878, Sonarr :8989, Prowlarr :9696, qBittorrent :8080."
echo "Falta apenas cadastrar seus indexers em Prowlarr → Indexers."
echo "Reinicie o Next para carregar as variáveis novas: pkill -f 'next start' && (cd web && npm run build && npm start)"
