#!/usr/bin/env bash
#
# 프론트 빌드(dist/)를 S3 에 올리고 CloudFront 캐시를 비운다. 절차 · 이유는 docs/배포.md 4장 · 5장.
#
#   FRONT_BUCKET=<프론트 버킷> DISTRIBUTION_ID=<배포 ID> bash deploy/s3-upload.sh            미리보기(아무것도 바꾸지 않는다)
#   FRONT_BUCKET=<프론트 버킷> DISTRIBUTION_ID=<배포 ID> bash deploy/s3-upload.sh --apply    실제로 올린다
#   FRONT_BUCKET=<프론트 버킷> bash deploy/s3-upload.sh prune [--apply]                     오래된 해시 파일 정리(따로, 가끔)
#
# 순서가 핵심이다.
#   1. /assets/* (해시 이름) 먼저 — 1년 캐시 · immutable. **지우지 않는다**(옛 index.html 을 가진 탭이 옛 청크를 받아야 한다)
#   2. 해시 없는 파일(theme-init.js · favicon.svg) → 마지막에 index.html — no-cache.
#      index.html 이 먼저 바뀌면 새 청크가 올라가기 전의 짧은 틈에 새 index.html 이 없는 파일을 부른다
#   3. 해시 없는 파일만 무효화
# prune 은 지금 배포(index.html)가 PRUNE_DAYS 일(기본 7)을 넘긴 뒤에만 지운다 — 까닭은 아래 prune 부분.
# Content-Type 은 확장자별로 직접 붙인다. 윈도우의 AWS CLI 는 레지스트리에서 형식을 읽어 .js 를 text/plain 으로 올리는 일이 있고,
# CloudFront 응답 헤더의 nosniff 때문에 그러면 브라우저가 스크립트를 실행하지 않는다(화면이 하얗다).
#
# 액세스 키를 이 파일 · 명령줄에 적지 않는다. `aws configure` 로 만든 프로필을 쓴다(AWS_PROFILE).
# 누구로 도는지 먼저 확인한다(aws sts get-caller-identity). 배포 전용 사용자(DEPLOY_IAM_USER, 기본 lostfound-front-deployer)가
# 아니면 --apply 는 멈춘다 — 기본 프로필(관리자 키 · 백엔드 키)로 잘못 돌리는 것을 막는다. 미리보기는 경고만 한다.
# GitHub Actions(.github/workflows/deploy.yml)는 사용자가 아니라 OIDC 역할로 돈다 — DEPLOY_IAM_ROLE(역할 이름)을 주면
# 그 역할의 세션(arn:aws:sts::<계정>:assumed-role/<역할 이름>/<세션>)도 통과한다. 비우면 위 그대로 사용자만(docs/배포.md 9장).

set -euo pipefail

# Git Bash 가 `/index.html` 같은 인자를 `C:/Program Files/Git/index.html` 로 바꾸지 않게 한다(무효화 경로가 틀어진다)
export MSYS_NO_PATHCONV=1

DIST=dist
IMAGE_BUCKET=lostfound-images-solmin-seoul
# 사진 CloudFront(사진 버킷을 OAC 로 내보내는 배포). build/csp.ts 의 DEFAULT_IMAGE_ORIGINS 와 같은 값 — csp.test.ts 가 맞춰 본다
PHOTO_ORIGIN=https://d1xmzetvs0f1oh.cloudfront.net
IMMUTABLE='public, max-age=31536000, immutable'
NO_CACHE='no-cache'

