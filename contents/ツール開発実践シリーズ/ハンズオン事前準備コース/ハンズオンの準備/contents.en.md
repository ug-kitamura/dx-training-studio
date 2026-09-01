<!-- source: sha256:53452ffe1e5bf4c6e5559755397b40087daf6cd9e2598b933fb53ba60bfad468 -->

# Preparing for the hands-on

## Learning goals

Across the series so far you've picked up saving (commits) and the shared vault (the repository on internal GitHub), side routes (branches) and requests to merge (pull requests), and a full set of Python tools. The Tool Development Practice Series is the quest where you **use every one of those weapons**. Over two group hands-on sessions you'll finish one Python script that solves a task, and when it's over you'll walk away with a working tool — one you built yourself, explained in your own words, and took through review all the way to merge.

This lesson is the preparation that lets you spend the day itself **entirely on writing code**. There are two things to have in place.

- You've confirmed your environment works
- You have **a repository of your own** ready for working on the task

Note that **the task itself isn't revealed here**. It's released at the start of day 1. All you're doing here is preparing the empty repository.

## Knowing the plan for the day

The hands-on is two 60-minute sessions, with three to four days in between. You may be nervous about "getting all the way to done in 60 minutes," but **the task is built so it can be solved with only the tools you've learned in these lessons**. There's no new syntax to learn on the day.

```text
  Day 1 (60 min)               3-4 days           Day 2 (60 min)
┌─────────────────────┐   ┌─────────────────┐   ┌────────────────────┐
│ Task released       │   │ Think about the │   │ Finish the code    │
│ → implement         │   │ advanced task   │   │ → PR & peer review │
│ → PR & peer review  │──▶│ (ask teammates  │──▶│ → 2-min talk each  │
│ → working tool done │   │   or the AI)    │   │ → complete         │
└─────────────────────┘   └─────────────────┘   └────────────────────┘
```

There are only four things you need to know right now.

| Rule | What it means |
|---|---|
| Pairs are decided on the day | Two people per pair. Your partner is **who you review with**; each of you implements in your own repository |
| You use PRs and review | You'll run the "side route (branch) → request to merge (pull request) → review → merge" from the GitHub Branches and PRs Course for real, with your partner |
| AI is allowed | Ask the internal AI chat (the colleague at the next desk) as much as you like. **But you must be able to explain your own code in your own words in the talk** |
| You present even if it isn't finished | Talk about how far you got and what you got stuck on. Sharing where you got stuck is itself a lesson for the others |

The dates and the venue are announced in the **DX Tools Training** Teams channel.

## Doing a final check of your environment

Starting the day with "it doesn't work" burns your implementation time. Check the following four items **now**. If even one doesn't pass, going back to the lesson in the right-hand column will fix it.

| What to check | What passing looks like | Where to go back to |
|---|---|---|
| VSCode opens | You can open a folder and edit a file | The Development Environment Setup Course in the Getting Started Series |
| Git is installed | `git --version` returns a version in the terminal | The Git Setup Course |
| You can sign in to internal GitHub | After signing in, your icon (username) appears in the top right | The GitHub Introduction Course |
| uv is installed | `uv --version` returns a version in the terminal | The Python Setup Course |

```bash
git --version
uv --version
```

## Getting your own repository ready

The task on the day starts from a **template repository** prepared by the organizers. A template repository is "a repository that acts as a model" — copy it and you get a new repository of your own with the same contents. What's inside is only a README and a sample CSV — **the task text isn't in it**.

> **社内**: テンプレートリポジトリの名前と場所を書く。答えるべき問い —
>
> - 社内GitHub 上のリポジトリ名と URL（またはたどり着き方）
> - 受講者に閲覧権限が最初からあるか、申請が要るか
>   形式: リポジトリ名＋リンク1本＋補足1文 / 50〜100字

<!-- 訳注: `> **社内**:` / `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

The steps for copying it are below. The route is different from the **New repository** button you used in the GitHub Remote Workflow Course — you start **from the template's own page**.

1. Open the template repository's page
2. Press the **Use this template** button and choose **Create a new repository**
3. Choose **your own account** as Owner and enter a repository name (`dx-handson`, say — any name that makes sense to you)
4. Choose **Private** and press **Create repository** (the work on the task is for you, so Private is fine)

_Source: [GitHub Docs, "Creating a repository from a template"](https://docs.github.com/en/enterprise-server@latest/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) (retrieved August 2026)_

> **社内画像**: 社内GitHub のテンプレートリポジトリのトップ（Use this template ボタンが見える状態）と、Create a new repository の入力フォーム。画面が変わるごとに1枚を目安に撮影する。組織名・ユーザー名・実在のリポジトリ名はマスクする

```text
Template repository ──[Use this template]──▶ your repository ──[git clone]──▶ your machine
  (the organizers' model)                 (on internal GitHub, Private)      (where you work)
```

To put the difference in words: **copying creates a new vault of your own on internal GitHub, while cloning copies that vault's contents down to your machine**.

Clone the repository you've just made to your machine, using the same steps as in the GitHub Remote Workflow Course. Copy the HTTPS URL from the **Code** button. In VSCode, open the folder where the repository should live (the same parent folder you cloned into in that course is fine), and run this from the terminal.

```bash
git clone <the URL you copied>
```

## Checking that it runs

Open the cloned folder in VSCode. **If you can see the README and the sample CSV, the clone worked.** Next, just confirm that Python runs in the terminal.

```bash
uv run python -c "print('ready')"
```

```text
ready
```

`-c` is the option meaning "run just this one line." Paste it as-is here; there's no need to memorize it. If `ready` appears, uv — your quartermaster — can find and run Python. The first time may take a moment while Python itself is prepared, which is normal.

## Try it

Work through the three sections above for real. Complete (1) the four environment checks, (2) copying the template into a repository of your own, and (3) cloning it and seeing `ready`. If you ran things while reading, just look back over (1)–(3) to confirm they're done.

- Given: your internal GitHub account is approved
- Don't worry about: reading through the contents of the repository (the README and sample CSV). The task is released on the day, so reading it now won't get your preparation any further

<details>
<summary>Sample answer</summary>

You're done when all four checks pass and `ready` appears in the folder you cloned your own repository into.

</details>

## Summary

There are only three things to confirm in your kit.

1. The four environment checks pass (VSCode, Git, internal GitHub, uv)
2. You have **your own Private repository** copied from the template, cloned to your machine
3. You know the four rules for the day (pairs on the day, PRs and review, AI allowed but explain it yourself, present even if unfinished)

Your kit is ready. On the day, all that's left is to swing the weapons you've gathered.

## Check your understanding

1. Explain the difference between "copying from a template" and "cloning," in the language of vaults.
2. On the day, what is the relationship between you and your pair partner? Explain it in your own words using the words "implement" and "review."
