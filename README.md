# Backlog Comment Sorter

Backlogの課題ページにコメントのソート切り替えボタンを追加するChrome拡張機能です。TypeScriptで実装されています。

## 機能

- Backlogの課題ページに「古い順/新しい順」切り替えボタンを自動追加
- 現在の並び順を自動判別し、適切なボタンラベルを表示
- ワンクリックでコメントの並び順を切り替え可能
- 過去のコメントがある場合は自動的に展開
- Chrome、Microsoft Edgeなど、Chromiumベースのブラウザで動作

## 開発環境のセットアップ

### 必要な環境
- Node.js (v14以上推奨)
- npm またはyarn

### インストール手順

1. このリポジトリをクローンします
```bash
git clone https://github.com/yourusername/backlog-comment-sorter.git
cd backlog-comment-sorter
```

2. 依存関係をインストールします
```bash
npm install
```

3. TypeScriptをビルドします
```bash
npm run build
```

### 開発時のコマンド

```bash
# TypeScriptをビルド
npm run build

# ファイル変更を監視して自動ビルド
npm run watch

# ビルド成果物をクリーン
npm run clean
```

## Chrome拡張機能としてのインストール方法

1. `npm run build`でビルドを実行します

2. Chrome（またはEdge）で、アドレスバーに `chrome://extensions` と入力して拡張機能管理ページを開きます

3. ページの右上にある「デベロッパー モード」のスイッチをオンにします

4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします

5. ファイル選択ダイアログで、プロジェクトのルートディレクトリを選択します

6. 拡張機能が読み込まれ、一覧に「Backlog Comment Sorter」が表示されます

## 使い方

1. 拡張機能をインストール後、Backlogの課題ページ（`/view/`を含むURL）にアクセスします

2. ページ上部のフィルターナビゲーションエリアに「古い順で表示」または「新しい順で表示」ボタンが自動的に追加されます

3. ボタンをクリックすることで、コメントの並び順を切り替えることができます

## プロジェクト構成

```
backlog-comment-sorter/
├── src/
│   └── sort-comments.ts    # TypeScriptソースコード
├── dist/                    # ビルド成果物（gitignore対象）
│   ├── sort-comments.js    # コンパイルされたJavaScript
│   └── sort-comments.js.map # ソースマップ
├── manifest.json            # Chrome拡張機能マニフェスト
├── tsconfig.json           # TypeScript設定
├── package.json            # プロジェクト設定と依存関係
├── .gitignore             # Git除外ファイル
└── README.md              # このファイル
```

## 技術スタック

- **TypeScript**: 型安全性を確保したJavaScript開発
- **Chrome Extension Manifest V3**: 最新の拡張機能仕様に準拠
- **DOM操作**: ネイティブのDOM APIを使用した軽量な実装

## 対応サイト

- `https://*.backlog.jp/view/*`
- `https://*.backlog.com/view/*`

## ライセンス

MIT License