# /js/system seed (v1)
生成日: 2025-09-14 09:58:28

このパッケージは **表示・計算ロジックの“契約”だけ** を先に固定するための雛形です。
DOM操作やマップ描画は含みません（既存UIから関数を呼び出す想定）。

## 想定パス
- /data/segments.csv  … 列: `区間番号,start_x,start_y,end_x,end_y`
- /data/traffic.csv   … 列: `交通量調査単位区間番号, 上り・下りの別, 代表車線数, 時間帯別…`

## 主要API（この順で呼べばOK）
1. `loadSegmentsCSV('/data/segments.csv')` → `segments[]`
2. `loadTrafficCSV('/data/traffic.csv')` → `traffic[]`
3. `joinSegmentsTraffic(segments, traffic)` → `records[]`（結合済み）
4. `computeHourMetrics(records, hour)` → 指定時刻の V, C, VC, rank を付与
   - `hour` は 0〜23（UIのスライダーに連動）
5. （任意）`proportionateDiversion(records, closedIds, hour, hop=3)` → 迂回配分

## 注意点
- 方向は `上り・下りの別` の **1→'up' / 2→'down'** に正規化（その他値はそのまま）
- 容量：`C = 1800 × lanes`（代表車線数）
- VCランク閾値：`<0.70 余裕 / 0.70–0.90 混雑 / 0.90–1.00 飽和 / >1.00 容量超`

## 役割分担
- data-mapper.js … CSVロード、列名の和名→共通キーのマッピング、結合
- compute-spec.js … 計算式、VCランク、比例再配分の核
- ui-spec.js      … レイヤID・凡例・入出力契約など“見た目のルール”定義のみ