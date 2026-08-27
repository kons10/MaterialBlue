# MaterialBlue i18n 実装仕様書

## 1. 目的

MaterialBlueに本格的な国際化（i18n）基盤を導入する。

現在の日本語・英語対応だけでなく、将来的に韓国語、中国語、フランス語、ドイツ語などの言語を追加しても、既存コードへの変更を最小限にできる構成を目指す。

基本方針は以下。

- Hugoのi18n機能は静的コンテンツ・テンプレートの翻訳に使用する
- JavaScriptで動的に生成されるUIは独自の軽量i18nレイヤーで翻訳する
- 言語ごとにHTML全体を複製しない
- 翻訳データをUIコードから分離する
- Web標準の`Intl` APIを積極的に利用する
- 外部i18nライブラリへの依存は原則として追加しない

---

## 2. 最終的なディレクトリ構成

### 開発リポジトリ

```text
MaterialBlue/
├── content/
├── layouts/
│
├── i18n/
│   ├── ja.yaml
│   └── en.yaml
│
├── static/
│   ├── locales/
│   │   ├── ja.json
│   │   └── en.json
│   │
│   ├── js/
│   └── ...
│
└── hugo.yaml
```

### Hugoビルド後

```text
public/
├── index.html
├── settings/
│   └── index.html
│
├── locales/
│   ├── ja.json
│   └── en.json
│
├── assets/
│   ├── app.js
│   └── style.css
│
└── ...
```

言語ごとに`/ja/`、`/en/`以下へサイト全体を複製する方式は採用しない。

---

## 3. i18nの責務分離

MaterialBlueでは、i18nを2層に分ける。

### Hugo i18n

対象:

- Hugoテンプレート
- 静的ページ
- ページタイトル
- 静的ナビゲーション
- メタデータ
- ビルド時に確定する文字列

ファイル:

```text
i18n/ja.yaml
i18n/en.yaml
```

### JavaScript i18n

対象:

- 動的UI
- Bluesky APIの状態に応じて生成されるUI
- ダイアログ
- Snackbar
- Tooltip
- 動的ボタン
- エラーメッセージ
- ローディング表示
- JavaScriptから生成するアクセシビリティラベル

ファイル:

```text
static/locales/ja.json
static/locales/en.json
```

---

## 4. 翻訳キー

UIコードに日本語・英語の文章を直接記述しない。

### 推奨

```text
common.cancel
common.save
navigation.home
navigation.notifications
settings.title
settings.language
post.delete
errors.network
```

### 非推奨

```text
cancel_button
save_button
delete_button
japanese_cancel
english_cancel
```

翻訳キーは「表示される文章」ではなく「その文章の意味・用途」を表すものとする。

一度公開した翻訳キーは、表示文言が変更されても原則変更しない。

---

## 5. 翻訳ファイル

### 日本語

`static/locales/ja.json`

```json
{
  "common.cancel": "キャンセル",
  "common.save": "保存",
  "navigation.home": "ホーム",
  "navigation.notifications": "通知",
  "settings.title": "設定",
  "settings.language": "言語"
}
```

### 英語

`static/locales/en.json`

```json
{
  "common.cancel": "Cancel",
  "common.save": "Save",
  "navigation.home": "Home",
  "navigation.notifications": "Notifications",
  "settings.title": "Settings",
  "settings.language": "Language"
}
```

全localeで同じキー体系を維持する。

---

## 6. JavaScript i18n API

アプリケーションコードからは、直接翻訳JSONを参照しない。

以下のような単純なAPIを提供する。

```js
t("common.save")
```

例:

```js
button.textContent = t("common.save");
```

属性の場合:

```js
button.setAttribute("aria-label", t("navigation.home"));
```

翻訳システム内部で、

1. 現在のlocaleを取得
2. 対応する翻訳データを取得
3. キーを検索
4. 翻訳文字列を返す

という処理を行う。

---

## 7. 翻訳ファイルのロード

必要なlocaleのみロードする。

例えば日本語の場合:

```text
/locales/ja.json
```

英語の場合:

```text
/locales/en.json
```

全言語のJSONを最初からロードしてはいけない。

可能であればfetch結果をメモリ内にキャッシュし、同一セッション中に同じlocaleを何度も取得しない。

---

## 8. locale決定ルール

localeの決定優先順位:

```text
1. ユーザーが設定した言語
2. localStorage等に保存された言語
3. navigator.languages
4. navigator.language
5. デフォルトlocale
```

デフォルトlocaleは現在の主要言語である`ja`とする。

---

## 9. localeフォールバック

完全一致しないlocaleにも対応する。

例えば:

```text
en-US
```

の場合:

```text
en-US
 ↓
en
 ↓
ja
```

の順でフォールバックする。

同様に:

```text
zh-TW
```

などについても、適切なlanguage fallbackを実装する。

翻訳キーが存在しない場合は、デフォルトlocaleから取得する。

それでも存在しない場合は、翻訳キーそのものを返す。

開発環境では翻訳漏れを検出しやすいよう、必要に応じて警告をconsoleへ出す。

---

## 10. ユーザー設定

設定画面に言語設定を追加する。

例:

```text
Language
○ 日本語
○ English
```

言語変更後は、ページ全体を再読み込みしてもよい。

ただし将来的に実装可能なら、ページリロードなしでUIを更新できる設計を妨げないこと。

