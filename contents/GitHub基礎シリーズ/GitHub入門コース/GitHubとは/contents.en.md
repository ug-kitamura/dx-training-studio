<!-- source: sha256:cd446bd502f759fb68498798f66ffb312946a4a59414998c4d1796d493597d01 -->

# What is GitHub?

## Learning goals

Having cleared the Git Basics Series, you can now save your work at any time and safely go back to it. But that save data **only exists on your own PC**. A local vault alone isn't always enough at work. Your PC might break, or someone might ask, "could you take a look at this script?"

What you'll learn in this series (the GitHub Basics Series) is **how to connect to a place where you share your save data with your team**. You'll connect your local vault to a shared one (the GitHub Remote Workflow Course), and go as far as working on a side route branching off the main story and merging it back (the GitHub Branches and PRs Course). By the end, you'll be able to bring your work together with your teammates' work **safely, without breaking anything**.

The goal of this first lesson is to be able to **say what GitHub is a place for**, and to understand **how the GitHub we use inside the company differs from the GitHub out in the world, what you agree to when you use it, and who to go to when you get stuck**. You won't type a single command. This is a look-at-the-map lesson.

## GitHub is a "shared vault"

In the Git Basics Series we called the `.git` inside your folder the "vault where your save data lives." GitHub is **a place to keep a copy of that vault on a server**. Here we'll call it the **shared vault**.

```text
   Your PC                              Server (GitHub)
 ┌───────────────┐    send (push)    ┌───────────────┐
 │ Local vault   │ ────────────────▶ │ Shared vault  │ ◀── teammates read and pull it too
 │   (.git)      │ ◀──────────────── │               │
 └───────────────┘   bring in (pull) └───────────────┘
```

In the Git Basics Series, push and pull only came up by name, with a promise that the GitHub Basics Series would cover them. Here they are. You don't need to memorize them yet. Just look at the shape: **there are two vaults, and things can travel between them**.

Let's clear up a common confusion right now. **Git and GitHub are different things.**

| | What it is | Where it runs |
|---|---|---|
| Git | The **tool** that saves and reverts (a command) | Inside your PC |
| GitHub | The **place** that holds a copy of the vault (a web service) | On a server. You open it in a browser |

Git works without GitHub (that's exactly what the Git Basics Series was). GitHub, on the other hand, is a place that looks after Git vaults, so it has nothing to do without Git. "Git is the tool, GitHub is the place" — that one line is the first thing to take away.

On top of being a place to keep things, GitHub also comes with **features for passing content back and forth with your team**. You'll actually use those in the GitHub Branches and PRs Course.

## Internal GitHub and GitHub.com

When you hear "GitHub," what comes to mind may be GitHub.com out on the internet — the place where all the world's open source lives.

What we use for work is **a separate, internal build of GitHub**. In this training we call it **internal GitHub**. Picture it this way: **there are two identical vault buildings, one inside the company grounds and one outside**. The one we use is the one inside the grounds.

<!--
A conceptual diagram with two identically shaped vault buildings, one inside the company grounds (a fenced-off area) and one outside. The inside building is labeled "Internal GitHub", the outside one "GitHub.com". The inside building has a few small icons of company employees; the outside one has many icons of people from all over the world. On the fence between inside and outside, an ✕ mark indicating "not visible"
-->
![Two identical vault buildings: internal GitHub inside the fenced company grounds and GitHub.com outside, with an X on the fence](images/internal-github-vs-github-com-fence-2.png)

Internal GitHub is a product called **GitHub Enterprise Server**, running on a company server. The screens and the way you use it are nearly identical to GitHub.com, but there are three differences.

| | GitHub.com | Internal GitHub |
|---|---|---|
| Where it is | On the internet | On a company server |
| Who can see it | Anyone in the world (for public repositories) | Only people with an internal account |
| Can you see the other one's repositories? | — | **Public repositories on GitHub.com are not visible from internal GitHub** (it's a separate vault) |

