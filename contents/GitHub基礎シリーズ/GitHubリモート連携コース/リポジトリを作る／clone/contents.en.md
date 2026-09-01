<!-- source: sha256:7307099f47becf956518ea8ac6379307cd92dc271c7b9b2c5858deaa34bf43a2 -->

# Creating a repository / clone

## Learning goals

You have the key. From here on, it gets hands-on. The goal of this lesson is to **create one shared vault of your own on internal GitHub, and copy it down to your machine**.

In the Git Basics Series you created a vault in a local folder with `git init`. This time it's the other way round: **you create the shared vault first, then bring it down to your machine**. That order is the more common one at work — a team's repository usually already exists, and you're the one joining it.

There's only one new operation in this lesson: `clone`.

## Creating a repository on internal GitHub

Before you start, open internal GitHub in your browser and sign in.

1. Click the **"+" button** in the top right of the screen and choose **"New repository"**
2. Check that **Owner** is your own username (you may be able to pick an organization, but for practice, pick yourself)
3. Enter `github-practice` under **Repository name**
4. For visibility, choose **Private** (only you and the people you invite can see it)
5. Tick **"Add a README file"**
6. Click **"Create repository"**

Once it's created, the repository's top page opens. It's a nearly empty vault with just one `README.md` inside.

> **社内画像**: 社内GitHub でリポジトリを作る流れ。①New repository の入力画面（Owner・名前・Private・Add a README にチェックが入った状態） ②作成直後のリポジトリトップページ（README.md が1つ表示された状態） ③緑の「Code」ボタンを押してポップオーバーが開き、**HTTPS の URL とコピーアイコンが見えている状態**。画面が変わるごとに1枚を目安に撮る。組織名・ユーザー名・URL のホスト部分はマスクする

<!-- 訳注: `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

There's a reason for ticking "Add a README file" in step 5. **Cloning a completely empty repository produces a warning, which is unsettling the first time.** With even one file in there, the steps that follow go smoothly.

> [!NOTE]
> Besides Private, the visibility options include Public (anyone can see it), but **this training only uses Private.** For what's permitted on internal GitHub, follow the constraints you went through in the first lesson of the GitHub Introduction Course.

_Source: [GitHub Docs, "Hello World"](https://docs.github.com/ja/get-started/start-your-journey/hello-world) (retrieved August 2026)_

## Cloning

**Clone is the operation that copies a whole shared vault down to your machine.** It copies not just the files but **the entire history of saves** along with them. That's the crucial difference from "download as ZIP."

First, find the address (URL) you're copying from.

1. On the repository's top page, click the green **"Code"** button
2. In the popover that opens, check that the **HTTPS** tab is selected
3. Press the **copy icon** to the right of the URL shown

Next, in VSCode, open **the folder where you want the clone to land**. This part matters — `git clone` creates a folder **inside wherever you currently are**, so if you run it while `git-practice` is still open — that's the practice folder from the Git Basics Series — **you'll end up with a vault inside a vault**.

1. In VSCode, use "File" → **"Open Folder"** to open your **Documents folder** (the folder that contains `git-practice`)
2. Open a terminal with "Terminal" → **"New Terminal"**

> [!IMPORTANT]
> **When you reopen the folder, reopen the terminal too.** A terminal left open from before keeps pointing at the old folder.

```bash
git clone <the URL you copied>
```

Select `<the URL you copied>`, angle brackets included, and paste your URL over it.

```text
Cloning into 'github-practice'...
remote: Enumerating objects: 3, done.
Receiving objects: 100% (3/3), done.
```

(Only the key parts of the output are shown.) **A folder called `github-practice` has been created** in the folder you're currently in, with README.md and `.git` (your local vault) inside it.

**A screen may come up asking you to authenticate** — this happens only the first time. When the browser opens, sign in with your company account as usual. No special setup is needed. Once you're through it, you won't be asked again.

Let's check that it worked. In VSCode, use "File" → "Open Folder" to open `github-practice`, and in a **new terminal** run this.

```bash
git log --oneline
```

```text
a1b2c3d Initial commit
```

One commit should appear. **You've never committed anything yourself, yet there's history** — that's what "copied along with the history" means. The commit from when the README.md was created has been copied down as-is.

## What this looks like in VSCode

You can do the same thing from the VSCode interface.

<!--
A UI mock of the VSCode command palette (the input box that opens at the top center of the screen). "Git: Clone" is typed into the input box, and the "Git: Clone" entry at the top of the suggestion list below it is highlighted. Reproduce the screen only. Add no explanatory labels, hints, or titles that don't appear on the real screen.
This diagram needs to match the real screen. If the generated quality is poor, use a screenshot instead.
-->
![The VSCode command palette with "Git: Clone" typed in and the top suggestion highlighted](images/vscode-command-palette-git-clone.png)

Open the command palette with `Ctrl+Shift+P`, type `Git: Clone` and select it, and you'll be asked for a URL. After that you just choose the folder to save into. What runs behind the scenes is the same `git clone` command you just typed.

Use the button or the command, whichever you like. That said, **when something goes wrong, the command is the one that shows you an error you can read**, so this series works mainly with commands.

_Source: [VS Code Docs, "Source Control"](https://code.visualstudio.com/docs/sourcecontrol/overview) (retrieved August 2026)_

## Inviting teammates (read this, don't do it yet)

A Private repository is visible only to the person who created it. To let a teammate see it, **you invite them as a collaborator**. You'll do this in the hands-on when you invite your partner as a reviewer.

1. Open the **"Settings"** tab on the repository page
2. Choose **"Collaborators"** from the left menu
3. Click **"Add people"**, enter the other person's **username**, and add them
4. They get an invitation notice, and once they accept, they have access to the repository

The "username" in step 3 is the one you noted from your profile in the GitHub Introduction Course. You'll be asking your teammates for theirs too.

> [!NOTE]
> **Just read this part — don't do it yet.** While you're studying on your own there's nobody to invite. You'll actually do it on the hands-on day, once pairs are decided. "Settings → Collaborators, invite by username" — just remember where it lives.

## Try it

Create a practice repository and clone it to your machine.

1. Create a Private repository called `github-practice` on internal GitHub (with README ticked)
2. Copy the HTTPS URL from the Code button
3. Open **the folder you want it to live in** in VSCode, and run `git clone <URL>` in a new terminal
4. Open the resulting `github-practice` folder in VSCode and check with `git log --oneline` that there's one commit

- Given: your internal GitHub account is approved. If it isn't yet, work on other series while you wait
- Don't worry about: the repository Description, the license, or picking a `.gitignore` template. Leave them all empty

<details>
<summary>Sample answer</summary>

You've succeeded if `git log --oneline` shows one entry saying `Initial commit` (or a message about adding the README).

</details>

## Summary

Only one new operation in this lesson: `clone`. Three things to take away.

1. **You create the shared vault on the GitHub screen** (New repository → name → Private → tick README)
2. **`git clone <URL>` copies it down to your machine.** Not just the files but **the history too** — that's the difference from a ZIP download
3. You invite teammates under **Settings → Collaborators**. You'll use it on the hands-on day

Your machine and the shared vault are now connected. In the next lesson, data actually travels along that connection — push and pull.

## Check your understanding

1. Explain the difference between `clone` and "download as ZIP" in one sentence, using the word **history**.
2. In the Git Basics Series you created a repository with `git init`. How does that differ from this lesson's `git clone`? Put it in your own words, focusing on "which one exists first."
