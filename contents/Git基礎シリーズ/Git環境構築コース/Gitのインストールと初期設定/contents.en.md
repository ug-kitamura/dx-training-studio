<!-- source: sha256:f9476b130032464aad5eeb63111e20f2ddc07ba1ac84101abd5c5e8136ecf77b -->

# Installing and setting up Git

## Learning goals

This is the "gear up for the adventure" chapter. From here on you'll actually walk the route on the map you got in the Git Concepts Course. The goal of this lesson: **submit the request to install Git, finish the installation and initial setup once it's approved, and get to a state where you can run the `git` command**.

> [!IMPORTANT]
> **A Git request takes roughly a day to be approved.** The lesson itself is 15 minutes, but on the calendar it spans more than one day. **Submit the request right now, and work on other series while you wait for approval.** Come back to this lesson when the approval notice arrives.

```text
Submit request ───about 1 day─── Approval ───── Install ───── Check ───── Set your name
   ↑ you are here (a few minutes)         └─── about 10 minutes in total from here ───┘
```

The numbers are rough guides. Just look at the shape: **it splits into two chunks — "submit the request first" and "do the rest in one go after approval"**.

## Git starts with a request

In the Getting Started Series, you submitted a request for Chocolatey. Git needs **its own separate request**. Git doesn't come in through Chocolatey; you install it through the IT Service Portal. It's the same portal you used for Chocolatey, but the request itself is a separate one. The shape of the request is also the same as it was for Chocolatey — request → wait for approval → do the real work after approval — so by now you should know the drill. And if you've forgotten, just follow the steps below.

> **社内**: IT Service Portal での Git 導入申請の手順を書く。答えるべき問い —
>
> - IT Service Portal のどのメニューからたどるか（Chocolatey の「SW install」と同じ入口か）
> - 申請フォームで何を入力・選択するか（ソフト名の正式表記・バージョン・申請理由の書き方の例）
> - 承認の目安時間と、承認されたことは何で分かるか（メール通知か、画面上の表示か）
> - 承認後、インストールはどう実行するか（自動配布か、自分で実行ボタンを押すのか）
>   形式: 番号付き手順4〜6ステップ / 300字程度

> **社内画像**: IT Service Portal で Git の申請フォームを開いた状態のスクリーンショット。ソフト名の入力欄と申請ボタンが写る画角で撮る。申請者名・社員番号・所属はマスクする

<!-- 訳注: `> **社内**:` / `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

Once your request is in, you can close this page until the approval comes through.

## What about SourceTree?

During installation you may be offered a different tool called SourceTree. Let's decide in advance what to do about it.

> **社内**: インストール時の SourceTree 同梱の選択肢について書く。答えるべき問い —
>
> - 同梱の選択肢は、どの画面で・どの文言で出るか
> - 選択肢が出ない場合はどうなるか（既定で入る／入らない）
>   形式: 1〜2文 / 80字程度

The policy: **if the installer offers to bundle it, go ahead and select it.** That said, this training does not cover how to use SourceTree. You'll learn Git operations through the command line and VSCode only.

## Confirm that it's installed

Once approval and installation are done, check that it's really usable. The place to run commands is **the VSCode terminal**.

1. Open VSCode
2. From the top menu, choose **"Terminal" → "New Terminal"**
3. A dark area where you can type — the terminal — opens at the bottom of the screen

Type the following command there and press Enter.

```bash
git --version
```

If a line like `git version 2.x.x` appears, the installation worked. The numbers may differ depending on your environment; that's fine.

> [!TIP]
> If you get an error saying `git` is not recognized, **first close VSCode and reopen it.** A VSCode window that was already open before the installation can fail to notice the newly installed Git.

If that still doesn't fix it, take a screenshot of the error just as it appears and paste it into the internal AI chat to ask about it (how to use it is covered in the AI Basics Series). This move — "screenshot it and ask an AI" — is a go-to move for getting unstuck that will serve you from here on.

## Set your player name

Finally, two settings you only do once. Git's save data (each commit) records **who made the save**, every single time. It's just like entering your player name at the start of a game, and this is where you set that name.

Run the following two lines in the terminal, one at a time (`--global` means "set it once for this whole PC and it stays in effect from then on").

```bash
# Replace "name" and "email address" with your own
git config --global user.name "name"
git config --global user.email "email address"
```

> **社内**: `user.name` と `user.email` に何を設定するかの部署ルールを書く。答えるべき問い —
>
> - `user.name` はどの表記にするか（例: ローマ字か、姓名の順か、社員IDか）
> - `user.email` は社用メールアドレスをそのまま使ってよいか
>   形式: 設定例2行＋補足1文 / 100字程度

To check that the settings took effect, use this command.

```bash
git config --list
```

If the list that appears includes the `user.name=...` and `user.email=...` lines you just set, you're done. The list also contains plenty of other unfamiliar lines, but **you don't need to read them**. Finding your own two lines is enough.

## Try it

The "Try it" for this lesson comes in two stages.

1. **Right now**: submit the Git request through the IT Service Portal
2. **After approval**: run `git --version` and `git config --list` in the VSCode terminal, and confirm that the version and your own name and email are shown

- Given: VSCode is already installed (from the Development Environment Setup Course)
- Don't worry about: whether the version number shown is the latest one

<details>
<summary>Sample answer</summary>

Done once you can see `git version 2.x.x` and the two lines for `user.name` / `user.email`.

</details>

## Summary

This lesson had four steps.

1. Submit the **request** (up to ~1 day for approval. Spend the wait on other lessons)
2. **Install** after approval
3. **Check** with `git --version`
4. **Set your player name** with `git config` (first time only)

From the next lesson, you'll finally make your first save (commit). Your gear is ready. All that's left is to set out on the adventure.

## Check your understanding

1. What are `user.name` and `user.email` for? Explain in one sentence, using the words "save data."
2. Of this lesson's four steps (request, install, check, set your name), which one may span more than a day, and what should you be doing in the meantime?
