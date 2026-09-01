<!-- source: sha256:e3b80204a9bf90eddada80bf60a63ecbb08c208aae55fc9230f7a9f654dbbfc0 -->

# Undoing your changes

## Learning goals

At last, the final lesson of this series. In the very first lesson you learned that "with version control, you can make changes with confidence." In this lesson you'll **confirm that confidence with your own hands**. The goal: being able to **safely revert changes you haven't committed yet**. This is where `restore`, the last of the seven operations, comes in.

You're going to break a file on purpose and then bring it back. You may feel that breaking things is scary — getting rid of that fear is exactly what this lesson is for.

## There is more than one kind of "I want to undo that"

"I want to undo that" actually covers two different situations.

<!--
The two "I want to undo that" situations as two side-by-side comparison cards. Left card, "I want to wipe out my edits": an arrow going from a file that has been edited into a mess back to the state of the most recent save, with the command label git restore. Right card, "I want to undo an add": an arrow showing a file in the staging area simply dropping back to the working tree, with the edits left untouched, and the command label git restore --staged
-->
![Two comparison cards contrasting git restore with git restore --staged](images/git-restore-two-cases-3.png)

| Situation                                       | What it does                                                | Command                |
| ----------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| **I want to wipe out my edits**                 | Reload from the most recent save and start over              | `git restore`          |
| **I want to undo an add**                       | Take it back out of the staging area (your edits are kept)   | `git restore --staged` |

Both are done with `restore`. These two are all you need.

There is also a way to **undo something you've already committed** (redoing the save itself), but this series doesn't cover it. When you need it, paste your situation into the internal AI chat and ask. Say "I want to undo a git commit" and it will tell you the name of the tool.

## Reload from the most recent save

To wipe out all your edits to a file and go back to the state of the most recent save:

```bash
git restore memo.txt
```

This rewinds the file's contents to how they were at your last commit. In game terms, this is **quitting your current play and reloading from the most recent save**. (Strictly speaking, if you have already added some changes, it goes back to "the point where you added," but "goes back to the most recent save" is enough for a first understanding.)

_Source: [git-restore documentation](https://git-scm.com/docs/git-restore) (retrieved August 2026)_

> [!CAUTION]
> **Edits erased by restore cannot be brought back.** It is the only one of the seven operations whose result you cannot undo. Get into the habit of running `git status` before you run it, to check what is about to disappear.

It's the same as unsaved progress disappearing when you reload. Flip that around and it means: **the more often you commit, the safer restore becomes**. As long as you have the habit of checking, it isn't a scary operation.

By the way, if you search for ways to undo things, you'll often turn up older articles using `git checkout` or `git reset`. `restore` is a newer command, added specifically for undoing, and **these days learning just this one is enough**. You don't need to force your way through the commands in those older articles.

## Undo an add

The other situation. When you realize, after running `git add`, that "I didn't mean to include this in this save":

```bash
git restore --staged memo.txt
```

This **only takes it back off the staging area**. It doesn't touch the file's contents at all — in terms of the map of the three areas, the change simply moves back from the staging area to the working tree. Nothing disappears, so this one you can run with peace of mind.

The staging area has now shown up three times: you learned that it exists in the Git Concepts Course, you put changes into it with add in the previous lesson, and here you take them back out. By the third time, it should be starting to feel familiar.

## How it looks in VSCode

Next to a changed file in the Source Control view, **"Discard Changes" (the curved arrow icon)** corresponds to `git restore`. Unlike the command, a confirmation dialog appears before it runs — that's VSCode's own safety catch. To undo an add (the equivalent of `--staged`), use the "−" button next to a staged file.

<!--
A UI mock of the VSCode Source Control view. In the activity bar on the far left, the branching Source Control icon. In the sidebar, the filename memo.txt under a "Staged Changes" heading with a "−" button to its right, and under a "Changes" heading another filename with a curved-arrow "Discard Changes" icon to its right. Reproduce the screen only. Do not add explanatory labels, hints, or titles that do not appear on the real screen.
Matching the real screen matters for this diagram. If the generated quality is poor, use a screenshot instead.
-->
![The VSCode Source Control view with staged files and changed files listed together](images/vscode-source-control-view-2.png)

_Source: [Visual Studio Code documentation, "Staging and committing changes"](https://code.visualstudio.com/docs/sourcecontrol/staging-commits) (retrieved August 2026)_

## Try it

Break something on purpose, then bring it back with restore.

1. Open `memo.txt` in your practice repository, **delete all of its contents**, and save (go for it!)
2. Confirm with `git status` that `memo.txt` shows as changed
3. Run `git restore memo.txt`
4. Look at `memo.txt` in VSCode and confirm that the contents are back

- Given: the practice repository you've been using (with `memo.txt` already committed)
- Don't worry about: how you break it. Instead of deleting everything, scattering random characters works too

<details>
<summary>Sample answer</summary>

It worked if the contents are back to the state of the last commit at step 4 (if VSCode doesn't reload automatically, close and reopen the file).

</details>

## Summary

Two ways to go back — and with that, all seven operations are in place.

1. `git restore <filename>` — wipe out your edits and reload from the most recent save (**the erased edits do not come back** — the one command to be careful with)
2. `git restore --staged <filename>` — only takes it back out of the staging area. Your edits are untouched

`init`, `status`, `add`, `commit`, `log`, `diff`, `restore` — you have now typed all seven of the operations promised in the first lesson of the series, with your own hands. Nicely done. **The Git Basics Series is cleared.** "I can save my work at any time, and safely go back to it" — the weapon promised in the first lesson is already in your hands.

On the Mandala, the next quest — the **GitHub Basics Series** — has been unlocked. That series covers how to share a repository with your team and how to work together using branches.

## Check your understanding

1. How far back can `git restore` take you? Explain it in one sentence, using the word "save."
2. Restate the difference between `git restore` and `git restore --staged` in one sentence each, focusing on what disappears.
