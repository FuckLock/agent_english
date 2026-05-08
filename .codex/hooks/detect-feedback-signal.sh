#!/usr/bin/env bash
set -euo pipefail

input="$(cat || true)"
prompt="$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null || true)"

if [ -z "$prompt" ]; then
  exit 0
fi

if printf '%s' "$prompt" | grep -qE "不是这样|别这样做|你搞错|搞错了|你错了|不对|不应该|你漏了|你忘了|改一下|不合理|你理解错|我说的不是|你确定|到底在|为什么没|没有执行|没有生效|你又忘|强调了|说过了|提醒过|怎么还|一直在|每次都|我不是让你|你先.*看|再说一遍|你到底|什么意思|能不能|不要再|别再|停下|不用管|先不要"; then
  printf '%s\n' '{"additionalContext":"检测到用户修正信号。请在处理完用户请求后，记录到 .codex/feedback/；不要只写 memory。"}'
fi

exit 0
