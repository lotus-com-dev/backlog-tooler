# Backlog Comment Sorter

Backlogのコメントを時系列順に並び替えるChrome拡張機能です。

## 機能

- Backlogのコメント一覧を自動的に時系列順（古い順）にソート
- ページ読み込み時に自動実行
- Chrome、Microsoft Edgeなど、Chromiumベースのブラウザで動作

## インストール方法（パッケージ化されていない拡張機能として）

1. このリポジトリをダウンロードまたはクローンします

2. Chrome（またはEdge）で、アドレスバーに `chrome://extensions` と入力して拡張機能管理ページを開きます

3. ページの右上にある「デベロッパー モード」のスイッチをオンにします

4. 「パッケージ化されていない拡張機能を読み込む」というボタンが表示されるのでクリックします

5. ファイル選択ダイアログが開くので、ダウンロードした「comment-sorter」フォルダを選択します

6. 拡張機能が読み込まれ、一覧に「Backlog Comment Sorter」が表示されます

## 使い方

拡張機能をインストール後、Backlogのページにアクセスすると自動的にコメントが時系列順に並び替えられます。

## ファイル構成

- `manifest.json` - 拡張機能の設定ファイル
- `sort-comments.js` - コメントソート処理のメインスクリプト
- `README.md` - このファイル

## 対応サイト

- `https://*.backlog.jp/*`
- `https://*.backlog.com/*`
- `https://*.backlogtool.com/*`