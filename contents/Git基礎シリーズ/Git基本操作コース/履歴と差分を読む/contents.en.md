<!-- source: sha256:4e0a9e83622f7e6488ddce6c2191e87507d9ac4948c2166f554ff2c37eb0be3d -->

# Reading history and diffs

## Learning goals

You've reached the halfway point of the Git Basic Operations Course. In the previous lesson you worked through **making** save data. This lesson is about **reading** it. The goal: using `status`, `log`, and `diff` for what each one is good at, so you can **check "what's going on right now" yourself, without asking anyone**.

You stop work, come back the next day, and freeze: "where did I get to yesterday?" Today's three commands are for exactly that moment. Being able to check your own situation when you're stuck is a foundation that keeps paying off for a long time.

## Three commands for asking about state

Start with a map of their roles. Each of the three commands points in a different **direction in time**.

| Command  | Direction in time | What it tells you                        |
| -------- | ----------------- | ---------------------------------------- |
| `status` | **now**           | Whether there are unsaved changes        |
| `log`    | **the past**      | What saves have piled up so far          |
| `diff`   | **the difference**| What changed, and *how*                  |

`status` is the one you made a habit of in the previous lesson. Today you add the other two, `log` and `diff` (that brings you to six of the seven operations).

## View the list of saves

Open your practice repository (`git-practice`) in VSCode and run this in the terminal.

```bash
git log
```

```text
commit 3f2a1c9... (HEAD -> main)
Author: Your Name <email address>
Date:   Tue Aug 11 10:00:00 2026

    Add a memo
```

The save data you made in the previous lesson is shown, newest first (two entries if you also committed `.gitignore`, one if you didn't — either is normal). This list of accumulated save data is what Git calls the **history** — the "history" in this lesson's title. You can see that each save records **who, when, and what they did**. Your own name should appear on the Author line — the player name you set in the Git Setup Course is what's being used here.

Two things you can skip right over. The long string of letters and digits to the right of `commit` is something like a serial number for the save, and **you never need to read it** (the real one is much longer than the example, and the date format differs slightly by environment. All example output in this lesson shows only the key parts). The `main` in `(HEAD -> main)` is the name of a mechanism called a "branch," which **is covered in the GitHub Basics Series**. Ignore it for now.

> [!TIP]
> When the log gets long, the screen switches over and your input can look like it stopped working. **Press the `q` key to get back.** This is the number one panic point for first-timers, so learn it in advance.

That full output is too long for everyday use, so in real work the one-line view is common.

```bash
git log --oneline
```

Each save becomes a single line of "number + message." This is where writing commit messages as "briefly what you did" pays off — you can follow the flow of the work just by skimming the list.

## Compare the current state against a save

If `log` is a list of the past, `diff` shows you **the difference between your live play state and the most recent save**. For example, with one extra line written into `memo.txt`, running `git diff` shows this.

```diff
diff --git a/memo.txt b/memo.txt
index ddc1c4c..d834c01 100644
--- a/memo.txt
+++ b/memo.txt
@@ -1 +1,2 @@
 Git practice
+diff practice
```

It looks messy, but you only need to learn one way of reading it. **A `+` at the start of a line means "a line that was added," a `-` means "a line that was removed," and no symbol means "a line that didn't change."** The top four lines (from `diff --git` down to `+++`) are a preamble saying which file this is about, and the line starting with `@@` is position information within the file — you can skip both (the numbers after `index` differ from person to person).

So this example reads as: "the line `Git practice` stayed as it was, and the line `diff practice` was added." When you rewrite a line, the old line appears with `-` and the new line with `+`, as **a pair of lines**.

Note that what `git diff` shows you by default is "changes you haven't added yet." Strictly speaking there are a few more distinctions, but **at first, "the command for seeing changes that aren't in a save" is enough**. When the time comes that you want to see changes you've already added, you type `git diff --staged` (no need to memorize that now).

## How it looks in VSCode

In VSCode, **just clicking** a changed filename in the Source Control view opens a comparison screen with the before and after side by side. Instead of `+`/`-` symbols, added lines get a green background and removed lines a red one. The way you read it is the same as with the command — **what was added, and what was removed**.

<!--
A UI mock of the VSCode diff comparison screen. In the activity bar on the far left, the branching Source Control icon; in the sidebar, the filename memo.txt under "Changes". The editor area shows memo.txt before and after in two side-by-side panes, with removed lines highlighted on a red background and added lines on a green background. Reproduce the screen only. Do not add explanatory labels, hints, or titles that do not appear on the real screen.
Matching the real screen matters for this diagram. If the generated quality is poor, use a screenshot instead.
-->
![Diff view of memo.txt opened from VSCode Source Control, with two panes and a red removed line and a green added line](images/vscode-diff-view-mock-3.png)

_Source: [Visual Studio Code documentation, "Source Control"](https://code.visualstudio.com/docs/sourcecontrol/overview) (retrieved August 2026)_

## Try it

Go one full lap around your own repository: change → check the diff → save → check the history.

1. Add any one line to `memo.txt` and save the file with Ctrl+S
2. Confirm with `git diff` that the line shows up with a `+`
3. Commit it with `git add memo.txt` → `git commit -m "Add one line"`
4. Confirm with `git log --oneline` that your new save has appeared at the top of the list

- Given: use the practice repository from the previous lesson
- Don't worry about: what the added line says, or how to write good messages

<details>
<summary>Sample answer</summary>

Done if you see the `+` line at step 2, and "Add one line" at the top of the list at step 4.

</details>

## Summary

Today's takeaway is **the direction in time of three commands**.

1. `status` — **now**. Are there unsaved changes?
2. `log` — **the past**. The list of save data (press `q` to get out when it's long)
3. `diff` — **the difference**. `+` is an added line, `-` is a removed line

The next lesson wraps up this course with "**going back** when you make a mistake" — the last of the seven operations. Get that far, and the goal is in sight.

## Check your understanding

1. "I want to remember how far I got yesterday." Which do you run first — status, log, or diff? Give your reason in one sentence (there may be more than one right answer).
2. Explain the difference in role between `log` and `diff`, one sentence each, using the word "save."
