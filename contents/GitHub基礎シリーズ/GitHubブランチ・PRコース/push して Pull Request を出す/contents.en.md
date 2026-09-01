<!-- source: sha256:47c2c1a716aa9bc7e9fa4d98b538f9f772e79e35362443e945613294c3ca0f13 -->

# Push and open a pull request

## Learning goals

The side route you created in the previous lesson still only exists on your machine. The goal of this lesson is to **send your side route to the shared vault and request that it be merged into the main story**. That request is called a **pull request** (**PR** for short).

You're practicing alone, but the PR you create here is **exactly the shape of what your partner will look at in the hands-on**. Getting one through now is definitely easier than doing it cold on the day of the hands-on.

## Pushing a branch

Open the `github-practice` folder and check that **you're on the `add-greeting` branch** (bottom left of VSCode, or the first line of `git status`).

In the previous lesson's "Try it," you should have added a line to the README and committed it. If you haven't, add `- A line written on the side route` at the end of `README.md`, save, then run this.

```bash
git add README.md
git commit -m "Add one line on the side route"
```

Now let's send it. If you type `git push` here, **an error comes back**.

```text
fatal: The current branch add-greeting has no upstream branch.
To push the current branch and set the remote as upstream, use

    git push --set-upstream origin add-greeting
```

(Only the key parts of the output are shown. In reality a few more lines follow, saying you can avoid this extra step by changing a setting.)

**This isn't a failure, it's guidance.** The shared vault doesn't have a route called `add-greeting` yet, so it's saying, "run this command to confirm you want me to create that branch over here too." And indeed, **the command you need is written out for you**.

When an error comes up, **read the message** first, the way we just did — it's a habit that pays off across all of Git. If you read it and still don't understand, copy it and paste it to the AI (just as you did in the AI Basics Series).

Let's do what it says. There's a shorter way to write it.

```bash
git push -u origin add-greeting
```

`-u` is the short form of `--set-upstream`, and it **tells Git to remember that your local `add-greeting` is linked to `add-greeting` on the shared vault**. Type it once and `git push` on its own works from then on. Remember it as: `-u` is needed **only the first time for a new branch**.

> [!NOTE]
> `origin` is the name that refers to "the shared vault." It was set automatically when you cloned. You won't need to pick a different name any time soon, so **just take the name as given**.

## Creating a pull request

Once the push finishes, open the repository on internal GitHub in your browser.

Near the top of the page there's a yellow banner reading **"Compare & pull request"**. Internal GitHub has detected the branch you just sent and is asking, "would you like to merge this?"

1. Click **"Compare & pull request"**
2. The PR creation screen opens. At the top there's something like `main ← add-greeting`, showing **which branch is being merged into which**
3. Write a **title** (the commit message is filled in by default; change it if it isn't clear)
4. Write what you did in the **description** field (more on this in the next section)
5. Click **"Create pull request"**

> **社内画像**: 社内GitHub で PR を作るまでの流れ。①push 直後のリポジトリトップに出る「Compare & pull request」バナー ②PR 作成フォーム（タイトル・説明欄・Create pull request ボタンが見える画角） ③作成後の PR ページ。画面が変わるごとに1枚を目安に撮る。ユーザー名・組織名・URL のホスト部分・アバター画像はマスクする

<!-- 訳注: `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

If the banner isn't showing, you can do the same thing from the repository's **"Pull requests"** tab → **"New pull request"**, choosing the branch you're merging from.

> [!TIP]
> **Don't get hung up on the name "pull request."** It comes from asking someone to pull in your work, but knowing that doesn't help you use it. Thinking of it as **"a request to merge"** is enough.

_Source: [GitHub Docs, "About pull requests"](https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) (retrieved August 2026)_

## Reading the PR screen

Once created, the PR's page opens. There are several tabs, but **three are worth learning** (depending on the setup, tabs like Checks may sit alongside them, but you can ignore those for now).

| Tab | What you see | When to look |
|---|---|---|
| **Conversation** | The description and the back-and-forth in comments | When you're exchanging messages with someone |
| **Commits** | A list of the commits in this PR | Hardly ever |
| **Files changed** | **The diff of the changed lines** (`+` and `-`) | **This is the one to look at** |

**Open Files changed.** The line you added is shown with a green `+`. It's the same `+` and `-` you read with `git diff` in the Git Basics Series. This time it's just in a browser, with color.

**This screen is the substance of the PR.** Reviewers look here too, to decide whether it's OK to merge. In the next lesson you'll leave comments on lines in this screen.

Note that creating a PR **doesn't change `main` at all**. The request has been submitted, and merging comes in the next lesson.

## What to write in the description

You can create a PR with an empty description. But if someone else is going to read it, **one line of "what" and one line of "why" already help a lot**.

```markdown
## What I did
Added one practice line to the README.

## Why
For practice in the GitHub Basics Series.
```

The `##` headings are optional. All you need is **"what" and "why."** The "what" can be short, since Files changed shows it — **the one worth writing is the "why,"** because that's the part the diff can't tell you.

In the hands-on, your partner reads your PR and reviews it. Those two lines make a big difference to how much work the review is for them.

## Try it

Create one PR in your own repository.

1. Check that you're on the `add-greeting` branch
2. Send it to the shared vault with `git push -u origin add-greeting`
3. Create the PR from "Compare & pull request" in the browser (one line each of "what" and "why" in the description)
4. Open the **Files changed** tab and check that the line you added shows with a green `+`

- Given: the `add-greeting` branch has at least one commit on it
- Don't worry about: setting Reviewers, Assignees, or Labels. Leave them all empty (review comes in the next lesson)

<details>
<summary>Sample answer</summary>

You've succeeded if Files changed shows a line with a green `+` and the PR page is in the `Open` state. **Don't merge it yet** — you'll use it in the next lesson.

</details>

## Summary

The new operations in this lesson are `push -u` and creating a PR. Three things to take away.

1. **`-u` is only needed the first time you push a new branch.** The error message tells you the right command
2. **A PR is "a request to merge."** You can create it from the banner that appears after you push
3. **The tab to look at is Files changed.** Reviewers look here too

The request is in. In the next lesson you'll **check it and merge it**. How to fix a merge conflict is covered there too.

## Check your understanding

1. At the point where you create a PR, nothing has changed on the main story (`main`) yet. So what state has the PR put things in? Explain it in one sentence using the word "request."
2. When `git push` gives you an error, what's the first thing you do? Answer based on what you actually did in this lesson.
