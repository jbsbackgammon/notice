# 掲示物作成 (`notice`)

A4の案内掲示物をブラウザ上で作成し、印刷/PDF出力するためのGitHub Pagesツールです。

## 主な機能

- A4縦 / A4横
- 1面 / 2分割
  - A4縦の2分割: 上下
  - A4横の2分割: 左右
- 複数の案内を作成し、必要枚数のA4へ自動ページ分割
- 案内ごとのタイトル、説明文（改行保持）、URL
- URLのQRコード表示 ON/OFF
- タイトル色、本文色、背景色
- `images/` 内の画像を上部へ横幅いっぱいで表示
- JSON取込 / JSON出力
- ブラウザ内の自動保存（localStorage）
- PDF出力（ブラウザの印刷画面を使用）

## GitHub Pages 初回設定

1. GitHubで `notice` リポジトリを作成します。
2. このZIPの中身をリポジトリ直下へアップロードし、`main` ブランチへコミットします。
3. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
4. 以後は `main` へのファイル更新ごとに `.github/workflows/pages.yml` が実行され、Pagesへ直接デプロイされます。

公開URLは通常 `https://<organization-or-user>.github.io/notice/` です。

## 画像の追加

表示したい画像を `images/` フォルダへ追加して `main` に反映してください。
GitHub Actionsのデプロイ時に `scripts/generate_image_manifest.py` が画像一覧を生成し、画面のプルダウンへ自動反映します。

対応形式: PNG / JPG / JPEG / WebP / GIF / SVG

## PDF出力

画面上部の「PDF出力」を押すとブラウザの印刷画面が開きます。プリンターとして「PDFに保存」等を選択してください。
A4サイズ・余白0を想定した印刷CSSを適用しています。