ユーザーが明示的に選択したlocaleは保存する。

---

## 11. HTMLのlang属性

現在のlocaleに合わせて、

```html
<html lang="ja">
```

または

```html
<html lang="en">
```

を設定する。

JavaScriptでlocaleを変更した場合も、

```js
document.documentElement.lang = locale;
```

によって更新できる構造にする。

---

## 12. 日付・時刻

日付・時刻を文字列として翻訳ファイルに保存してはいけない。

必ず`Intl.DateTimeFormat`を利用する。

例:

```js
new Intl.DateTimeFormat(locale)
```

Blueskyの投稿日時、通知日時など、ユーザーのlocaleに応じて表示形式が変化するものは特にこの方式を利用する。

---

## 13. 数値

数値表示には`Intl.NumberFormat`を使用する。

例:

```js
new Intl.NumberFormat(locale)
```

対象:

- フォロワー数
- フォロー数
- いいね数
- リポスト数
- その他の数量

---

## 14. ユーザー生成コンテンツ

以下は翻訳対象外とする。

- Blueskyユーザーの投稿本文
- ユーザー名
- 表示名
- プロフィール文
- 外部サイトから取得した文章
- APIから取得したユーザー生成コンテンツ

「アプリのUI」と「ユーザーが作成したコンテンツ」を明確に区別する。

---

## 15. 翻訳対象にしてはいけないもの

以下を自動翻訳してはいけない。

- AT Protocol / Blueskyの識別子
- DID
- handle
- URI
- URL
- APIレスポンスの生データ
- 投稿本文
- コード
- ユーザーが入力した文字列

---

## 16. アクセシビリティ

表示テキストだけでなく、アクセシビリティ関連の文字列もi18n対象とする。

対象:

- `aria-label`
- `aria-description`
- `title`
- Tooltip
- Snackbar
- Dialog
- スクリーンリーダー向けテキスト

例えば、

```html
aria-label="ホーム"
```

をHTMLに直接ハードコードしない。

---

## 17. 翻訳キーの名前空間

今後の規模拡大を考え、カテゴリごとにnamespaceを分ける。

推奨:

```text
common.*
navigation.*
settings.*
post.*
profile.*
notifications.*
errors.*
accessibility.*
```

例:

```text
post.delete
post.reply
post.repost
post.like

settings.language
settings.appearance

errors.network
errors.authentication
```

---

## 18. 翻訳漏れ対策

CIまたは開発用スクリプトで、locale間のキー差分を検査できるようにする。

例えば、

```text
ja.json
    common.save
    common.cancel
    settings.language

en.json
    common.save
    common.cancel
```

の場合、

```text
Missing translation:
en.json -> settings.language
```

のように検出する。

翻訳キーの追加時に、他localeへの追加忘れを発見できること。

---

## 19. パフォーマンス

i18n導入によって初期ロードを不必要に重くしない。

原則:

- 使用localeのみロード
- 翻訳JSONをキャッシュ
- 全言語の翻訳を1ファイルにまとめない
- 巨大なi18nライブラリを追加しない
- 静的コンテンツは可能な限りHugoで事前生成する

---

## 20. 将来の言語追加

新しい言語を追加する場合、

```text
static/locales/ko.json
```

などを追加するだけで基本的な対応が可能な構造にする。

例:

```text
static/locales/
├── ja.json
├── en.json
├── ko.json
├── zh-CN.json
├── zh-TW.json
├── fr.json
└── de.json
```

アプリケーションコード側に、

```js
if (locale === "ko") ...
```

のようなlocale依存の分岐を大量に追加してはいけない。

---

# 21. 実装上の重要原則

### MUST

- UI文字列をコードへ直接ハードコードしない
- 翻訳キーを使用する
- 翻訳データをUIコードから分離する
- `Intl.DateTimeFormat`を使用する
- `Intl.NumberFormat`を使用する
- `html[lang]`をlocaleと同期する
- locale fallbackを実装する
- 翻訳漏れを検出できるようにする
- ユーザー生成コンテンツを勝手に翻訳しない

### SHOULD

- 外部i18nライブラリを追加しない
- 翻訳JSONをlocaleごとに分離する
- 翻訳データをキャッシュする
- namespaceを使用する
- 将来の10言語以上への拡張を想定する

### MUST NOT

- 言語ごとにHTML全体を複製する
- `if (language === "ja")` のような翻訳目的の条件分岐をUI全体に大量配置する
- 翻訳文をJSコードへ直接埋め込む
- 全localeの翻訳を1つの巨大JSファイルへまとめる
- ユーザー投稿をUI翻訳システムで置換する

---

# 22. 完成形

最終的には、以下の構造を目標とする。

```text
                  MaterialBlue
                       │
             ┌─────────┴─────────┐
             │                   │
          Hugo                JavaScript
             │                   │
        静的コンテンツ        動的UI
             │                   │
        Hugo i18n             i18n API
             │                   │
       i18n/*.yaml          locales/*.json
             │                   │
             └─────────┬─────────┘
                       │
                    locale
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
         ja           en           ko
```

この設計では、MaterialBlueが大きくなっても「翻訳機能そのもの」と「アプリケーション機能」が疎結合のまま維持される。

**既存機能を壊さず、段階的にi18n対応できることを最優先とする。**

まず`ja`/`en`で基盤を完成させ、その後の言語追加が容易になることを確認する。
