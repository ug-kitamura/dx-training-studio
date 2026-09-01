<!-- source: sha256:567b92ec25a7c005c506ead205f6a3674e71f868d3d133a91ec6e1947313ea7e -->

# Setting up Chocolatey

## Learning goals

The first quest in getting your environment ready. Here you'll install **Chocolatey** through the internal request system. Installation work tends to get pushed aside as "a hassle, I'll do it later," but what you actually do today is one request — ten minutes of work. Let's get it out of the way now.

By the end, you'll know what Chocolatey is and why you install it before VSCode.

## What is Chocolatey?

Chocolatey is a **package manager** for Windows. That sounds complicated, but think of it as **a single counter where you can order all the software you want**. Instead of hunting down a distribution site for each piece of software, downloading its installer, and so on, you just tell the counter the name and it takes care of installing and updating for you.

_Source: [Chocolatey official site](https://chocolatey.org/) (retrieved August 2026)_

In this training, Chocolatey acts as the counter for these two:

| What you'll install through it                       | Series that use it                             |
| ---------------------------------------------------- | ---------------------------------------------- |
| VSCode (a highly extensible code editor)             | Git Basics Series, Python Basics Series        |
| uv (a tool for setting up an environment to run Python) | Python Basics Series                        |

In other words, every tool from here on is picked up at this counter. That's why it comes first in getting your environment ready.

## Submit a request through the IT Service Portal

You install Chocolatey itself by requesting it through the internal **IT Service Portal**. Here are the steps.

1. Open the IT Service Portal
2. Choose the "**SW install**" item
3. Select **your own PC** as the target
4. Search for "**Chocolatey**" in the search box and select it
5. Click the request button

> **社内**: IT Service Portal の開き方と承認通知。答えるべき問い —
>
> - どこからアクセスするか（社内ポータルのリンク名・URL・デスクトップアイコンなど）
> - ログインに追加の認証が要るか
> - 申請が承認されたとき、通知（メールなど）は届くか。届くなら何がどこに届くか
>   形式: 手順1の直後に補う1〜3文 / 100〜150字

> **社内画像**: IT Service Portal で Chocolatey を申請する一連の画面。差し込みは「画面が変わるごとに1枚」を目安に、上の手順1〜5の範囲を対象とする。最低限、ポータルの入口（アクセス直後の画面）・SW install の選択画面・Chocolatey を検索・選択した状態の申請画面の3枚。氏名・社員番号・PC の管理番号はマスクする

<!-- 訳注: `> **社内**:` / `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

That completes the request. **Approval takes about a day.** The rest of this lesson and the next lesson can wait until the next business day or so.

## Once approved, confirm it's there

When your request is approved, Chocolatey **installs automatically**. There's nothing more for you to do.

Just once, confirm with a command that it's installed. Search for "PowerShell" in the Start menu, open it, and run this.

```powershell
choco --version
```

If a single line with a version number (a string of digits) appears, the installation is complete. If you get an error, reopen PowerShell and run it again. If that still doesn't work, paste the error message exactly as it appears into an AI and ask about it. And if that doesn't solve it either, come to the **DX Tools Training** channel in Teams. Don't hesitate to ask right away about environment trouble.

## Try it

Submit the Chocolatey request through the IT Service Portal. Around the time it's approved (the next business day is a good guess), run `choco --version` and check the result.

- Given: submit the request on your company PC
- Don't worry about: how to use Chocolatey's commands. Outside of this one check, there is no point in this training where you type a `choco` command

<details>
<summary>Sample answer</summary>

It worked if a version number is displayed.

</details>

## Summary

Three things to take away from this lesson.

1. Chocolatey is **a single counter where you can order all the software you want** (a package manager)
2. The request goes through **SW install** in the IT Service Portal. **Approval takes about a day**
3. After approval it **installs automatically**, so all you do is check with `choco --version`

Your adventure doesn't stop while you wait for approval. Moving ahead to the AI Basics Series, already unlocked on the Mandala, is a fine choice.

## Check your understanding

1. What kind of "counter" is Chocolatey? Put it in one sentence in your own words.
2. When you install VSCode in the next lesson, will you need to hunt down an installer on a distribution site? Look back at the table and the "counter" analogy in this lesson, and answer with your reasoning.