die() { printf '\n[중단] %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }
warn() { printf '\n[경고] %s\n' "$*" >&2; }

# 윈도우의 aws.exe 는 줄 끝을 CRLF 로 찍을 수 있다. Git Bash 에서 받으면 값 끝에 \r 이 붙어
# 키 비교(지금 빌드의 파일인지)가 전부 어긋난다 — 받은 출력은 모두 이것을 거친다
strip_cr() { tr -d '\r'; }

# S3 · CLI v2 의 시각(ISO 8601, UTC) — 2026-09-29T01:23:45+00:00 · 2026-09-29T01:23:45.000Z
ISO_UTC='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|\+00:00)$'

content_type() {
  case "$1" in
    html) echo 'text/html; charset=utf-8' ;;
    js | mjs) echo 'text/javascript; charset=utf-8' ;;
    css) echo 'text/css; charset=utf-8' ;;
    json) echo 'application/json' ;;
    txt) echo 'text/plain; charset=utf-8' ;;
    svg) echo 'image/svg+xml' ;;
    png) echo 'image/png' ;;
    jpg | jpeg) echo 'image/jpeg' ;;
    webp) echo 'image/webp' ;;
    gif) echo 'image/gif' ;;
    ico) echo 'image/x-icon' ;;
    woff2) echo 'font/woff2' ;;
    woff) echo 'font/woff' ;;
    *) return 1 ;;
  esac
}

MODE=upload
APPLY=0
for arg in "$@"; do
  case "$arg" in
    prune) MODE=prune ;;
    --apply) APPLY=1 ;;
    *) die "모르는 인자: $arg (쓸 수 있는 것: prune, --apply)" ;;
  esac
done
DRYRUN=()
[ "$APPLY" = 1 ] || DRYRUN=(--dryrun)

# ---- 공통 점검 -------------------------------------------------------------

command -v aws >/dev/null 2>&1 || die 'aws 명령이 없습니다. AWS CLI v2 를 설치하고 `aws configure` 를 먼저 하세요(docs/배포.md 2장).'
[ -n "${FRONT_BUCKET:-}" ] || die 'FRONT_BUCKET 이 비어 있습니다. 프론트 빌드를 올릴 버킷 이름을 넣으세요.'
case "$FRONT_BUCKET" in
  s3://* | */*) die "FRONT_BUCKET 에는 버킷 이름만 넣습니다(s3:// · / 없이): $FRONT_BUCKET" ;;
