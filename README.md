# かんたん便利ツール集

無料・登録不要の日本語ツールを集めた静的サイトです。HTML / CSS / vanilla JavaScriptのみを使用し、ビルド・npmは不要です。PDFツールのみ同梱のpdf-libとpdf.jsを使用します。

公開先: https://yuto-uehara.github.io/benri-tools/

## 利用と確認

リポジトリのルートを静的HTTPサーバーで公開してください。例: `python3 -m http.server 8000`。トップページは `index.html` です。GitHub Pagesではmainブランチのルートから公開します。

計算ツールは入力のたびにブラウザ内で計算し、入力内容を送信・保存しません。共通処理は `assets/js/common.js`、ツールの計算は各ツール名のJavaScriptにあります。結果の `data-value` は機械可読値で、無効な入力の場合は空文字です。

## 公開時の準備

- OGP画像の元は `assets/img/og-image.svg`（1200×630）です。指定どおりPNGに変換して `assets/img/og-image.png` として配置してください。
- お問い合わせ先は未設定です。設定する場合は `about/index.html` のTODO箇所を更新してください。
- 現在、広告・アクセス解析は設置していません。広告コメントは将来の設置場所です。導入時にはプライバシーポリシーも更新してください。

著作権表示: © 2026 かんたん便利ツール集

PDFツール7種は実行ボタンで処理します。ファイルはアップロードされません。ライブラリはassets/vendor/に同梱し、ライセンスはlicense/で案内しています。
