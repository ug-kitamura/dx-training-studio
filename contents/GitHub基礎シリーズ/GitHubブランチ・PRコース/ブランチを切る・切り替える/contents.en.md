<!-- source: sha256:0eb163112ceee6cd03dd0f545f14cf7e58d417915da3d40941e8900201d59a49 -->

# Creating and switching branches

## Learning goals

So far you can move things back and forth between your machine and the shared vault. But there's one weakness in how you've been doing it: **the moment you commit, it goes onto the history of the "main story."** Code you only tried out, half-written text — once you save it, it lines up on the same single route.

The goal of this lesson is to **be able to create a side route branching off the main story and work on it**, and to **be able to say in your own words why you'd split it off**. That side route is called a **branch**.

In the Git Basics Series we said this word would only come up by name, and we've been putting it off ever since. Here it becomes real.

## Why create a side route?

Let's start by saying out loud what you're probably thinking. **"I'm working alone — is there any point in splitting?"** That's a fair question. In fact, every lesson up to now worked fine without branches.

There are three reasons.

| Reason | What it means |
|---|---|
| **You can keep the main story working at all times** | Only finished things go into `main` (the main story). Put work-in-progress on a side route, and anyone who looks at the main story while your work is still in progress finds it unbroken |
| **Failures are easy to throw away** | Try it on a side route, and if it doesn't work out, throw the whole route away. As far as the main story is concerned, nothing ever happened |
| **Someone can look before it merges** | Just before your side route joins the main story, a teammate can check what's in it. That mechanism is the pull request, which is the next lesson |

The third one matters most at work. And **in the hands-on, that's literally the procedure for having your pair partner look at your code**. Practice it alone now and you won't hesitate on the day when you're paired up.

Here it is as a diagram.

```text
                                        merge back in here
                                               │
  main (main story)            ──●───●───────────●──▶
                                     \          /
  add-greeting (side route)           ●───●──┘
                                     ↑
                                branch off here
```

`main` is the main story and the lower branch is the side route. **Whatever you do on the side route, the `●` marks on the main story neither multiply nor disappear.** That's what "try things without breaking anything" means.

_Source: [Pro Git, "What a Branch Is"](https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%83%96%E3%83%A9%E3%83%B3%E3%83%81%E6%A9%9F%E8%83%BD-%E3%83%96%E3%83%A9%E3%83%B3%E3%83%81%E3%81%A8%E3%81%AF) (retrieved August 2026)_

> [!NOTE]
> Strictly speaking, a branch is "a marker pointing at a commit." But **"side route" is plenty for a first understanding**, and it carries you through everything that follows. That definition can wait until you need it.

## Create, move, come back

Start with the `github-practice` folder open in VSCode. **From here on, type the commands as you read.** There are three operations.

**See where you are now**

```bash
git branch
```

```text
* main
```

The one with the `*` is **the route you're currently on**. You only have `main` so far.

**Create a side route and move onto it**

```bash
git switch -c add-greeting
```

```text
Switched to a new branch 'add-greeting'
```

The `-c` is the first letter of "create," and it means **create it and move onto it at the same time**. `add-greeting` is the route's name, and you choose it. Make it **a name that says what the route is for** (with `test` or `aaa`, three days from now you won't remember what it was for).

**Come back to the main story**

```bash
git switch main
```

Don't add `-c` when coming back. `-c` is only for "create a new one."

Your current branch also shows on the first line of `git status`.

```text
On branch add-greeting
```

The Git Basics Series said "when in doubt, `git status`." Once you have more than one branch, **looking at that first line** is the surest way to tell.

## What happens to the main story when you edit on a side route

Being told "the main story is untouched" probably doesn't land yet. **Let's check it for yourself.** It takes three minutes.

1. Move to the side route with `git switch -c add-greeting` (if you already created it, `git switch add-greeting`)
2. Add the line `- A line written on the side route` at the end of `README.md` and save
3. `git add README.md` → `git commit -m "Add one line on the side route"`
4. Go back to the main story with `git switch main`
5. **Open `README.md` in VSCode**

At step 5, **the line you just added is gone.** Don't be alarmed — it wasn't deleted, it's just that **that line only exists on the side route**.

6. Go back to the side route with `git switch add-greeting`
7. Open `README.md` again — **the line is back**

That's "whatever you do on a side route, the main story is untouched," made concrete. When you switch branches, **the folder's contents are replaced with that route's version**.

> [!WARNING]
> Before you switch, **commit the file you're editing.** If you try to switch with uncommitted edits in your files, Git may stop you. If it stops you, "commit first" is all you need to remember.

## What this looks like in VSCode

<!--
A UI mock of the left end of the status bar at the bottom of the VSCode window (the thin dark blue strip). To the right of a branch-shaped icon, the branch name "add-greeting" is shown. Reproduce the screen only. Add no explanatory labels, hints, or titles that don't appear on the real screen.
This diagram needs to match the real screen. If the generated quality is poor, use a screenshot instead.
-->
![VS Code status bar strip with a branch icon and the branch name add-greeting at its left end](images/vscode-status-bar-branch-add-greeting-2.png)

VSCode always shows the branch you're on at the **left end of the status bar — the strip along the very bottom of the window**. Click it and a list of branches opens, and you can switch. "Create new branch" near the top of that list is the equivalent of `git switch -c`.

While you work, **keeping an eye on that bottom left alone will stop you from getting the branch wrong**.

_Source: [VS Code Docs, "Source Control"](https://code.visualstudio.com/docs/sourcecontrol/overview) (retrieved August 2026)_

## Try it

**Make one commit on your side route.** The next lesson starts from this state.

1. Check which branches you have with `git branch`
2. **If `add-greeting` isn't in the list**, `git switch -c add-greeting`; **if it already is**, move onto it with `git switch add-greeting`
3. Check that the first line of `git status` reads `On branch add-greeting`
4. Add a line to `README.md` and save, then `git add README.md` → `git commit -m "Add one line on the side route"` (skip this if you already did it while reading)
5. Go back to the main story with `git switch main`, and check that the bottom left of VSCode changes to `main` and the line you added disappears
6. Go back to the side route with `git switch add-greeting`

- Given: do this in the `github-practice` folder. If you have a file mid-edit, commit it first
- Don't worry about: branch naming conventions (rules like prefixing with `feature/` differ from team to team at work)

<details>
<summary>Sample answer</summary>

You've succeeded if, after step 6, the bottom left of VSCode says `add-greeting` and `git log --oneline` shows the commit you just made.

</details>

## Summary

Two new operations in this lesson: `branch` and `switch`. Three things to take away.

1. **A branch is a side route split off from the main story.** You can try things without breaking the main story (`main`)
2. **`git switch -c <name>`** creates one and moves you onto it; **`git switch main`** brings you back. `git branch` lists them
3. **Switching swaps the contents of the folder.** When in doubt, check the first line of `git status`, or the bottom left of VSCode

Your side route still only exists on your machine. In the next lesson you'll send it to the shared vault and **request that it be merged into the main story** — the pull request.

## Check your understanding

1. What happens to the files in your folder when you switch branches? Explain it in one sentence using the phrase "side route."
2. Of the three reasons for branching while working alone, pick **the one that convinced you most** and explain it in your own words.
