# Backlog Tooler

Backlogの生産性を向上させる拡張可能なChrome拡張機能プラットフォームです。React + Vite + TypeScriptで実装されています。

> **v3.0 プラグインアーキテクチャ導入**: 機能プラグインシステムによる拡張可能なアーキテクチャへと進化しました。新しいFeatureManager/Registryシステムにより、独立した機能の追加・管理が簡単になりました。

## 機能

### コメントソート機能
- Backlogの課題ページにトグルスイッチ形式のソート切り替えボタンを自動追加
- ワンクリックでコメントの並び順を「古い順 ⇄ 新しい順」で切り替え可能
- ボードページのモーダル内でも動作
- 過去のコメントがある場合は自動的に展開

### プラットフォーム機能
- **プラグインアーキテクチャ**: 機能の動的な登録・管理・有効化/無効化
- **拡張機能管理**: ポップアップUIでのオン/オフ切り替え
- **自動リソース管理**: メモリリークを防ぐクリーンアップシステム
- **ゼロ設定ロガー**: 自動作成される構造化ログシステム
- **Chrome/Edge対応**: Chromiumベースのブラウザで動作

## インストール

### 必要な環境
- Node.js (v18以上推奨)
- npm

### セットアップ手順

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/backlog-tooler.git
cd backlog-tooler
```

2. 依存関係をインストール
```bash
npm install
```

3. 拡張機能をビルド
```bash
npm run build
```

### Chrome拡張機能として読み込み

1. Chrome（またはEdge）で `chrome://extensions` を開く
2. 「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. ビルドされた`dist/`フォルダを選択
5. 拡張機能が読み込まれます

## 使い方

### コメントソート機能

#### 通常の課題ページ
1. Backlogの課題ページ（URLに`/view/`を含むページ）にアクセス
2. ページ上部にトグルスイッチ形式のソートボタンが自動追加される
3. ボタンをクリックしてコメントの並び順を切り替え

#### ボードページ
1. Backlogのボードページにアクセス
2. タスクカードをクリックしてモーダルを開く
3. モーダル内でも同様にソートボタンが表示される

### 拡張機能の設定
1. ブラウザのツールバーで拡張機能アイコンをクリック
2. ポップアップでトグルスイッチを切り替えて有効/無効を制御
3. 設定は自動保存され、リロード不要

## プロジェクト構成

```
backlog-tooler/
├── src/
│   ├── core/                 # コア機能管理システム
│   │   ├── feature-manager.ts
│   │   ├── feature-registry.ts
│   │   └── types.ts
│   ├── features/             # 機能プラグイン
│   │   └── comment-sorter/
│   ├── scripts/              # Chrome拡張スクリプト
│   │   ├── background.ts
│   │   └── content.tsx
│   ├── ui/                   # UIコンポーネント
│   │   ├── popup/
│   │   └── components/
│   └── shared/              # 共有リソース
│       ├── constants/
│       └── types/
├── docs/                    # 詳細ドキュメント
├── manifest.json
└── package.json
```

## 開発

### コマンド

```bash
# ビルド
npm run build

# 開発サーバー（ホットリロード）
npm run dev

# リント
npm run lint

# プレビュー
npm run preview
```

### 新機能の追加

1. `src/features/` に新しい機能フォルダを作成
2. `BaseFeature` を継承したクラスを実装
3. `FeatureManager` に機能を登録
4. 必要に応じて設定を追加

詳細は [開発ガイド](docs/development.md) を参照してください。

## ドキュメント

- [アーキテクチャ詳細](docs/architecture.md) - プラグインアーキテクチャと設計思想
- [パフォーマンス最適化](docs/performance.md) - メモリ管理と最適化技術
- [技術詳細](docs/technical-details.md) - Chrome拡張機能の実装詳細
- [開発ガイド](docs/development.md) - 新機能開発の手順

## 対応サイト

- `https://*.backlog.jp/view/*` (課題ページ)
- `https://*.backlog.com/view/*` (課題ページ)  
- `https://*.backlog.jp/board/*` (ボードページ - モーダル内)
- `https://*.backlog.com/board/*` (ボードページ - モーダル内)

## 技術スタック

- **React 19** - UIコンポーネント
- **TypeScript 5** - 型安全な開発
- **Vite 7** - 高速ビルドツール
- **Chrome Extension Manifest V3** - 最新拡張機能仕様

## ライセンス

MIT License