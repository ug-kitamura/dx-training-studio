<!-- source: sha256:c706ea9a7cae261f49bb45a91b1fbdb5432f6060a9d70b2ade11151dc0161929 -->

# Your first commit

## Learning goals

The wait is over — this is where the real work starts. You have the map (the three areas) and an environment where you can run commands. In this lesson you'll finally **make your first save (commit) with your own hands**. The goal: you can add a file and commit it, and you can **use `.gitignore` to exclude files you don't want to save**.

Let's say this up front: it's completely fine if the commit you make here doesn't come out the way you expect. It's a practice folder, and you can redo it as many times as you like. The last lesson of this course covers how to go back when you make a mistake, so for now just dive in and get your hands moving.

## Turn a practice folder into a repository

First, set up a place to practice.

1. Create a new folder called `git-practice` somewhere you like (your Documents folder, for example)
2. Open that folder in VSCode via "File" → "Open Folder"
3. Open a terminal via "Terminal" → "New Terminal"

`init` is the command that turns this folder into a Git repository. It's the first of the seven basic operations promised in the first lesson of the series.

```bash
git init
```

If you see `Initialized empty Git repository in ...`, it worked. What just happened is that **a hidden folder called `.git` — the vault for your save data — was created inside this folder**. This is what the "repository" you learned about in the three areas lesson actually is on disk.

> [!CAUTION]
> **Do not open or delete anything inside the `.git` folder.** Deleting it wipes out the entire history of this folder.

## Ask Git about the current state

Next, create one file. Click the **"New File" icon** above the file list on the left side of VSCode, type `memo.txt`, and press Enter. In the file that opens, write a line — "Git practice" works fine — and save it with Ctrl+S.

Now run the second operation, `status`.

```bash
git status
```

```text
Untracked files:
        memo.txt
```

(The real screen has a few more lines, like `On branch ...`; every example output in this lesson shows only the key parts.)

The `memo.txt` you just created appears under `Untracked files`. That label means "a file that has never been included in a save," but you don't need to memorize the term. What matters is that **status tells you the current state whenever you ask**. From here on, whenever you're unsure, just run `git status` — make it a habit.

## Pick, then save

As the map of the three areas showed, saving happens in two steps. First **pick the changes to include in the save** (add), then **save them** (commit).

```bash
git add memo.txt
```

If nothing is printed, it worked (Git is a tool that often stays quiet on success). You may see a warning like `LF will be replaced by CRLF` — that's a notice about how line endings are handled, not a failure. Ignore it and keep going.

Now run `git status` again. You can see that `memo.txt` has moved to `Changes to be committed` — it's in the staging area. The status output you saw in the three areas lesson is now on your own screen.

Now for the save itself.

```bash
git commit -m "Add a memo"
```

The `"..."` after `-m` is **a short note attached to the save**, called a commit message. Write **briefly what you did**, so that when you look back at the history you can tell what the save was for. Don't worry yet about writing good ones — something like "Add a memo" is plenty.

Run `git status` one more time and you get:

```text
nothing to commit, working tree clean
```

"There's nothing to save" — in other words, **every change has been saved**. The three areas lesson promised that "not shown = identical to what's saved in the repository," and this output is that promise made real. Congratulations — your first commit is done.

_Source: [Pro Git, "Git Basics - Recording Changes to the Repository"](https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E5%9F%BA%E6%9C%AC-%E5%A4%89%E6%9B%B4%E5%86%85%E5%AE%B9%E3%81%AE%E3%83%AA%E3%83%9D%E3%82%B8%E3%83%88%E3%83%AA%E3%81%B8%E3%81%AE%E8%A8%98%E9%8C%B2) (retrieved August 2026)_

<!-- 訳注: リンク先は日本語版 Pro Git のまま（契約: URL は変えない）。英語版へ差し替えるかは人の判断 -->

## How it looks in VSCode

Everything you just did with commands can also be done from the VSCode UI.

<!--
A UI mock of the VSCode Source Control view. In the activity bar on the far left, the branching Source Control icon. In the panel, the filename memo.txt listed under a "Changes" heading, with a "+" button to the right of the filename. At the top of the panel, a commit message input field and a blue "Commit" button. Add only two annotations, "+ = git add" and "Commit button = git commit"; do not add any other explanatory labels, hints, or titles.
Matching the real screen matters for this diagram. If the generated quality is poor, use a screenshot instead.
-->
![UI mock of the VSCode Source Control view showing that + is git add and the Commit button is git commit](images/vscode-source-control-add-commit-7.png)

Click the **branching icon** on the far left (Source Control) and you get a list of changed files. The **"+" next to a filename is `git add`**, and the **"Commit" button above is `git commit`**. Don't worry about where the buttons sit — remember this instead: **what runs underneath is the same add and commit you just used**. In real work you'll often use this screen, but the mechanism is exactly what you learned with commands.

## Decide what not to save

Finally, something that always comes up in real work. When you build a tool, **files that your script outputs** (aggregated results, logs, and so on) appear in the folder. These are things you can regenerate any number of times, so you don't include them in your save data. Save the source code, don't save the generated output — that's the basic rule.

The mechanism for this is **`.gitignore`** (the list of what not to save). Create a file named `.gitignore` directly in the folder and write the filenames you want to exclude, one per line. The files listed there stop appearing in status, and `git add` no longer picks them up.

Note that the `.gitignore` file itself **does get committed**. "What we exclude" is a rule the whole team wants to share.

## Try it

Get hands-on and confirm the flow of excluding generated files.

1. Create a file called `output.json` in the `git-practice` folder (imagine it's a script's output file; it can be empty)
2. Confirm that `output.json` appears in `git status`
3. Create a file called `.gitignore`, write the single line `output.json`, and save it
4. Run `git status` again and confirm that `output.json` **no longer appears**

- Given: continue from the practice repository you made in this lesson
- Don't worry about: the contents of `output.json`, or advanced `.gitignore` syntax (writing a single filename on one line is enough)

<details>
<summary>Sample answer</summary>

If `output.json` has disappeared from status, it worked (it's normal for `.gitignore` to show up as a new file instead — go ahead and add and commit it).

</details>

## Summary

This lesson added four operations: `init`, `status`, `add`, and `commit`. Four things to take away:

1. `git init` — turn a folder into a repository (once, at the very beginning)
2. `git status` — when in doubt, run this. It tells you the current state
3. `git add` → `git commit -m "note"` — pick, then save
4. `.gitignore` — the list of what not to save. **Don't save generated files**

In the next lesson you'll work on **reading** the save data as it piles up: history and diffs. Congratulations on your first save. That was the biggest step of them all.

## Check your understanding

1. Which of these operations creates a new save (commit) — "edit a file and save it," "run git add," or "run git commit"? Give the reason in one sentence.
2. Why don't you commit the output files your script produces? Explain it in your own words, using the word "generated."
