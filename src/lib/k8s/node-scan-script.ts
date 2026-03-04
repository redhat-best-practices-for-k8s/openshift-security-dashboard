/**
 * Bash script that runs inside `oc debug node/<name>` via `chroot /host bash`.
 * Since it runs in the host context, all tools (crictl, nsenter, openssl, ss, ip)
 * are available directly — no `chroot /host` prefix needed.
 */
export const NODE_SCAN_SCRIPT = `#!/bin/bash
set -o pipefail

NODE_NAME="\${NODE_NAME:-unknown}"
TIMEOUT_SEC=5

log()  { echo "[$(date +%H:%M:%S)] $*"; }
logv() { echo "  | $*"; }

# ── 1. Enumerate containers and build netns map ─────────────────────────

log "========================================"
log "Starting TLS scan on node: $NODE_NAME"
log "========================================"
log ""
log "Step 1: Enumerating containers via crictl..."

declare -A NETNS_TO_CIDS
declare -A NETNS_TO_PID

container_ids=$(crictl ps -q 2>/dev/null)
total_containers=$(echo "$container_ids" | grep -c . || echo 0)
log "crictl ps: found $total_containers running containers"

mapped=0
skipped=0
for cid in $container_ids; do
  pid=$(crictl inspect "$cid" 2>/dev/null | grep -m1 '"pid"' | sed 's/[^0-9]//g')
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  netns=$(readlink /proc/$pid/ns/net 2>/dev/null)
  if [ -z "$netns" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  mapped=$((mapped + 1))
  if [ -z "\${NETNS_TO_CIDS[$netns]}" ]; then
    NETNS_TO_CIDS["$netns"]="$cid"
    NETNS_TO_PID["$netns"]="$pid"
  else
    NETNS_TO_CIDS["$netns"]="\${NETNS_TO_CIDS[$netns]},$cid"
  fi
done

unique_netns=\${#NETNS_TO_CIDS[@]}
log "Mapped $mapped containers -> $unique_netns unique network namespaces ($skipped skipped)"
log ""

# ── 2. Helpers ───────────────────────────────────────────────────────────

json_escape() {
  local s="$1"
  s=\${s//\\\\/\\\\\\\\}
  s=\${s//\\"/\\\\\\"}
  s=\${s//$'\\n'/\\\\n}
  s=\${s//$'\\r'/\\\\r}
  s=\${s//$'\\t'/\\\\t}
  echo -n "$s"
}

_SCAN_RETFILE="/tmp/.tls_scan_ret.$$"
_SCAN_HSFILE="/tmp/.tls_scan_hs.$$"

# Extract handshake details from an openssl s_client output
parse_handshake() {
  local result="$1"
  local kex_group="" kex_bits="" sig_algo="" alpn=""

  local temp_key
  temp_key=$(echo "$result" | grep -i "Server Temp Key:" | head -1)
  if [ -n "$temp_key" ]; then
    # "Server Temp Key: X25519, 253 bits" or "Server Temp Key: ECDH, P-256, 256 bits"
    # or "Server Temp Key: X25519MLKEM768, 1217 bits"
    kex_group=$(echo "$temp_key" | sed 's/.*Server Temp Key: *//;s/, *[0-9].*//')
    kex_bits=$(echo "$temp_key" | grep -oP '[0-9]+ bits' | grep -oP '[0-9]+')
    # For "ECDH, P-256" style, combine into the named curve
    if [ "$kex_group" = "ECDH" ]; then
      local curve
      curve=$(echo "$temp_key" | sed 's/.*Server Temp Key: *ECDH, *//;s/, *[0-9].*//')
      [ -n "$curve" ] && kex_group="$curve"
    fi
  fi

  sig_algo=$(echo "$result" | grep -i "Peer signature type:" | head -1 | sed 's/.*Peer signature type: *//')
  alpn=$(echo "$result" | grep -i "ALPN protocol:" | head -1 | sed 's/.*ALPN protocol: *//')
  [ "$alpn" = "None" ] && alpn=""

  echo "\${kex_group}|\${kex_bits}|\${sig_algo}|\${alpn}" > "$_SCAN_HSFILE"
}

scan_port_tls() {
  local pid=$1 ip=$2 port=$3
  local versions_found=""
  local ciphers_json=""
  local tls_supported=false
  local best_result=""
  local best_ver=""

  for ver_flag in "-tls1" "-tls1_1" "-tls1_2" "-tls1_3"; do
    local ver_name=""
    case "$ver_flag" in
      -tls1)   ver_name="TLSv1.0" ;;
      -tls1_1) ver_name="TLSv1.1" ;;
      -tls1_2) ver_name="TLSv1.2" ;;
      -tls1_3) ver_name="TLSv1.3" ;;
    esac

    local result
    result=$(echo | timeout "$TIMEOUT_SEC" nsenter --net=/proc/$pid/ns/net \\
      openssl s_client -connect "$ip:$port" "$ver_flag" 2>&1) || continue

    local cipher_line
    cipher_line=$(echo "$result" | grep "Cipher is" | head -1)

    if echo "$cipher_line" | grep -q "Cipher is.*[A-Z]"; then
      tls_supported=true
      best_result="$result"
      best_ver="$ver_name"
      logv "  openssl $ver_flag -> $cipher_line"
      if [ -z "$versions_found" ]; then
        versions_found="$ver_name"
      else
        versions_found="$versions_found,$ver_name"
      fi
    fi
  done

  if ! $tls_supported; then
    local connect_result
    connect_result=$(echo | timeout "$TIMEOUT_SEC" nsenter --net=/proc/$pid/ns/net \\
      bash -c "echo >/dev/tcp/$ip/$port" 2>&1) && {
      logv "  No TLS, but port is open (plain TCP)"
      echo "NO_TLS|||" > "$_SCAN_RETFILE"
      echo "|||" > "$_SCAN_HSFILE"
      return
    }
    logv "  Connection failed or filtered"
    echo "CONNECT_FAIL|||" > "$_SCAN_RETFILE"
    echo "|||" > "$_SCAN_HSFILE"
    return
  fi

  # Extract handshake details from the best (highest) version
  parse_handshake "$best_result"
  local hs_data
  hs_data=$(cat "$_SCAN_HSFILE")
  logv "  Handshake ($best_ver): $hs_data"

  # Enumerate TLS 1.2 ciphers (peel method)
  local exclude=""
  local cipher_list=""
  local cipher_count=0
  for _ in $(seq 1 50); do
    local cipher_arg="ALL:COMPLEMENTOFALL"
    [ -n "$exclude" ] && cipher_arg="ALL:COMPLEMENTOFALL$exclude"

    local result
    result=$(echo | timeout "$TIMEOUT_SEC" nsenter --net=/proc/$pid/ns/net \\
      openssl s_client -connect "$ip:$port" -tls1_2 -cipher "$cipher_arg" 2>&1) || break

    local cipher
    cipher=$(echo "$result" | grep -oP 'Cipher is \\K\\S+' | head -1)
    [ -z "$cipher" ] || [ "$cipher" = "0000" ] || [ "$cipher" = "(NONE)" ] && break

    cipher_count=$((cipher_count + 1))
    if [ -z "$cipher_list" ]; then
      cipher_list="{\\"name\\":\\"$(json_escape "$cipher")\\",\\"version\\":\\"TLSv1.2\\"}"
    else
      cipher_list="$cipher_list,{\\"name\\":\\"$(json_escape "$cipher")\\",\\"version\\":\\"TLSv1.2\\"}"
    fi
    exclude="$exclude:!$cipher"
  done

  # Enumerate TLS 1.3 ciphers
  local tls13_suites="TLS_AES_256_GCM_SHA384 TLS_CHACHA20_POLY1305_SHA256 TLS_AES_128_GCM_SHA256 TLS_AES_128_CCM_SHA256 TLS_AES_128_CCM_8_SHA256"
  for suite in $tls13_suites; do
    local result
    result=$(echo | timeout "$TIMEOUT_SEC" nsenter --net=/proc/$pid/ns/net \\
      openssl s_client -connect "$ip:$port" -tls1_3 -ciphersuites "$suite" 2>&1) || continue

    if echo "$result" | grep -q "Cipher is.*$suite"; then
      cipher_count=$((cipher_count + 1))
      local entry="{\\"name\\":\\"$suite\\",\\"version\\":\\"TLSv1.3\\"}"
      if [ -z "$cipher_list" ]; then
        cipher_list="$entry"
      else
        cipher_list="$cipher_list,$entry"
      fi
    fi
  done

  logv "  Enumerated $cipher_count ciphers (versions: $versions_found)"
  echo "OK|$versions_found|[$cipher_list]" > "$_SCAN_RETFILE"
}

# ── 3. Main scan loop ───────────────────────────────────────────────────

log "Step 2: Scanning $unique_netns network namespaces..."
log ""

results_array=""
errors_array=""
scanned=0
total_ports_scanned=0

for netns in "\${!NETNS_TO_CIDS[@]}"; do
  pid="\${NETNS_TO_PID[$netns]}"
  cids="\${NETNS_TO_CIDS[$netns]}"
  scanned=$((scanned + 1))

  # Get IPs via nsenter into the container's network namespace
  ip_output=$(nsenter --net=/proc/$pid/ns/net ip -4 addr show 2>/dev/null)
  ips=$(echo "$ip_output" | grep -oP 'inet \\K[0-9.]+' | grep -v '^127\\.' | sort -u)
  [ -z "$ips" ] && continue

  primary_ip=$(echo "$ips" | head -1)

  # Get listening ports via ss
  ss_output=$(nsenter --net=/proc/$pid/ns/net ss -tlnp 2>/dev/null)
  ports_info=$(echo "$ss_output" | tail -n +2 | awk '{print $4 "|" $6}')
  [ -z "$ports_info" ] && continue

  num_containers=$(echo "$cids" | tr ',' '\\n' | wc -l)
  num_ports=$(echo "$ports_info" | wc -l)
  log "[$scanned/$unique_netns] netns $primary_ip ($num_containers containers, $num_ports ports)"

  logv "ss -tlnp:"
  echo "$ss_output" | tail -n +2 | while IFS= read -r line; do
    logv "  $line"
  done

  # Build container_ids JSON array
  cids_json=""
  IFS=',' read -ra cid_arr <<< "$cids"
  for c in "\${cid_arr[@]}"; do
    if [ -z "$cids_json" ]; then cids_json="\\"$c\\""; else cids_json="$cids_json,\\"$c\\""; fi
  done

  port_results=""

  while IFS='|' read -r addr_port proc_info; do
    [ -z "$addr_port" ] && continue

    local_port=$(echo "$addr_port" | rev | cut -d: -f1 | rev)
    listen_addr=$(echo "$addr_port" | rev | cut -d: -f2- | rev)
    [ -z "$local_port" ] && continue

    proc_name=$(echo "$proc_info" | grep -oP 'users:\\(\\("\\K[^"]+' | head -1)
    [ -z "$proc_name" ] && proc_name=""

    total_ports_scanned=$((total_ports_scanned + 1))

    if [ "$listen_addr" = "127.0.0.1" ]; then
      logv "Port $local_port ($proc_name) -> LOCALHOST_ONLY"
      entry="{\\"port\\":$local_port,\\"protocol\\":\\"tcp\\",\\"listen_address\\":\\"$listen_addr:$local_port\\",\\"process\\":\\"$(json_escape "$proc_name")\\",\\"status\\":\\"LOCALHOST_ONLY\\",\\"reason\\":\\"Bound to 127.0.0.1\\",\\"tls_versions\\":[],\\"tls_ciphers\\":[]}"
      if [ -z "$port_results" ]; then port_results="$entry"; else port_results="$port_results,$entry"; fi
      continue
    fi

    scan_ip="$primary_ip"
    logv "Port $local_port ($proc_name) on $scan_ip - probing TLS..."

    echo -n "" > "$_SCAN_RETFILE"
    echo -n "" > "$_SCAN_HSFILE"
    scan_port_tls "$pid" "$scan_ip" "$local_port"
    scan_result=$(cat "$_SCAN_RETFILE")
    IFS='|' read -r status versions ciphers_json <<< "$scan_result"

    # Read handshake details
    hs_raw=$(cat "$_SCAN_HSFILE" 2>/dev/null)
    hs_kex_group="" hs_kex_bits="" hs_sig_algo="" hs_alpn=""
    IFS='|' read -r hs_kex_group hs_kex_bits hs_sig_algo hs_alpn <<< "$hs_raw"

    reason=""
    versions_json="[]"
    ciphers_out="[]"

    case "$status" in
      OK)
        reason="TLS scan successful"
        versions_json="["
        IFS=',' read -ra ver_arr <<< "$versions"
        first=true
        for v in "\${ver_arr[@]}"; do
          [ -z "$v" ] && continue
          if $first; then versions_json="$versions_json\\"$v\\""; first=false;
          else versions_json="$versions_json,\\"$v\\""; fi
        done
        versions_json="$versions_json]"
        ciphers_out="$ciphers_json"
        [ -z "$ciphers_out" ] && ciphers_out="[]"
        logv "  => OK ($versions) kex=$hs_kex_group sig=$hs_sig_algo"
        ;;
      NO_TLS)  reason="Port open but no TLS detected"; logv "  => NO_TLS" ;;
      CONNECT_FAIL) status="FILTERED"; reason="Connection failed or filtered"; logv "  => FILTERED" ;;
      *) status="ERROR"; reason="Unexpected scan result"; logv "  => ERROR" ;;
    esac

    # Build handshake JSON fields
    hs_json=""
    [ -n "$hs_kex_group" ] && hs_json="$hs_json,\\"key_exchange_group\\":\\"$(json_escape "$hs_kex_group")\\""
    [ -n "$hs_kex_bits" ]  && hs_json="$hs_json,\\"key_exchange_bits\\":$hs_kex_bits"
    [ -n "$hs_sig_algo" ]  && hs_json="$hs_json,\\"signature_algorithm\\":\\"$(json_escape "$hs_sig_algo")\\""
    [ -n "$hs_alpn" ]      && hs_json="$hs_json,\\"alpn_protocol\\":\\"$(json_escape "$hs_alpn")\\""

    entry="{\\"port\\":$local_port,\\"protocol\\":\\"tcp\\",\\"listen_address\\":\\"$listen_addr:$local_port\\",\\"process\\":\\"$(json_escape "$proc_name")\\",\\"status\\":\\"$status\\",\\"reason\\":\\"$(json_escape "$reason")\\",\\"tls_versions\\":$versions_json,\\"tls_ciphers\\":$ciphers_out$hs_json}"
    if [ -z "$port_results" ]; then port_results="$entry"; else port_results="$port_results,$entry"; fi

  done <<< "$ports_info"

  [ -z "$port_results" ] && continue

  ips_json=""
  for ip in $ips; do
    if [ -z "$ips_json" ]; then ips_json="\\"$ip\\""; else ips_json="$ips_json,\\"$ip\\""; fi
  done

  entry="{\\"netns\\":\\"$(json_escape "$netns")\\",\\"container_ids\\":[$cids_json],\\"ips\\":[$ips_json],\\"ports\\":[$port_results]}"
  if [ -z "$results_array" ]; then results_array="$entry"; else results_array="$results_array,$entry"; fi

  log ""
done

# ── 4. Output results ───────────────────────────────────────────────────

log "========================================"
log "Scan complete on $NODE_NAME"
log "  Network namespaces: $scanned"
log "  Ports probed: $total_ports_scanned"
log "========================================"

echo "===RESULTS_JSON_START==="
cat << ENDJSON
{"node":"$NODE_NAME","scan_results":[$results_array],"errors":[$errors_array],"scanned_netns":$scanned,"total_netns":$unique_netns}
ENDJSON
echo "===RESULTS_JSON_END==="
`;
