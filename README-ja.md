***静的な、美しさ***

[English](README.md) | [日本語]

# Static Bluesky Client

[Hugo](https://gohugo.io/) と [Material Web Components](https://github.com/material-components/material-web) で作った静的 Bluesky クライアントだよ。

## 機能

- **ログイン** — Bluesky のハンドルとアプリパスワードでサインイン
- **タイムライン** — ホームタイムラインの取得・表示
- **投稿** — テキスト投稿の作成
- **画像アップロード** — 1投稿につき最大4枚まで添付可能
- **セッション保持** — Cookie にログイン状態を保存するのでリロードしても継続ログイン
- **レスポンシブ UI** — Material Design 3 コンポーネントを使用

## 使用技術

| 役割 | 技術 |
|---|---|
| 静的サイトジェネレーター | [Hugo](https://gohugo.io/) v0.140.0 以上 |
| UI コンポーネント | [Material Web Components](https://github.com/material-components/material-web)（esm.sh 経由） |
| Bluesky API | [@atproto/api](https://www.npmjs.com/package/@atproto/api) v0.13.6（esm.sh 経由） |
| フォント | Google Fonts — Roboto, Material Symbols Outlined |

## はじめかた

### 必要なもの

- Hugo extended v0.140.0 以上

### インストール

```bash
git clone https://github.com/kons10/materialblue.git
cd materialblue
```

### ローカルで動かす

```bash
hugo server
```

ブラウザで `http://localhost:1313` を開いてね。

### ビルド

```bash
hugo
```

`public/` ディレクトリに出力されるよ。

## デプロイ

GitHub Pages・Cloudflare Pages・Netlify などの静的ホスティングに対応してるよ。

デプロイ前に `hugo.yaml` の `baseURL` を実際の URL に変えてね：

```yaml
baseURL: 'https://hogehoge.jp/'
```

このアプリケーションは必ずドメイン直下の `/` ディレクトリに配置してください。そうしないと、正常に動作しない可能性があります。

## 使いかた

1. ブラウザでアプリを開く
2. Bluesky の **ハンドル**（例：`user.bsky.social`）と **アプリパスワード** を入力
   - アプリパスワードの発行はこちら：**Bluesky 設定 → プライバシーとセキュリティ → アプリパスワード**
3. **ログイン** をクリック
4. タイムラインが自動的に表示される

> **注意：** 入力した認証情報は `bsky.social` 以外には送信されません。セッショントークンはブラウザの Cookie にのみ保存されます。

## プロジェクト構成

```
.
├── content/
│   └── _index.md          # トップページのフロントマター
├── layouts/
│   ├── _default/
│   │   └── baseof.html    # 基本 HTML テンプレート（ヘッダー・フッター・MWC 設定）
│   └── index.html         # トップページテンプレート（ログイン + タイムライン UI）
├── static/
│   └── src/
│       └── bsky-client.js # Bluesky API クライアントラッパー
└── hugo.yaml              # Hugo の設定ファイル
```

## ライセンス

[Apache License 2.0](LICENSE) でライセンスされてるよ。
