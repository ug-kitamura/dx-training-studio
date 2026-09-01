<!-- source: sha256:b37b2917b7976ad016fc54f64bf8e269226c9bf6c310d733151153eb6b29105f -->

# Review, merge, and fix conflicts

## Learning goals

The request (the PR) is in. All that's left is to **check what's in it and merge it**. This lesson has three goals: **being able to comment on a line in a PR**, **being able to merge it into the main story**, and **being able to fix a conflict when one happens**.

This is exactly the procedure for the hands-on day. On the day, your partner looks at your PR and you look at theirs. **You're going to practice that now, on your own.**

## Reviewing — commenting on a line

Open the PR you created in the previous lesson in your browser. Move to the **Files changed** tab.

Hover over the left edge of a line and a **blue "+" button** appears. That's the way in to a comment.

1. Click the **"+"** at the left edge of the line you want to comment on
2. An input box opens; write your comment (for example, `I'd like to make this line consistent with the others`)
3. Click **"Add single comment"**

That attaches **a comment tied to that line**. The advantage of this mechanism: you don't have to spell out the file name and line number.

To submit comments all at once, choose one of the three options under **"Review changes"** in the top right.

| Option | What it means | When to use it |
|---|---|---|
| **Comment** | Share thoughts or questions. Doesn't judge whether it's OK | When there's something you want to ask |
| **Approve** | Approve it: "this is fine to merge" | When you've looked and there's no problem |
| **Request changes** | There's something you want fixed | When changes are needed |

> [!IMPORTANT]
> **You can't Approve your own PR.** GitHub doesn't let you approve your own request. Since you're practicing alone right now, **Comment** is the only one you can choose. **You'll use Approve in the hands-on when you look at your partner's PR** — and you'll choose it on this same screen.

> **社内画像**: 社内GitHub の PR で、レビューからマージまでの一連の操作の短い画面録画（10秒以内が目安）。①Files changed で行の「＋」からコメントを付ける ②Review changes を開いて Approve を選び送信する ③Conversation タブに戻って Merge pull request → Confirm merge を押す、までを続けて撮る。**Approve は自分の PR には出せないため、撮影は2つのアカウント（レビュアー役と作成者役）が必要**。ユーザー名・組織名・URL のホスト部分・アバター画像はマスクする

<!-- 訳注: `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

## Merging

Once you've checked it, merge it. Go back to the PR's **Conversation** tab.

1. Click **"Merge pull request"**
2. Click the confirmation button, **"Confirm merge"**
3. The screen changes to a purple "Merged" state
4. A **"Delete branch"** button appears — press it to tidy the branch away

Step 4 isn't required, but **it's the normal thing to do**. Once a side route has been merged, it has done its job, and leaving it around clutters the list. Deleting it loses nothing, because what merged is now in the main story.

Now, the main story (`main`) has been updated on the shared vault. **Your machine is still on the old version.** Let's bring it in.

```bash
git switch main
git pull
```

Open `README.md` and the line you wrote on the side route is in the main story. You've come all the way round the loop.

```text
  main (main story)   ──●───●───────────●──▶  ← you just pulled this
                             \          /
  add-greeting                ●───●───┘
                                   (merged; the branch can be deleted)