esac
# S3 버킷 이름 규칙(3~63자, 소문자 · 숫자 · 점 · 하이픈, 처음과 끝은 소문자나 숫자). 공백 · 대문자 · 붙여 넣다 딸려 온 글자를 AWS 에 묻기 전에 걸러 낸다
if ! [[ "$FRONT_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || [[ "$FRONT_BUCKET" == *..* ]]; then
  die "버킷 이름 모양이 아닙니다(3~63자, 소문자 · 숫자 · 점 · 하이픈): $FRONT_BUCKET"
fi
[ "$FRONT_BUCKET" != "$IMAGE_BUCKET" ] || die "사진 버킷($IMAGE_BUCKET)입니다. 프론트 버킷을 따로 만들어 넣으세요."

DEPLOY_IAM_USER="${DEPLOY_IAM_USER:-lostfound-front-deployer}"
[[ "$DEPLOY_IAM_USER" =~ ^[A-Za-z0-9+=,.@_-]{1,64}$ ]] \
  || die "DEPLOY_IAM_USER 에는 IAM 사용자 이름만 넣습니다(ARN 이 아니라 이름): $DEPLOY_IAM_USER"
DEPLOY_IAM_ROLE="${DEPLOY_IAM_ROLE:-}"
[ -z "$DEPLOY_IAM_ROLE" ] || [[ "$DEPLOY_IAM_ROLE" =~ ^[A-Za-z0-9+=,.@_-]{1,64}$ ]] \
  || die "DEPLOY_IAM_ROLE 에는 IAM 역할 이름만 넣습니다(ARN 이 아니라 이름): $DEPLOY_IAM_ROLE"

if [ "$MODE" = upload ]; then
  [ -n "${DISTRIBUTION_ID:-}" ] || die 'DISTRIBUTION_ID 가 비어 있습니다. CloudFront 배포 ID(E 로 시작)를 넣으세요.'
  [[ "$DISTRIBUTION_ID" =~ ^E[A-Z0-9]+$ ]] || die "배포 ID 모양이 아닙니다(E 로 시작하는 대문자 · 숫자): $DISTRIBUTION_ID"
else
  DAYS="${PRUNE_DAYS:-7}"
  [[ "$DAYS" =~ ^[0-9]+$ ]] && [ "$DAYS" -ge 1 ] || die "PRUNE_DAYS 는 1 이상의 정수입니다: $DAYS"
  CUTOFF="$(date -u -d "$DAYS days ago" +%Y-%m-%dT%H:%M:%S)" || die 'date -d 를 쓸 수 없는 환경입니다(Git Bash · 리눅스에서 돌리세요).'
fi

[ -f "$DIST/index.html" ] || die "$DIST/index.html 이 없습니다. 리포 맨 위에서 빌드부터 하세요: CSP_IMAGE_ORIGINS=$PHOTO_ORIGIN npm run build"
[ -d "$DIST/assets" ] || die "$DIST/assets 가 없습니다. 빌드가 끝까지 됐는지 확인하세요."

# 지금 dist/assets 에 있는 파일 이름(정리할 때 지우지 않을 목록)
mapfile -t CURRENT_ASSETS < <(cd "$DIST/assets" && find . -type f | sed 's|^\./||' | sort)
[ "${#CURRENT_ASSETS[@]}" -gt 0 ] || die "$DIST/assets 가 비어 있습니다. 빌드가 끝까지 됐는지 확인하세요."

# ---- 자격 확인 : 누구로 도는지 ------------------------------------------------
# 배포 전용 사용자는 프론트 버킷 · 이 배포만 만질 수 있다(docs/배포.md 2.2). 다른 키(관리자 · 백엔드 lostfound-app)로
# --apply 하면 버킷 이름 하나 틀린 것이 다른 버킷을 덮거나 지우는 일이 된다. 이름을 바꿨으면 DEPLOY_IAM_USER 로 알려 준다.
# 우회 플래그는 두지 않는다 — 다른 사용자로 올려야 하면 DEPLOY_IAM_USER 에 그 이름을 적는다(명령에 남아 보인다)

caller_is_deployer() {
  [[ "$1" =~ ^arn:aws:iam::[0-9]{12}:user/(.+/)?([^/]+)$ ]] && [ "${BASH_REMATCH[2]}" = "$DEPLOY_IAM_USER" ]
}

# GitHub Actions 의 OIDC 역할 세션. DEPLOY_IAM_ROLE 이 비면 언제나 거짓 — 사람이 돌릴 때는 위 사용자만 통과한다
caller_is_deploy_role() {
  [ -n "$DEPLOY_IAM_ROLE" ] \
    && [[ "$1" =~ ^arn:aws:sts::[0-9]{12}:assumed-role/([^/]+)/[^/]+$ ]] && [ "${BASH_REMATCH[1]}" = "$DEPLOY_IAM_ROLE" ]
}

step "자격 확인 — 프로필 ${AWS_PROFILE:-(기본)}, 기대하는 사용자 $DEPLOY_IAM_USER"
[ -z "$DEPLOY_IAM_ROLE" ] || printf '  또는 역할 %s (GitHub Actions)\n' "$DEPLOY_IAM_ROLE"
CALLER_ARN=''
if ! CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text | strip_cr)" || [ -z "$CALLER_ARN" ]; then
  [ "$APPLY" != 1 ] || die '누구로 실행하는지 확인하지 못했습니다(aws sts get-caller-identity). AWS_PROFILE 이 배포 프로필인지, 키가 살아 있는지 보세요(docs/배포.md 2.2). 아무것도 바꾸지 않았습니다.'
  warn '누구로 실행하는지 확인하지 못했습니다. 미리보기는 계속하지만 --apply 는 여기서 멈춥니다.'
else
  printf '  %s\n' "$CALLER_ARN"
  if ! caller_is_deployer "$CALLER_ARN" && ! caller_is_deploy_role "$CALLER_ARN"; then
    WRONG_USER="배포 전용 사용자($DEPLOY_IAM_USER)가 아닙니다. export AWS_PROFILE=lostfound-deploy 로 바꾸세요(docs/배포.md 2.2). 사용자 이름을 바꿨다면 DEPLOY_IAM_USER 에 그 이름을 넣으세요."
    [ -z "$DEPLOY_IAM_ROLE" ] || WRONG_USER="$WRONG_USER 역할로 돌린다면(GitHub Actions) 위 ARN 의 역할 이름이 $DEPLOY_IAM_ROLE 이어야 합니다(docs/배포.md 9.6)."
    [ "$APPLY" != 1 ] || die "$WRONG_USER 아무것도 바꾸지 않았습니다."
    warn "$WRONG_USER 미리보기는 계속하지만 --apply 는 여기서 멈춥니다."
  fi
fi

# ---- prune : 오래된 해시 파일 정리 -------------------------------------------
#
# 지워도 되는 옛 청크 = 그 청크를 부르는 옛 index.html 을 가진 탭이 더는 없을 만한 것.
# 옛 index.html 은 **지금 배포가 올라가기 전에만** 받을 수 있었다. 그러니 기준은 파일 날짜가 아니라 지금 배포의 날짜다.
#   - 파일마다 마지막으로 올라간 날짜로만 보면 틀린다 : 빌드 A(0일) → B(10일) 바로 뒤에 정리하면 A 의 청크는 10일 묵었지만
#     9일에 A 의 index.html 을 받은 탭이 아직 그것을 부른다
#   - 그래서 지금 배포된 index.html 이 PRUNE_DAYS 일을 넘긴 뒤에만 정리한다. 그러면 옛 청크를 부를 탭은
#     지금 배포 전에 열어 PRUNE_DAYS 일 넘게 새로고침하지 않은 탭뿐이다
#   - 조회(받기 · 날짜 · 목록)가 하나라도 실패하거나 모양이 낯설면 아무것도 지우지 않고 멈춘다

if [ "$MODE" = prune ]; then
  # 지금 배포된 index.html 과 dist 의 index.html 이 같아야 한다. 다르면 dist 가 배포된 빌드가 아니라서
  # "지금 쓰는 파일" 목록을 믿을 수 없다(배포 안 한 새 빌드로 정리하면 살아 있는 청크를 지운다)
  step '1/3 배포된 index.html 이 dist 와 같은지'
  # 임시 파일 대신 표준 출력(-)으로 받는다 — 윈도우의 aws.exe 는 Git Bash 의 /tmp 경로를 모른다
  if ! aws s3 cp "s3://$FRONT_BUCKET/index.html" - --only-show-errors | cmp -s - "$DIST/index.html"; then
    die '배포된 index.html 이 dist 와 다릅니다(또는 받지 못했습니다). 정리는 배포를 마친 그 dist 로만 합니다. 아무것도 지우지 않았습니다.'
  fi
  echo '  같습니다.'

  step "2/3 지금 배포가 $DAYS 일을 넘겼는지 (기준 $CUTOFF UTC 보다 먼저 올라갔어야 한다)"
  DEPLOYED_AT="$(aws s3api head-object --bucket "$FRONT_BUCKET" --key index.html --query LastModified --output text | strip_cr)" \
    || die '배포된 index.html 의 날짜를 받지 못했습니다. 아무것도 지우지 않았습니다.'
  [[ "$DEPLOYED_AT" =~ $ISO_UTC ]] \
    || die "index.html 날짜 모양을 모릅니다: $DEPLOYED_AT — AWS CLI v2 · cli_timestamp_format=iso8601(기본)인지 보세요. 아무것도 지우지 않았습니다."
  echo "  지금 배포 : $DEPLOYED_AT"
  if ! [[ "${DEPLOYED_AT:0:19}" < "$CUTOFF" ]]; then
    READY_AT="$(date -u -d "${DEPLOYED_AT:0:10} ${DEPLOYED_AT:11:8} UTC $DAYS days" '+%Y-%m-%d %H:%M UTC' 2>/dev/null)" || READY_AT=''
    printf '\n정리하지 않습니다. 지금 배포가 올라간 지 %d일이 안 돼서, 그 전에 옛 index.html 을 받아 둔 탭이 아직 옛 파일을 부를 수 있습니다.\n' "$DAYS"
    [ -z "$READY_AT" ] || printf '%s 뒤에 다시 돌리세요(그사이 다시 배포하면 그 배포부터 %d일).\n' "$READY_AT" "$DAYS"
    exit 0
  fi

  step "3/3 assets/ 에서 지금 빌드에 없고 $DAYS 일 넘게 다시 올라가지 않은 파일"

  declare -A KEEP=()
  for name in "${CURRENT_ASSETS[@]}"; do KEEP["assets/$name"]=1; done

  # 목록을 먼저 통째로 받는다. 받다가 실패하면(권한 · 연결) 반쯤 받은 목록으로 판단하지 않고 멈춘다
  LISTING="$(aws s3api list-objects-v2 --bucket "$FRONT_BUCKET" --prefix assets/ \
    --query 'Contents[].[LastModified,Key]' --output text | strip_cr)" \
    || die 'assets/ 목록을 받지 못했습니다. 아무것도 지우지 않았습니다.'

  STALE=()
  while IFS=$'\t' read -r modified key; do
    [ -n "$modified" ] && [ "$modified" != None ] || continue # 빈 줄 · 파일이 하나도 없을 때
    [[ "$modified" =~ $ISO_UTC ]] || die "목록의 날짜 모양을 모릅니다: $modified. 아무것도 지우지 않았습니다."
    # 지우는 것은 assets/ 아래의 평범한 이름뿐(IAM 도 assets/* 만 지울 수 있다). 낯선 이름이 섞이면 전부 멈춘다
    if ! [[ "$key" =~ ^assets/[A-Za-z0-9._~/-]+$ ]] || [[ "$key" == *..* ]]; then
      die "assets/ 목록에 예상 밖의 이름이 있습니다: $(printf '%q' "$key"). 아무것도 지우지 않았습니다."
    fi
    [ -z "${KEEP[$key]:-}" ] || continue
    [[ "${modified:0:19}" < "$CUTOFF" ]] || continue
    STALE+=("$key")
  done <<<"$LISTING"

  if [ "${#STALE[@]}" -eq 0 ]; then
    echo '지울 파일이 없습니다.'
    exit 0
  fi
  printf '  %s\n' "${STALE[@]}"
  if [ "$APPLY" != 1 ]; then
    printf '\n미리보기입니다(%d개). 지우려면 끝에 --apply 를 붙여 다시 실행하세요.\n' "${#STALE[@]}"
    exit 0
  fi
  for key in "${STALE[@]}"; do aws s3 rm "s3://$FRONT_BUCKET/$key" --only-show-errors; done
  printf '\n%d개를 지웠습니다.\n' "${#STALE[@]}"
  exit 0
fi

# ---- upload ----------------------------------------------------------------

step '빌드 점검'
grep -q '<meta http-equiv="Content-Security-Policy"' "$DIST/index.html" \
  || die 'dist/index.html 에 CSP meta 가 없습니다. `npm run build` 로 만든 결과인지 확인하세요(보안명세서 4장).'
# CSP 사진 출처(img-src)가 사진 CloudFront 인지 본다. 출처가 다르면 화면은 뜨는데 사진만 CSP 에 막힌다(배포.md 8장)
IMG_SRC="$(grep -o 'img-src [^;"]*' "$DIST/index.html" | strip_cr || true)"
[ -n "$IMG_SRC" ] || die 'dist/index.html 의 CSP 에 img-src 가 없습니다. `npm run build` 로 만든 결과인지 확인하세요(보안명세서 4장).'
case " ${IMG_SRC#img-src } " in
  *" $PHOTO_ORIGIN "*) ;;
  *) die "CSP 사진 출처에 $PHOTO_ORIGIN 이 없습니다($IMG_SRC). CSP_IMAGE_ORIGINS=$PHOTO_ORIGIN npm run build 로 다시 빌드하세요(보안명세서 9.2)." ;;