The third one is the easiest to trip over at first. GitHub articles you find on the web are almost always about what's outside the grounds. **Everything you do in this series happens on internal GitHub.**

_Source: [GitHub Docs, "About GitHub Enterprise Server"](https://docs.github.com/ja/enterprise-server@latest/admin/overview/about-github-enterprise-server) (retrieved August 2026)_

Below are the official name of internal GitHub and where to open it.

> **社内**: 社内GitHub の正式名称と開き方を書く。答えるべき問い —
>
> - 正式名称（本文の「社内GitHub」をどう読み替えればよいか）
> - URL、またはポータルでのリンク名
> - 社内ネットワークからだけ開けるのか、VPN が要るのか
>   形式: 箇条書き2〜3点 / 80〜150字

<!-- 訳注: `> **社内**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

## Requesting it, and the cost — who uses it and who doesn't

To use internal GitHub, **you need to request an account**. And each account costs **€16 per month**. "Am I really allowed to request something that costs money on my own judgment?" — that's a natural thing to wonder.

The answer is: **this is the tool you'll mainly be using from here on, so please request it.** You build a tool, hand it to your teammates, get it reviewed — internal GitHub is where all of that lives. It's treated as a cost of the tools you work with, so there's no need to hesitate.

That said, if you **won't use internal GitHub for your job but still want to learn about DX tools**, **talk it over with your manager and decide together**. You need internal GitHub to follow the steps in this series, but everything in the Git Basics Series can be learned without it. Deciding not to request an account doesn't take you out of the training.

The request steps are covered in the next lesson. The place to go is the same **IT Service Portal** you used for Chocolatey and Git.

## Constraints on use, and who to ask when you're stuck

Because it's an internal system, there are things you agree to when you use it. Let's cover what those are and who to ask when you're stuck.

> **社内**: 社内GitHub の利用上の制約と、サポート窓口を書く。答えるべき問い —
>
> - してはいけないこと（公開リポジトリを作ってよいか・外部に公開してはいけないもの・置いてはいけないデータの区分）
> - GitHub.com と違って使えない機能、または追加で使える機能（Copilot 等の付加機能の有無）
> - 詰まったときの問い合わせ先（管理者・チャンネル・チケットの出し方）と、利用ガイドラインの所在（リンク）
>   形式: 制約は表1つ（項目と可否）＋窓口は箇条書き1〜2点＋ガイドラインへのリンク1本 / 150〜300字

For questions about how to actually do something, you can still ask in the **DX Tools Training** Teams channel as before. Use the contact above for "trouble with the system itself, like accounts and permissions," and the channel for "I don't know how to do this."

## Try it

Actually open internal GitHub, and name one way it differs from GitHub.com.

- Given: if you don't have an account yet, getting **as far as the sign-in screen** is fine. Opening it again once your account is approved and looking at the differences on the top page is also worth doing
- Don't worry about: doing anything inside it. Opening it and looking around is enough
- What to compare against: if you've never opened GitHub.com, open `github.com` in your browser and compare the top pages

<details>
<summary>Sample answer</summary>

Naming any one of these is enough: "the URL isn't github.com," "you sign in with your company account," "the only repositories you can see are internal ones."

</details>

## Summary

This lesson ended without a single command — just looking at the map. Three things to take away.

1. **Git is the tool, GitHub is the place.** GitHub is the **shared vault** that holds a copy of your local one
2. What we use is **internal GitHub** (GitHub Enterprise Server). It's a separate vault from GitHub.com, and you can't see what's over there
3. Internal GitHub is **request-based and costs €16 per month**. Request it, since it's what you'll mainly use from here. If you don't expect to use it, talk it over with your manager

In the next lesson, you'll actually submit the request. Approval takes a few days, so move on to it as soon as you've finished reading.

## Check your understanding

1. Explain "what is the difference between Git and GitHub?" in your own words, in one or two sentences, using the words **tool** and **place**.
2. You look on internal GitHub for a GitHub.com repository you saw in a web article, and can't find it. Why? Explain it using the word "vault."
