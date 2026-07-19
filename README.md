# Revify Custom CSS Block

WordPressのブロックエディター上で、ページ単位・親ブロック単位のCSSを管理するためのプラグインです。

## 概要

- ブロック名: カスタムCSS
- 設定画面: 設定 > Revify CSS変数
- GitHubリポジトリ名: `revify-custom-css-block`
- Git Updater対応: 対応
- バージョン: 3.0.0

## 主な機能

- 基本CSS、960px以上、959px以下、599px以下の4タブ入力
- `selector` 記法による親ブロック単位のCSSスコープ
- `selector` を使わないページ内共通CSS
- フロント側CSSのhead集約
- 編集画面リアルタイムプレビュー
- iframe版ブロックエディター・デバイスプレビュー対応
- Revify CSS変数設定
- スコープ異常の警告表示
- 簡易括弧チェック
- デバッグ情報表示

## 使い方

### 親ブロックに限定してCSSを書く

```css
selector {
  padding: 40px;
}

selector .__item {
  border-radius: 8px;
}
```

`selector` は、カスタムCSSブロックを囲んでいる親ブロックの `.revify-scope-*` クラスへ置換されます。

### ページ内共通CSSとして使う

ページ上部にカスタムCSSブロックを置き、`selector` を使わずに通常のCSSを書きます。

```css
.u-secTitle {
  font-size: 3.2rem !important;
}

#top_title_area {
  display: none;
}
```

この使い方は、SWELLのカスタムCSS欄を編集画面でリアルタイム確認しやすくする用途に向いています。

## 安定性方針

このプラグインは「検知して知らせるが、勝手に直さない」方針です。

やらないこと:

- 保存済み投稿本文の自動再構築
- スコープIDの自動修復
- 親ブロックclassNameの自動整理
- 古いスコープクラスの自動削除
- 親なし `selector` の `body` への自動置換
- CSSの自動整形・自動修正

## Git Updater

Git Updaterで更新できるよう、プラグインヘッダーに以下を入れています。

```php
GitHub Plugin URI: https://github.com/hakubi-git/revify-custom-css-block
Primary Branch: main
```

## 開発・ZIP作成

```bash
bash scripts/build-zip.sh
```

`dist/revify-custom-css-block-3.0.0.zip` が生成されます。

## 更新配布について

このプラグインは `plugin-update-checker` を使い、GitHub の公開リポジトリから更新確認できる構成です。

- Repository: `https://github.com/hakubi-git/revify-custom-css-block`
- Slug: `revify-custom-css-block`
- Release ZIP: `revify-custom-css-block-x.x.x.zip`

通常の利用者は、このリポジトリの Release に添付された ZIP を WordPress 管理画面からインストールします。
以後、バージョンが上がると WordPress 管理画面に更新通知が出る想定です。

### リリース手順

1. `revify-custom-css-block.php` の `Version` と `REVIFY_CCB_VERSION` を更新する
2. 必要に応じて `readme.txt` と `CHANGELOG.md` を更新する
3. GitHub に push する
4. `v3.0.1` のようなタグを作成して push する
5. GitHub Actions が Release ZIP を生成し、Release に添付する

```bash
git tag v3.0.1
git push origin v3.0.1
```