esac
if grep -q 'amazonaws\.com' <<<"$IMG_SRC"; then
  die "CSP 사진 출처에 S3 주소가 있습니다($IMG_SRC). 사진은 CloudFront 로만 받습니다 — CSP_IMAGE_ORIGINS=$PHOTO_ORIGIN 으로 다시 빌드하세요(보안명세서 9.2)."
fi
if grep -q 'http://' <<<"$IMG_SRC"; then
  die "CSP 사진 출처에 http 주소(로컬 목 서버)가 있습니다($IMG_SRC). CSP_IMAGE_ORIGINS=$PHOTO_ORIGIN 으로 다시 빌드하세요."
fi
if find "$DIST" -name '*.map' | grep -q .; then
  die '소스맵(.map)이 있습니다. 운영 빌드(npm run build)로 다시 만드세요(보안명세서 8장).'
fi

# 확장자별로 한 번씩 올린다. 모르는 확장자가 있으면 형식을 짐작하지 않고 멈춘다
mapfile -t ASSET_EXTS < <(printf '%s\n' "${CURRENT_ASSETS[@]}" | sed -n 's/.*\.\([A-Za-z0-9]*\)$/\1/p' | sort -u)
for ext in "${ASSET_EXTS[@]}"; do
  content_type "$ext" >/dev/null || die "assets/ 에 형식을 모르는 확장자가 있습니다: .$ext — 이 스크립트의 content_type 에 더하세요."
