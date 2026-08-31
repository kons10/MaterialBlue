# MaterialBlue 起動スプラッシュ Critical CSS 併合と `<picture>` 導入計画書

## 1. 目的

MaterialBlue の初回表示速度と画像配信効率を改善する。

具体的には以下を達成する。

- 起動スプラッシュ表示時に必要な CSS だけをインライン化し、初回ペイント (FP) と First Contentful Paint (FCP) を短縮する
- `<img>` 単体で配信されているユーザー画像（投稿・プロフィール・アバター）に対し、`<picture>` 要素と `srcset` を導入し、デバイスに応じた最適な画像サイズを選択できるようにする
- 既存の MaterialBlue 設計原則（静的アーキ・自己完結・Material Design 3）を崩さない
- 外部ビルドツールや新しいフロントエンドフレームワークは導入しない

スコープ外として以下を明示する。

- PWA Service Worker（要件上未対応）
- Content Security Policy (CSP) ヘッダー
- AVIF 形式への変換（Bluesky 側の画像 CDN 仕様に依存するため、本アプリ側では対応しない）
- レイアウト・タイポグラフィ・色トークンの変更

---

## 2. 最終的なファイル構成

### 開発リポジトリ

```text
MaterialBlue/
├── layouts/
│   ├── _default/
│   │   └── baseof.html      ← Critical CSS を <style> でインライン読み込み
│   └── partials/
│       ├── home/
│       │   └── loading.html ← 必要に応じて critical scope のクラス参照
│       └── critical/
│           └── splash.css.html ← Hugo partial 化したインライン CSS
│
├── static/
│   ├── css/
│   │   ├── tokens.css                  ← 既存。残置
│   │   ├── app.css                     ← 既存。残置（splash 関連を削除）
│   │   └── components-responsive.css   ← 既存。残置
│   │
│   └── src/
│       ├── main.js          ← 画像レンダラーを picture 対応に更新
│       ├── bsky-client.js   ← 必要に応じて画像 URL ビルダーを調整
│       └── ...
```

### Hugo ビルド後

```text
public/
├── index.html              ← <style>...</style> として critical CSS がインライン展開
├── css/
│   ├── tokens.css
│   ├── app.css
│   └── components-responsive.css
└── ...
```

---

## 3. Critical CSS 併合の仕様

### 3.1 対象範囲

起動スプラッシュ（`#startupSplash`）と、それを画面中央に配置するために必要な最小限のレイアウト骨格のみを critical 対象とする。

含めるもの:

- `body` のマージンリセットと `font-family`
- ルートカスタムプロパティのうち color / typography のごく一部
- `.startup-splash` の fixed 配置と backdrop
- `.startup-splash-card` のレイアウト
- `.startup-splash-logo` のアイコン色
- `.startup-splash-title` / `.startup-splash-text` のタイポグラフィ
- フェードアウト用 `.startup-splash.is-hidden`
- `prefers-reduced-motion: reduce` 対応

含めないもの:

- サイドバー (`#sidebar` / `.sidebar`)
- ヘッダー / メイン / フッター
- Material Web Components のスタイル
- レスポンシブメディアクエリ（Compact 未満の単一レイアウトで十分）
- アニメーション・トランジション詳細（reduced-motion 以外の細かい easing 等）

### 3.2 配信方法

Hugo partial `layouts/partials/critical/splash.css.html` を作成し、`layouts/_default/baseof.html` の `<head>` 内で以下の形で読み込む。

```html
{{ $critical := partial "critical/splash.css.html" . }}
{{ if $critical }}
<style>{{ $critical | safeCSS }}</style>
{{ end }}
```

partial の中身は、CSS を Hugo の文字列リテラルで直接記述する。Hugo の `resources.ExecuteAsTemplate` 等は使わず、シンプルに Hugo partial の戻り値として CSS 文字列を返す形式とする。

これにより:

- Hugo の標準機能のみで完結する
- ビルド時に静的化され、ランタイムで fetch が発生しない
- 既存の Hugo minify 設定 (`minifyOutput: true`) と共存する

### 3.3 既存 CSS との重複整理

`static/css/app.css` に定義されている `.startup-splash*` クラス群を、critical 化に合わせて整理する。

方針:

- critical 化したスタイルは `app.css` から削除する
- critical と同等の宣言が `app.css` に残っている場合は削除して重複を排除する
- 同じクラスを critical 側と `app.css` 側の両方で定義する状態は作らない
- reduced-motion 関連のルールは critical 側のみに残す（splash は初期表示で必要なため）

### 3.4 読み込み順序

`baseof.html` の `<head>` 内の順序は以下とする。

1. `<meta>` タグ（既存）
2. preconnect / Google Fonts / Material Symbols（既存）
3. **追加**: Critical CSS の `<style>` インライン
4. `tokens.css` / `app.css` / `components-responsive.css`（既存・非ブロッキング化）
5. ESM スクリプト群（既存）

