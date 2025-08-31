# 開発ガイド

## 新機能の開発方法

v3.0のプラグインアーキテクチャにより、新しいBacklog支援機能を簡単に追加できます：

### 1. 新機能プラグインの作成

#### ステップ1: 機能ディレクトリの作成
```bash
mkdir src/features/your-new-feature
```

#### ステップ2: 機能クラスの実装
```typescript
// src/features/your-new-feature/your-feature.tsx
import { BaseFeature } from '@/core';
import type { FeatureConfig, FeatureContext, PageContext } from '@/core';

export class YourNewFeature extends BaseFeature {
  constructor(
    featureConfig: FeatureConfig,
    context: FeatureContext,
    pageContext: PageContext
  ) {
    super(featureConfig, context, pageContext);
  }

  shouldActivate(): boolean {
    // この機能がアクティブになる条件を定義
    return this.pageContext.isViewPage();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.logger.debug('Initializing...');
    
    // 機能の初期化処理
    // DOM操作、イベントリスナー設定など
    
    this.setInitialized(true);
  }

  cleanup(): void {
    this.logger.debug('Cleaning up...');
    
    // クリーンアップ処理
    // イベントリスナー削除、DOM要素削除など
    
    this.setInitialized(false);
  }
}
```

#### ステップ3: エクスポートファイルの作成
```typescript
// src/features/your-new-feature/index.ts
export { YourNewFeature } from '@/features/your-new-feature/your-feature.tsx';
export type * from '@/features/your-new-feature/types'; // 必要に応じて
```

### 2. 機能の登録

#### コンテンツスクリプトへの登録
```typescript
// src/scripts/content.tsx の initializeFeatureSystem() 内
const yourNewFeature = new YourNewFeature(
  {
    id: 'your-new-feature',
    name: 'Your New Feature',
    description: 'Description of your feature',
    enabled: true,
    version: '1.0.0'
  },
  context,
  pageContext
);

featureManager.registerFeature(yourNewFeature);
```

### 3. 設定の追加（オプション）

#### デフォルト設定の追加
```typescript
// src/scripts/background.ts の initializeDefaultStorage() 内
const defaultFeatures: FeatureSettings = {
  'comment-sorter': { /* 既存 */ },
  'your-new-feature': {
    enabled: true,
    config: {
      // 機能固有の設定
      customOption: 'defaultValue'
    }
  }
};
```

### 4. 利用可能なユーティリティ

#### リソース管理
```typescript
// Observer の追跡
this.context.resourceTracker.trackObserver(observer);

// タイムアウトの追跡  
const timeoutId = setTimeout(() => { /* ... */ }, 1000);
this.context.resourceTracker.trackTimeout(timeoutId);

// DOM要素の追跡
this.context.resourceTracker.trackElement(element);
```

#### ページコンテキスト判定
```typescript
// 現在のページタイプを判定
if (this.pageContext.isViewPage()) { /* 課題ページ */ }
if (this.pageContext.isBoardPage()) { /* ボードページ */ }  
if (this.pageContext.isIframeContext()) { /* iframe内 */ }
```

#### 拡張機能状態の確認
```typescript
const enabled = await this.context.isExtensionEnabled();
```

#### ロガーの使用
```typescript
// ロガーはBaseFeatureで自動作成されるため、設定不要
// 機能名から自動的にプレフィックスが生成される

// 直接使用可能
this.logger.debug('Debug information');
this.logger.info('Information message');
this.logger.warn('Warning message');
this.logger.error('Error message');
```

### 5. 機能開発のベストプラクティス

- **リソース管理**: 必ず`cleanup()`でリソースを解放
- **abort signal**: `this.context.abortController.signal`で中断処理に対応
- **エラーハンドリング**: try-catch を使った適切なエラー処理
- **デバッグログ**: 開発時のデバッグ情報を出力
- **型安全**: TypeScriptの型定義を活用

### 6. テスト

```bash
npm run build
npm run lint
```

新機能を追加した後は、Chrome拡張機能として読み込んでBacklogページで動作確認してください。

## 開発環境コマンド

```bash
# 開発サーバーを起動（ホットリロード + 全ログレベル有効）
npm run dev

# 拡張機能をビルド（本番用 - WARN/ERRORのみ）
npm run build

# コードのリント
npm run lint

# プレビューサーバーを起動
npm run preview
```

### 開発ワークフロー

#### 1. 開発環境での作業
```bash
npm run dev
```
- Vite開発サーバーが起動
- `dist/` フォルダに開発版が生成される
- ファイル変更時に自動リロード（HMR）
- 全ログレベル（DEBUG/INFO/WARN/ERROR）が有効

#### 2. Chrome拡張機能として読み込み
```bash
# 一度だけ設定
1. chrome://extensions/ を開く
2. 「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist/` フォルダを選択

# 開発中
- ファイルを編集すると自動でリロードされる
- F12でDevToolsを開いてログを確認
- リアルタイムでデバッグ可能
```

#### 3. ログ確認方法
```bash
# Content Scriptのログ確認
1. BacklogページでF12キー
2. Consoleタブを選択
3. フィルターで機能名を検索（例：「CommentSorter」）

# Background Scriptのログ確認
1. chrome://extensions/ → 拡張機能の「詳細」
2. 「バックグラウンド ページを調べる」をクリック
3. DevToolsでConsoleを確認
```

## 本番環境での最終テスト

本番リリース前には本番ビルドでのテストを実施：

```bash
npm run build  # 本番ビルド（WARN/ERRORのみ）
```

1. Chrome拡張機能として読み込み
2. 本番と同等の環境でテスト
3. ログレベルが適切に制御されていることを確認

## 技術スタック詳細

- **React**: UIコンポーネントの構築（forwardRef、useCallback、useImperativeHandle活用）
- **TypeScript**: 型安全性を確保したJavaScript開発（厳密な型チェック）
- **Vite**: 高速なビルドツールとバンドラー
- **@crxjs/vite-plugin**: Vite用Chrome拡張機能開発プラグイン
- **Chrome Extension Manifest V3**: 最新の拡張機能仕様に準拠
- **ESLint**: コード品質の維持