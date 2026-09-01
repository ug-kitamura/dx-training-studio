<!-- source: sha256:87b23374adf5552ea36c973198d2412c0ffa8581e9c079b365e949cf66b9e648 -->

# Push and pull

## Learning goals

Your machine and the shared vault are now connected by a line. In this lesson, data actually travels along that line. The goal: **being able to send your local saves to the shared vault (push)**, and **being able to bring changes from over there into your machine (pull)**.

In the Git Basics Series, these two words only came up by name. Here they become real. There's nothing difficult here. **Send** and **bring in** — there are just two directions.

```text
 Local vault  ──── push (send) ────▶  Shared vault
              ◀─── pull (bring in) ───
```

## Sending — push

In VSCode, open the `github-practice` folder you cloned in the previous lesson. You'll edit `README.md` in that folder and send it to the shared vault.

Edit it first. Open `README.md`, rewrite the contents like this, and save (`Ctrl+S`).

```markdown
# GitHub practice

A practice repository for the GitHub Basics Series.

## What I've done

- Created a repository and cloned it
- Wrote the README
```

From here it's exactly what you did in the Git Basics Series. **Save first, then send.**

```bash
git status
git add README.md
git commit -m "Write the README"
```

In `git status`, `README.md` appears under `Changes not staged for commit`. Run `git status` again after `git add`, and it moves to `Changes to be committed` — the same behavior you saw in the Git Basics Series.

At this point your local vault has one more save in it. But **the shared vault still knows nothing about it**. If you open the repository on internal GitHub in your browser, the README is still the original one.

Let's send it.

```bash
git push
```

A few lines of output scroll by, and if a line like `main -> main` appears at the end, it worked.

Reopen the repository page on internal GitHub in your browser (reload it if it's already open). **The README you just wrote should be showing.**

> **社内画像**: 社内GitHub のリポジトリトップページで、push した README.md が整形表示された状態。見出し「GitHub の練習」と箇条書きが本文の下に表示されている画角。ユーザー名・組織名・URL のホスト部分はマスクする

<!-- 訳注: `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

Notice that saving (commit) and sending (push) are **separate operations**. However many times you commit locally, nothing reaches the shared vault until you push. This also means **you can let a few commits pile up before you send them**.

## The README is a signboard — just three bits of Markdown

The README you just wrote came out neatly formatted on screen. The `#` and `-` characters were turned into a heading and a bulleted list. That way of writing is called **Markdown**.

**README.md is the signboard you put up at the entrance to your vault.** When someone opens a repository, GitHub automatically formats README.md and shows it first. It's where visitors read "what is this repository?" and "how do I use it?"

There are **only three** bits of Markdown to learn in this training.

| How you write it | What it looks like |
|---|---|
| `# Heading` | A large heading (`##` for one size smaller) |
| `- Item` | A bulleted list |
| Wrap code in ` ```bash ` | A code block (commands and code in a box) |

You don't need to learn any more than that. There are ways to write tables and images too, but looking them up when you need them is enough.

> [!TIP]
> While you have a `.md` file open in VSCode, `Ctrl+Shift+V` shows you a formatted preview. You can check it before you push.

## Bringing it in — pull

Now the other direction. **When the shared vault has changed**, you bring the change into your machine.

At work this is the "a teammate pushed something" situation, but you're on your own right now, so **edit directly from the browser** to create that situation.

1. In the repository on internal GitHub, click `README.md` to open it
2. Click the **pencil icon** (Edit this file)
3. Add the line `- Edited from the browser` at the end
4. Click **"Commit changes"** to confirm (if a confirmation dialog appears, just confirm)

> **社内画像**: 社内GitHub のブラウザ上で README.md を編集する流れ。①README.md を開いた状態（鉛筆アイコンが見える画角） ②編集画面 ③Commit changes を押すところ。画面が変わるごとに1枚を目安に撮る。ユーザー名・組織名・URL のホスト部分はマスクする

Now there's a new save **only in the shared vault**. Look at your local `README.md` and that line isn't there.

Let's bring it in. Run this in the VSCode terminal.

```bash
git pull
```

```text
Updating a1b2c3d..4e5f6a7
Fast-forward
 README.md | 1 +
 1 file changed, 1 insertion(+)
```

(Only the key parts of the output are shown. In reality there are a few more lines.)

Open `README.md` in VSCode and the line you added in the browser is there.

Here's a habit to take with you. **Pull before you push.**

If a teammate has sent something first, Git will refuse your push, seemingly out of the blue. **Overwriting when the shared vault is ahead of your machine would wipe out your teammate's save** — that's what Git is stopping. Pull first to bring your machine up to date, then send. That way this never comes up. "**Bring in before you send**" — just remember the order.

## What this looks like in VSCode

<!--
A UI mock of the VSCode Source Control view. At the top of the panel, the commit message input box, and below it a blue button labeled "Sync Changes". Inside the button, a down arrow icon and an up arrow icon sit side by side. Add only two annotations — "down arrow = git pull" and "up arrow = git push" — and no other explanatory labels, hints, or titles.
This diagram needs to match the real screen. If the generated quality is poor, use a screenshot instead.
-->
![VS Code Source Control panel mock with a commit message box and blue Sync Changes button, annotated: down arrow = git pu](images/vscode-source-control-sync-changes-3.png)

After a commit, a **"Sync Changes"** button appears in the Source Control view. It **runs pull and push together**. It brings changes in before it sends yours, so at work this is the button you'll usually press.

Behind it are the two commands you just typed. Remember **what's happening inside the button**, not its name.

_Source: [VS Code Docs, "Source Control"](https://code.visualstudio.com/docs/sourcecontrol/overview) (retrieved August 2026)_

## Try it

Write a README.md, push it, and check how it shows on GitHub.

1. Add one line **in your own words** to your local `README.md` (what the practice repository is for, say)
2. `git add` → `git commit -m "..."` → `git push`
3. Reopen the repository on internal GitHub in your browser and check that the line you added is showing

- Given: do this in the `github-practice` folder you cloned in the previous lesson
- Don't worry about: what the text says. One line is plenty. For Markdown, either a heading or a bullet is fine

<details>
<summary>Sample answer</summary>

You've succeeded if the line you added shows up formatted on the repository's top page in the browser.

</details>

## Summary

Two new operations in this lesson: `push` and `pull`. Three things to take away.

1. **`git push`** — sends your local saves to the shared vault. **Committing alone doesn't get them there**
2. **`git pull`** — brings new saves from the shared vault into your machine
3. **Bring in before you send.** The "Sync Changes" button in VSCode runs those two together

Data now flows in both directions between your machine and the shared vault. In the next course you move on to **working without breaking the main story** — branches.

## Check your understanding

1. What's the difference between `commit` and `push`? Explain it in one sentence using the words "your machine" and "the shared vault."
2. Why do you "pull before you push"? Picture a situation where teammates are using the same repository, and explain it in your own words.