### 3.5 非ブロッキング化

`tokens.css` / `app.css` / `components-responsive.css` の3ファイルは critical 化に伴い、`<link rel="preload" as="style" onload="...">` パターンで非ブロッキング読み込みに変更する。

ただし `AGENTS.md` の方針「Web Platform API 優先」「抽象化を最小化」と整合させるため、以下のいずれかで対応する。

- `<link rel="preload" as="style">` + インライン後続スクリプトでの `rel` 切替
- もしくは、`<link rel="stylesheet" media="print" onload="this.media='all'">` の従来パターン

スクリプトの差し替えが複雑になる場合は、当面 `<link rel="stylesheet">` のままにし、critical のインライン化だけ先行する。判断は実装時に確定する。

---

## 4. `<picture>` 導入の仕様

### 4.1 対象

MaterialBlue でユーザー画像が表示されるすべての箇所を `<picture>` 化する。

主に対象となる DOM 生成元:

- 投稿カード内のメディア（Bluesky `embed.images`）
- プロフィールアバター
- 投稿者アイコン（small / large）
- 通知画面のアクターアイコン

これらはすべて JavaScript (`static/src/main.js` および `notifications-preview.js`) で動的生成されるため、画像レンダリングのヘルパー関数を 1 箇所に集約し、そこを `<picture>` 化することが現実的。

### 4.2 srcset 設計

Bluesky の画像 CDN はクエリパラメータでリサイズを制御できる。URL の基本形は `https://cdn.bsky.app/img/...` であり、サイズ変更の仕組みは公式ドキュメントに従う。

`srcset` は以下の3〜4段階を候補とし、ヘルパー関数で URL を組み立てる。

| 用途 | 横幅目安 | 想定 DPR |
|---|---|---|
| 極小（通知アイコン等） | 64px | 1x / 2x |
| 小（投稿者アイコン） | 96px | 1x / 2x |
| 中（プロフィール） | 256px | 1x / 2x |
| 大（投稿メディア thumb） | 512px | 1x / 2x |
| 拡大（投稿メディア full） | 1024px | 1x / 2x |

`srcset` の記述子は `w` 形式（`512w` など）を使い、`sizes` 属性で実際の表示サイズをブラウザに伝える。

例:

```html
<picture>
  <img
    src="...512w..."
    srcset="...256w 256w, ...512w 512w, ...1024w 1024w"
    sizes="(max-width: 599px) 100vw, 512px"
    loading="lazy"
    decoding="async"
    alt="..."
  >
</picture>
```

`<picture>` 自体は `<source>` を持たない形で開始する。将来的に AVIF / WebP 配信が Bluesky 側で対応された場合は `<source type="...">` を追加するだけで済むよう、空の `<picture>` 構造を採用する。

### 4.3 lazy loading と非同期デコード

`<img>` には最低限以下を付与する。

- `loading="lazy"`（ファーストビュー外の画像）
- `decoding="async"`
- `alt` 属性（Bluesky 投稿本文から alt テキストを生成できない場合は空文字）

最初の数件の投稿など、初期表示で確実に表示される画像には `loading="eager"` + `fetchpriority="high"` を付与し、LCP 候補として優先させる。

### 4.4 フォールバック

`srcset` 非対応ブラウザ向けの `src` 属性は、sizes の中間の値（512w）を既定として設定する。`<picture>` 自体はすべての対象ブラウザでサポートされており、フォールバック不要。

### 4.5 ヘルパー関数の配置

画像 URL 組み立てと `<picture>` 文字列生成を担うヘルパー関数を `static/src/` 配下に新規追加する。

配置先案:

- `static/src/picture-renderer.js`（純粋な DOM ヘルパー）
- もしくは `static/src/bsky-client.js` 内に `buildPicture(blob, opts)` として追加

`bsky-client.js` は API 抽象化レイヤーであるため、DOM 文字列生成は別の `picture-renderer.js` に切り出すのが責務上きれい。判断は実装時に確定する。

---

## 5. 既存挙動・既存ファイルとの整合性

### 5.1 Hugo テンプレート

`layouts/_default/baseof.html` の `<head>` 構造を尊重する。`<style>` インラインは `preconnect` 群と既存 `<link>` の間に挿入する。

`<noscript>` ブロックは現状維持。ESM 非対応ブラウザ向けのフォールバックは触らない。

### 5.2 i18n

Critical CSS / `<picture>` いずれもローカライズ対象ではない。`i18n/` および `static/locales/` には変更を加えない。

### 5.3 Material Design 3

