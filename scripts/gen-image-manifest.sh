#!/usr/bin/env sh
# 扫描 index/images/ 下图片（含子目录），重写 manifest.json。无需 Python/Node。
# 用法：sh scripts/gen-image-manifest.sh   （在 index 目录下执行亦可：sh scripts/gen-image-manifest.sh）
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
IMG="$ROOT/images"
mkdir -p "$IMG"
OUT="$IMG/manifest.json"
TMP="${OUT}.tmp"

cd "$IMG" || exit 1

# 仅列出相对 images/ 的路径，一行一个
find . -type f \
	\( \
		-iname '*.webp' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \
		-o -iname '*.gif' -o -iname '*.avif' -o -iname '*.bmp' -o -iname '*.svg' \
	\) \
	! -name 'manifest.json' \
	| sed 's|^\./||' \
	| sort \
	| awk '
function esc(s,   o,i,n,c) {
	n = length(s)
	o = "\""
	for (i = 1; i <= n; i++) {
		c = substr(s, i, 1)
		if (c == "\\") o = o "\\\\"
		else if (c == "\"") o = o "\\\""
		else if (c == "\n") o = o "\\n"
		else if (c == "\r") o = o "\\r"
		else if (c == "\t") o = o "\\t"
		else o = o c
	}
	return o "\""
}
BEGIN { n = 0 }
{ lines[++n] = $0 }
END {
	if (n == 0) { print "[]"; exit }
	print "["
	for (i = 1; i <= n; i++) {
		if (i > 1) printf ",\n"
		printf "  %s", esc(lines[i])
	}
	print "\n]"
}
' > "$TMP"
mv "$TMP" "$OUT"
echo "Wrote $OUT"
