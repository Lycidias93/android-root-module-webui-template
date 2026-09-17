#!/system/bin/sh
# Shared WebUI Core ntfy helper. Secret values are consumed for delivery only.
webui_ntfy_truthy() { case "${1:-}" in 1|yes|YES|true|TRUE|on|ON) return 0 ;; *) return 1 ;; esac; }

webui_ntfy_load_config_file() {
  file=${1:-}; [ -n "$file" ] && [ -r "$file" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      NTFY_ENABLED=*) NTFY_ENABLED=${line#*=} ;;
      NTFY_URL=*) NTFY_URL=${line#*=} ;;
      NTFY_TOPIC=*) NTFY_TOPIC=${line#*=} ;;
      NTFY_TOKEN_FILE=*) NTFY_TOKEN_FILE=${line#*=} ;;
      NTFY_PRIORITY=*) NTFY_PRIORITY=${line#*=} ;;
      NTFY_TAGS=*) NTFY_TAGS=${line#*=} ;;
    esac
  done < "$file"
}

webui_ntfy_endpoint() {
  if [ -n "${NTFY_URL:-}" ]; then
    case "$NTFY_URL" in http://*|https://*) printf '%s' "$NTFY_URL"; return 0 ;; *) return 1 ;; esac
  fi
  if [ -n "${NTFY_TOPIC:-}" ]; then
    case "$NTFY_TOPIC" in
      http://*|https://*) printf '%s' "$NTFY_TOPIC" ;;
      *[!A-Za-z0-9._~-]*|'') return 1 ;;
      *) printf 'https://ntfy.sh/%s' "$NTFY_TOPIC" ;;
    esac
    return 0
  fi
  return 1
}

webui_ntfy_curl() {
  if [ -n "${CURL_BIN:-}" ] && [ -x "$CURL_BIN" ]; then printf '%s' "$CURL_BIN"; return 0; fi
  for candidate in /data/data/com.termux/files/usr/bin/curl /system/bin/curl; do
    [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done
  command -v curl 2>/dev/null || return 1
}

webui_ntfy_status_json() {
  source_name=${1:-module}; mode=${2:-off}; lifecycle=${3:-start,success,fail}
  enabled=false; webui_ntfy_truthy "${NTFY_ENABLED:-0}" && enabled=true
  endpoint=false; webui_ntfy_endpoint >/dev/null 2>&1 && endpoint=true
  topic=false; [ -n "${NTFY_TOPIC:-}" ] && topic=true
  token=false; [ -n "${NTFY_TOKEN_FILE:-}" ] && [ -r "${NTFY_TOKEN_FILE:-}" ] && token=true
  case "$source_name" in *[!A-Za-z0-9._-]*|'') source_name=module ;; esac
  case "$mode" in *[!A-Za-z0-9._-]*|'') mode=off ;; esac
  lifecycle_json=''; old_ifs=$IFS; IFS=,
  for event in $lifecycle; do
    case "$event" in start|success|fail|warn)
      [ -z "$lifecycle_json" ] || lifecycle_json="$lifecycle_json,"
      lifecycle_json="$lifecycle_json\"$event\"" ;;
    esac
  done
  IFS=$old_ifs
  printf '{"schema":"root-module-webui.notifications.status.v1","ok":true,"provider":"ntfy","enabled":%s,"source":"%s","mode":"%s","endpoint_configured":%s,"topic_configured":%s,"token_file_configured":%s,"lifecycle":[%s]}\n' "$enabled" "$source_name" "$mode" "$endpoint" "$topic" "$token" "$lifecycle_json"
}

webui_ntfy_send() {
  status=${1:-INFO}; title=${2:-Notification}; body=${3:-}; tags=${4:-${NTFY_TAGS:-package}}; priority=${5:-${NTFY_PRIORITY:-default}}
  if ! webui_ntfy_truthy "${NTFY_ENABLED:-0}"; then printf '%s\n' 'ntfy_send_state=disabled'; return 0; fi
  url=$(webui_ntfy_endpoint 2>/dev/null || true); [ -n "$url" ] || { printf '%s\n' 'ntfy_send_state=missing_endpoint'; return 0; }
  curl_bin=$(webui_ntfy_curl 2>/dev/null || true); [ -n "$curl_bin" ] || { printf '%s\n' 'ntfy_send_state=curl_missing'; return 0; }
  title=$(printf '%s' "$title" | tr '\r\n' '  '); tags=$(printf '%s' "$tags" | tr '\r\n' '  '); priority=$(printf '%s' "$priority" | tr '\r\n' '  ')
  case "$priority" in min|low|default|high|max|1|2|3|4|5) ;; *) priority=default ;; esac
  case "$tags" in *[!A-Za-z0-9_,.-]*|'') tags=package ;; esac
  token=''
  if [ -n "${NTFY_TOKEN_FILE:-}" ] && [ -r "${NTFY_TOKEN_FILE:-}" ]; then token=$(tr -d '\r\n' < "$NTFY_TOKEN_FILE" 2>/dev/null || true); fi
  if [ -n "$token" ]; then
    "$curl_bin" -fsS -m 8 -H "Title: $title" -H "Priority: $priority" -H "Tags: $tags" -H "Authorization: Bearer $token" -d "$body" "$url" >/dev/null 2>&1 && state=sent || state=failed
  else
    "$curl_bin" -fsS -m 8 -H "Title: $title" -H "Priority: $priority" -H "Tags: $tags" -d "$body" "$url" >/dev/null 2>&1 && state=sent || state=failed
  fi
  printf 'ntfy_send_state=%s\n' "$state"
  return 0
}