色トークン・タイポグラフィ・shape は既存の `--md-sys-*` 変数経由で参照する。Critical CSS 内で生の hex 値を直書きせず、critical に必要なトークンのみ `<style>` 内に再宣言する（CSS 変数の解決はブラウザの遅延解決に任せる）。

### 5.4 アイコン

Material Symbols および Material Web Components のスタイルには触らない。

### 5.5 レスポンシブ

critical 対象は Compact 幅（<600px）の単一レイアウトとする。Medium / Expanded 用のメディアクエリは critical には含めず、`components-responsive.css` のまま残す。

### 5.6 アクセシビリティ

- `<img alt>` は必須。代替テキストが無い画像には空文字 `alt=""` を明示的に付与し、装飾扱いとする
- `role="presentation"` の付与は `<picture>` 内 `<img>` では行わず、alt のみで表現する
- `prefers-reduced-motion: reduce` は critical CSS 内に含め、スプラッシュのフェード挙動を維持する

### 5.7 静的アーキ

Service Worker は導入しない。`public/` 出力に手を加える後処理は行わない。Hugo ビルドのみで完結する。

### 5.8 依存追加

新しい npm パッケージは追加しない。`<picture>` 化は標準 DOM API のみで実装する。`Image` プリロードヒント等を使いたい場合も、`<link rel="preload" as="image">` を JS で動的に差し込む純 DOM 実装とし、ヘルパライブラリは入れない。

---

## 6. 実装手順

### Phase 1: Critical CSS 抽出

1. `layouts/partials/critical/splash.css.html` を新規作成
2. `app.css` の `.startup-splash*` 関連宣言を critical 側へ移植
3. `app.css` 側の重複宣言を削除
4. `baseof.html` の `<head>` に `<style>` インライン展開を追加
5. `hugo` を実行し、`public/index.html` 内に `<style>` が出力されることを確認
6. ブラウザで `view-source:` してインライン展開を視覚確認

### Phase 2: 非ブロッキング CSS 読み込み

1. `tokens.css` / `app.css` / `components-responsive.css` の `<link>` タグを `<link rel="preload" as="style" ...>` パターンへ変更
2. インライン後続スクリプトで `rel="stylesheet"` への切替
3. critical インラインと合わせてスタイル順序の不整合がないことを目視確認

### Phase 3: 画像ヘルパー分離

1. `static/src/picture-renderer.js` を新規作成
2. URL ビルダー（`buildImageUrl(blob, width)`）と DOM ビルダー（`buildPicture(opts)`）を実装
3. 既存の画像表示ロジックを `main.js` / `notifications-preview.js` から呼び出すように置換

### Phase 4: `<picture>` への置換

1. 投稿メディア表示箇所を `<picture>` 化
2. アバター / アイコン箇所を `<picture>` 化
3. `loading` / `decoding` / `fetchpriority` を各画像に付与
4. 必要に応じて `sizes` を調整

### Phase 5: 検証

1. `hugo` ビルド成功
2. 開発サーバーで起動し、DevTools の Network タブで:
   - critical CSS が HTML 内インライン化されていること
   - CSS 外部ファイルが preload → 切替の順で取得されていること
   - `<picture>` 化済み画像が適切なサイズで取得されていること
3. DevTools の Lighthouse を実行し、Performance スコアが改善していることを確認
4. 320px / 600px / 900px / 1200px の各幅でレイアウト崩れがないこと
5. 既存のスプラッシュアニメーションが `prefers-reduced-motion: reduce` 設定時にスキップされることを確認
6. スクリーンリーダー（NVDA / VoiceOver）で `<picture>` 内の画像が読み上げられることを確認

---

## 7. 判断保留事項

実装中に確定すべき点。

- 画像 URL のサイズクエリ仕様は Bluesky 公式ドキュメントの最新版に従う。仕様変更があれば srcset の段階を再設計する
- 既存の `<img loading="lazy">` 等が既に部分的に付与されているか否かを `main.js` 全体で確認し、二重付与を避ける
- 非ブロッキング CSS の切替スクリプトを `<style>` 末尾に同梱するか、`app.js` 初期化に統合するか
- 通知画面の画像はサイズパターンが限られるため、ヘルパー関数のオプションで段階数を切り替えられるようにする

---

## 8. 想定影響範囲

- 編集対象ファイル: 約 5〜7 ファイル
  - `layouts/_default/baseof.html`
  - `layouts/partials/critical/splash.css.html`（新規）
  - `static/css/app.css`
  - `static/src/main.js`
  - `static/src/bsky-client.js`（必要に応じて）
  - `static/src/notifications-preview.js`（必要に応じて）
  - `static/src/picture-renderer.js`（新規）
- 追加 npm 依存: なし
- 追加 Hugo 設定: なし
- 追加 CDN: なし
- i18n 翻訳データ: 変更なし
- ドキュメント更新: なし（本仕様書が正）
