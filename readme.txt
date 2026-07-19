=== Revify Custom CSS Block ===
Contributors: revify
Tags: custom css, block editor, gutenberg, responsive css
Requires at least: 6.5
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 3.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

ブロックエディターに、ページ単位・親ブロック単位で使えるカスタムCSSブロックを追加します。

== Description ==

Revify Custom CSS Block は、ブロックエディター上で見た目を確認しながらCSSを調整するためのプラグインです。

* 「カスタムCSS」ブロックを追加します。
* 基本、960px以上、959px以下、599px以下の4つの入力欄を用意します。
* `selector` と書くと、このカスタムCSSブロックを囲んでいる親ブロックの `.revify-scope-*` クラスへ置換されます。
* `selector` を使わない通常CSSは、ページ内共通CSSとしてそのページ全体に出力されます。
* 通常の投稿・固定ページでは、ページ内のCSSを1つに集約してheadへ出力します。
* 動的コンテンツなど事前収集できない場合のみ、ブロック位置へフォールバック出力します。
* 編集画面プレビュー、iframeキャンバス、デバイスプレビュー切り替えに対応します。
* 管理画面の「設定 > Revify CSS変数」から、サイト全体で使用するCSS変数を管理できます。

== Safety Policy ==

このプラグインは、安定性を優先します。

* 保存済み投稿本文を自動で再構築しません。
* 親ブロックのclassNameを保存時に一括整理しません。
* 古いスコープクラスを自動削除しません。
* scopeIdを保存時に自動同期しません。
* 親なしの `selector` を `body` へ自動置換しません。

異常が疑われる場合は、編集画面に警告またはデバッグ情報を表示します。

== Warnings ==

以下の状態を検知した場合、編集画面のカスタムCSSブロック内に警告を表示します。

* `selector` を使っているのに、対象となる親ブロックが見つからない場合。
* 親ブロックに `revify-scope-*` クラスが複数ある場合。
* CSSブロックの `scopeId` と親ブロックの `revify-scope-*` が一致しない場合。
* `{` と `}` の数が一致していない可能性がある場合。

警告は表示のみです。プラグインが自動修正することはありません。

== Security ==

カスタムCSSはサイト表示を変更できます。管理者など、unfiltered_html権限を持つユーザーによる利用を想定しています。
外部CDNや独自の外部通信は行いません。GitHub経由の更新は Git Updater に委ねます。

== Changelog ==

= 3.0.0 =
* 配布版としてプラグイン名、フォルダ名、GitHubリポジトリ名を Revify Custom CSS Block / revify-custom-css-block に統一しました。
* Git Updater 用ヘッダーを追加しました。
* `selector` 使用時の親なし警告を追加しました。
* 親ブロックに `revify-scope-*` が複数ある場合の警告を追加しました。
* CSSブロックの `scopeId` と親ブロックのスコープクラスが一致しない場合の警告を追加しました。
* `{` と `}` の数が一致していない可能性がある場合の簡易警告を追加しました。
* デバッグ情報の折りたたみ表示を追加しました。
* 保存時に投稿本文やスコープIDを自動修復する処理を削除しました。

= 2.9.1 =
* ブロックエディターのiframeキャンバスが保存・更新・デバイスプレビュー切替で再生成された場合も、編集画面用CSSをiframe内のhead末尾へ再注入するよう調整しました。

= 2.8.3 =
* CSS変数設定ページの使用例を、`selector`を使わない一般的なCSSクラス例へ変更しました。機能面の変更はありません。

== Changelog ==

= 3.0.0 =
* Revify Custom CSS Block として名称を統一しました。
* plugin-update-checker によるGitHub更新確認へ対応しました。
* GitHub Release 用ZIPの配布を前提にしました。
* 保存済みブロック構造を自動修復しない安定運用方針にしました。
