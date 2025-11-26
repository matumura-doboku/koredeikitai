document.addEventListener('DOMContentLoaded', () => {
  const overlay   = document.getElementById('intro-overlay');
  const introHtml = document.getElementById('intro-html');
  const checkbox  = document.getElementById('intro-agree-checkbox');
  const startBtn  = document.getElementById('intro-start-btn');

  // 要素が無ければ何もしない（テキスト挿入用の要素は任意）
  if (!overlay || !checkbox || !startBtn) return;

  // すでに同意済みならオーバーレイを非表示にして終了
  const agreed = localStorage.getItem('impact_terms_agreed');
  if (agreed === '1') {
    overlay.classList.add('hidden');
    return;
  }

  // 案内文（HTML）をJS内に保持して、そのまま差し込む
  const introText = `【概要】

本システムは、通行止め時の交通影響を、地図上で即座に確認できる簡易シミュレーションツールです。
施工管理・規制計画・現場検討などで、初期の影響範囲や混雑ポイントを素早く把握すること、説明会での説明資料の役割を目的としています。

ブラウザ上で動作し、PCのみで利用できます（インストール不要）。

【主な機能】
1. 通行止め設定

道路区画をクリックするだけで、対象道路区画を通行止め状態に設定できます。

2. 移動経路選択

規制時に想定される代替ルートを、地図上で選択して確認できます。

3. 交通量の簡易計算

代表区画からの推計ロジックを用いて、幹線・生活道を区分した簡易的な交通量推計を実行します。

4. 影響データの集計（半径500m）

通行止め地点または移動経路起点から、半径500m以内の道路区画を自動抽出し、

距離

交通量

渋滞率R

推定容量
を一覧で
上位20区画を自動選別します。

5. 地図上での可視化

交通量や渋滞率に応じて、道路リンクが色分け表示されます。
規制の影響範囲も円（500m）で表示され、俯瞰が容易です。

6. レポート出力・CSV出力

計算結果をCSV形式でダウンロードでき、社内資料や報告作成に利用できます。

【想定される利用シーン】

規制計画の事前検討

施工管理会社の内部チェック

簡易な交通影響の把握

現場の打ち合わせ準備

説明資料用の参考データ作成

本ツールは 「精度よりも、スピードと直感的操作」 を重視して設計しています。

【本システムに使用している交通量の元データと計算方法について】

政府統計ポータルサイト（e-stat）の統計データをもとに独自の計算方法により区画単位での交通量計算を行っております

【ご利用にあたって】（重要）

本ツールの計算結果は 簡易推計値 であり、
実測データの完全な再現性や、正確性を保証するものではありません。

通行止め・規制の最終判断

公共交通の管理

住民説明・行政判断

などには、必ず実測・現地確認・正式な交通量調査の結果をご参照ください。

このシステムは実験公開版のため実際の計算値に補正をした値を持ちています。その点はご了承ください。

本ツールの利用により生じたいかなる損害についても、開発者は責任を負いません。`;

  if (introHtml) {
    introHtml.innerHTML = `<pre class="intro-pre">${introText}</pre>`;
  }

  // チェックが入るまでボタンは押せない
  checkbox.addEventListener('change', () => {
    startBtn.disabled = !checkbox.checked;
  });

  // 同意 → フラグ保存 → オーバーレイを閉じる
  startBtn.addEventListener('click', () => {
    if (!checkbox.checked) return;
    localStorage.setItem('impact_terms_agreed', '1');
    overlay.classList.add('hidden');
  });
});
