
// js/addr-normalize-ja.js
// 日本住所の軽量正規化・構造化（丁目・番・号、漢数字→算用）

const KANJI_NUM = { '〇':0,'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
function kanjiToNumber(s) {
  // 非常に簡易（10の位まで）。十分でない場合は拡張してください。
  if (!s) return null;
  let total = 0; let tmp = 0; let has = false;
  for (const ch of s) {
    if (ch in KANJI_NUM) {
      has = true;
      const v = KANJI_NUM[ch];
      if (v === 10) {
        tmp = (tmp || 1) * 10;
        total += tmp; tmp = 0;
      } else {
        tmp = tmp + v;
      }
    } else if (/\d/.test(ch)) {
      has = true; tmp = tmp*10 + Number(ch);
    }
  }
  total += tmp;
  return has ? total : null;
}

/**
 * "香川県、広島市、山中町３－１－２" のような表記を正規化して分割
 * @param {string} input
 * @returns {{raw:string, prefecture?:string, city?:string, ward?:string, town?:string, chome?:number, banchi?:string, go?:string, rest?:string, normalized:string}}
 */
export function normalizeJapaneseAddress(input) {
  let raw = (input || "").trim();
  // 全角→半角、空白正規化、読点→カンマ
  let s = raw.replace(/[　\s]+/g, " ").replace(/[、，]/g, ",").replace(/－/g, "-");
  // カンマで大まかに分割
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);

  // 都道府県推定（末尾が都|道|府|県）
  const prefRe = /(.*?)(都|道|府|県)$/;
  let prefecture, rest = "";
  for (const p of parts) {
    const m = p.match(prefRe);
    if (m) { prefecture = p; continue; }
    rest += (rest ? " " : "") + p;
  }
  if (!prefecture) { // 文中に混ざっている場合も試みる
    const m2 = s.match(/([^,\s]+?[都道府県])/);
    if (m2) prefecture = m2[1];
    rest = s.replace(prefecture||"", "").trim();
  }

  // 市区町村・丁目番地号の抽出（簡易）
  let city = (rest.match(/([^,\s]+市)/) || [])[1] || "";
  let ward = (rest.match(/([^,\s]+区)/) || [])[1] || "";
  let town = (rest.match(/([^,\s]+(町|村))/) || [])[1] || "";
  if (city) rest = rest.replace(city, "");
  if (ward) rest = rest.replace(ward, "");
  if (town) rest = rest.replace(town, "");

  // 丁目-番-号（漢数字も許容）
  // 例: ３-１-２ / 三丁目1番2号 / 3丁目1-2
  let chome = null, banchi = "", go = "";
  const chomeRe = /([一二三四五六七八九十\d]+)\s*丁目/;
  const mChome = rest.match(chomeRe);
  if (mChome) {
    chome = kanjiToNumber(mChome[1]) ?? Number(mChome[1]);
    rest = rest.replace(chomeRe, "");
  }
  // 残りから 番/号/ハイフン連結 を抽出
  const nums = rest.match(/(\d+)(?:\s*番)?(?:\s*地)?(?:\s*[-－‐ー]\s*(\d+))?(?:\s*号)?/);
  if (nums) {
    banchi = nums[1] || "";
    go = nums[2] || "";
  }

  const normalized = [prefecture, city, ward, town, (chome? `${chome}丁目`:""), banchi && `${banchi}番`, go && `${go}号`]
    .filter(Boolean).join(" ");

  return { raw, prefecture, city, ward, town, chome, banchi, go, rest: rest.trim(), normalized };
}