done

mapfile -t ROOT_FILES < <(cd "$DIST" && find . -type f ! -path './assets/*' ! -name index.html | sed 's|^\./||' | sort)
ROOT_FILES+=(index.html) # 맨 마지막
for key in "${ROOT_FILES[@]}"; do
  [[ "$key" == *.* ]] && content_type "${key##*.}" >/dev/null || die "형식을 모르는 파일입니다: $key"
done

[ "$APPLY" = 1 ] || echo '미리보기입니다. 아무것도 바꾸지 않습니다(끝에 --apply 를 붙이면 실제로 올립니다).'

step "1/3 assets/ — 해시 이름 · $IMMUTABLE · 지우지 않음"
for ext in "${ASSET_EXTS[@]}"; do
  aws s3 cp "$DIST/assets" "s3://$FRONT_BUCKET/assets" --recursive "${DRYRUN[@]}" --no-progress \
    --exclude '*' --include "*.$ext" \
    --content-type "$(content_type "$ext")" --cache-control "$IMMUTABLE"
done

step "2/3 해시 없는 파일 — $NO_CACHE · index.html 은 맨 마지막"
for key in "${ROOT_FILES[@]}"; do
  aws s3 cp "$DIST/$key" "s3://$FRONT_BUCKET/$key" "${DRYRUN[@]}" --no-progress \
    --content-type "$(content_type "${key##*.}")" --cache-control "$NO_CACHE"
done

step '3/3 CloudFront 무효화 — 해시 없는 파일만'
PATHS=()
for key in "${ROOT_FILES[@]}"; do PATHS+=("/$key"); done
if [ "$APPLY" = 1 ]; then
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "${PATHS[@]}" \
    --query 'Invalidation.[Id,Status]' --output text
  printf '\n끝났습니다. 무효화가 Completed 가 되면(보통 몇 분) 브라우저에서 확인하세요(docs/배포.md 6장).\n'
else
  echo "(미리보기) aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths ${PATHS[*]}"
fi