```

**After merging, `git pull` on your machine.** Make this a habit too. Forget it, and you'll branch your next route off a stale main story.

## What happens when things collide

Here's the one part of this series people call scary. Let's give away the ending first. **Nothing gets corrupted when a conflict happens.** Git just can't decide on its own, so it's asking a person "which one do you want?"

It happens when **two routes have separately rewritten roughly the same place in the same file**. If the lines are far apart, Git brings in both automatically. And if the changes are in different files, there's no conflict at all.

> [!NOTE]
> Strictly speaking, touching an adjacent line or deleting a whole file can also collide. But **"when two people touched roughly the same place" is plenty to start with**.

When there's a conflict, the inside of the file looks like this.

```text
<<<<<<< HEAD
- Rewritten on the side route
=======
- Rewritten on the main story
>>>>>>> 4e5f6a7
```

You only need to learn three marker lines to read it.

| Marker | What it means |
|---|---|
| From `<<<<<<< HEAD` to `=======` | What's on **the route you're currently on** |
| From `=======` to `>>>>>>>` | What's on **the side being brought in** |

What appears to the right of `>>>>>>>` is a label identifying the incoming side (a branch name or a commit ID). **Which one appears on top depends on which route you're working on.** Rather than top and bottom, remember that the one with `HEAD` on it is your side.

What you have to do is **decide which to keep (or how to blend both) and delete the marker lines**. The three lines `<<<<<<<`, `=======`, and `>>>>>>>` are just markers, so **none of them should be left** when you're done.

In VSCode you can do this with buttons. Open the conflicted file and options appear above the markers.

| Button | What's left |
|---|---|
| **Accept Current Change** | Only the `HEAD` side (the route you're on) |
| **Accept Incoming Change** | Only the side being brought in |
| **Accept Both Changes** | Both (one after the other) |

Press one and the markers disappear along with everything you didn't choose.

_Source: [VS Code Docs, "Resolve merge conflicts"](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts) (retrieved August 2026)_

Once the conflict is resolved, the rest is business as usual.

```bash
git add README.md
git commit -m "Resolve the conflict"
git push
```

The conflict warning disappears from the PR screen and you can merge.

> [!TIP]
> **It's perfectly normal for this not to click on one reading.** Come back to this section when you actually hit a conflict. Pasting the screen straight to the AI and asking "what is this?" also works — treat it just like an error message.

<details>
<summary>Cause a conflict on your own (optional)</summary>

Steps for anyone who wants to see the real thing. It takes about five minutes, so do it when you have time.

> [!IMPORTANT]
> **Finish the "Try it" below (merging the PR) before you start this.** If you rewrite `main` here, the PR still sitting open will conflict and won't be mergeable.

1. Open internal GitHub in your browser, edit `main`'s `README.md` from the pencil icon, change the last line to `- Rewritten on the main story`, and Commit changes
2. On your machine, do **not** run `git switch main` → `git pull` first (**pulling would remove the very condition for the conflict**). Instead, create a side route with `git switch -c conflict-test`, change **that same last line** to `- Rewritten on the side route`, and commit
3. `git push -u origin conflict-test` and create a PR
4. The PR screen says **"This branch has conflicts that must be resolved"**
5. Still on the `conflict-test` branch, run `git pull origin main` and the markers you saw above appear in `README.md`
6. Choose one side with the VSCode buttons or by hand, delete the markers, then `git add` → `git commit` → `git push`
7. The conflict warning disappears from the PR screen

</details>

## Try it

Comment on your own PR and merge it.

1. In the PR's **Files changed**, add one comment via **"+"** on the line you added
2. Go back to the **Conversation** tab and click **"Merge pull request" → "Confirm merge"**
3. Tidy the branch away with **"Delete branch"**
4. On your machine, `git switch main` → `git pull` and check that it's reflected in the main story

- Given: the PR you created in the previous lesson is still Open
- Don't worry about: what the comment says (`This is a practice comment` is fine). You can't Approve your own PR, so there's no need to try

<details>
<summary>Sample answer</summary>

You've succeeded if, after step 4, the line you wrote on the side route is in `main`'s `README.md`.

</details>

## Summary

Three things to take away from this lesson.

1. **Reviewing means commenting on lines.** To submit them together, use Review changes (Comment / Approve / Request changes)
2. **After merging, `git pull` on your machine.** Bring the main story up to date before branching your next route
3. **A conflict isn't damage.** It happens when two routes change roughly the same place. Delete the markers, and a person decides which to keep

Create a repository, clone it, push, branch, open a PR, comment, merge. **You've already turned the whole GitHub loop with your own hands.** The loop you just ran solo runs exactly the same with two people — you just add a person, and not a single operation is added.

In the hands-on you'll invite your pair partner to your repository, look at and comment on each other's PRs, approve, and merge. **The one button you haven't tried yet, Approve**, is one you'll press for the first time then. Because you've already opened one PR, on the day you can focus on the content rather than the mechanics.

## Check your understanding

1. When do conflicts happen? Explain it in one sentence using the word "same" twice. (Also answer which side gets the `<<<<<<< HEAD`.)
2. Why do you run `git pull` on your machine after merging? Explain it using the words "the shared vault" and "your machine."
