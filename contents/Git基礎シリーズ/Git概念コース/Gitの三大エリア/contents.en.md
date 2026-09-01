<!-- source: sha256:48d93de8d412541012292936fe437973882034155bd40698f011c888ebc3a8a9 -->

# The three areas of Git

## Learning goals

This lesson wraps up the concepts course. In the previous lesson you learned that version control lets you "go back anytime, keep a record, and make changes with confidence." In this lesson you'll get a map of the **three places (the three areas)** Git uses to make that happen.

No commands yet. If you get the map into your head first, then when you actually run the commands in the next course you'll know "where am I right now, and what did I just do?" Skip this part, and you end up able to type the commands without understanding what happened. Sometimes the long way round is the shortest.

## What Git stores is "save data"

First, let's pin down just one thing: what does Git actually record? Every time you save, Git keeps **the state of the entire folder at that moment**. Think of it not as "notes on what changed since last time" but as a full save of the whole folder, every single time. That's why you can reload any point in time. (If you're wondering "the whole folder every time — won't that eat up disk space?": Git is clever about saving space internally, so it's fine. You don't need to know how it works.)

_Source: [Pro Git, "Getting Started - What is Git?"](https://git-scm.com/book/ja/v2/%E4%BD%BF%E3%81%84%E5%A7%8B%E3%82%81%E3%82%8B-Git%E3%81%AE%E5%9F%BA%E6%9C%AC) (retrieved August 2026)_
<!-- 訳注: リンク先は日本語版 Pro Git のまま（契約: URL は変えない）。英語版 https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F に差し替えるかは人の判断 -->

In Git, one of these "single saves" is called a **commit**. It's the most important word in this series, and you'll see it dozens of times. Just remember this one pairing: **commit = save (make one save)**.

## A map of the three places

So, from the moment you edit a file until it's saved (committed), where does the change travel? Git has three places.

<!--
A simple left-to-right three-step flow diagram of Git's three areas. Left: "Working tree: the contents of the folder you are editing right now" → Center: "Staging area: where you pick and place the changes to include in the save" → Right: "Repository: the vault where save data (commits) accumulates". Label the arrow from left to center "git add" and the arrow from center to right "git commit". A clean layout of three cards side by side
-->

![Three-step flow diagram: working tree, staging area, and repository](images/git-three-areas-flow-4.png)

| Area             | What kind of place it is                                                                             | How to move to the next area |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Working tree** | The actual contents of the folder you are editing right now (in game terms, **the live play state**) | Add it with `git add`        |
| **Staging area** | Where you **pick and set aside** the changes to include in the save                                  | Record it with `git commit`  |
| **Repository**   | The vault where save data (commits) **accumulates**                                                  | —                            |

Two quick notes. Saving the working tree with Ctrl+S **does not record anything in Git yet**. And the repository physically lives in a hidden folder called `.git` inside your folder — you never touch its contents directly.

Don't worry about the details of the diagram. Just see the flow: **one-way, left to right — edit → pick → save**. This answers the previous lesson's puzzle — the file itself stays a single file, yet a stack of records builds up behind it. The place they build up is the repository.

These three names are the foundation of this series, so memorize them. When you look things up, you'll find articles calling the staging area the "index," and the working tree the "working directory" — they all mean the same thing. You don't need to remember the alternate names.

## Why is there a "pick" step before saving?

At this point you may have thought: "I just want to save. Why go through a picking step every time? Isn't that double the work?" A fair question. In fact, **a game save has no step that corresponds to "pick"**. This is where the analogy stops working — it's something unique to Git. It's also where most people learning Git for the first time stumble.

The reason for the pick step is **to make each save a meaningful unit**. Say you were fixing a typo and adding a new feature at the same time. If you lump everything into one save, then later, looking at the history, you can't tell what that save was for. With a staging area, you can choose: "this time, include only the typo fix in the save."

That said, it's perfectly normal not to appreciate the benefit until you've used Git for a while. For now, this is all you need to take away: **there is one step before saving where you pick the changes to include**. When you get hands-on in the Git Basic Operations Course, you'll pass through this step with a single command, `git add`.

## How it looks on screen

This map isn't just something in your head. The `git status` command you'll use in the Git Basic Operations Course tells you **what's currently in the working tree and the staging area**, in a form like this (the real screen has a few more lines; only the key parts are shown here).

```text
Changes to be committed:        ← changes in the staging area
        modified:   report.md

Changes not staged for commit:  ← changes only in the working tree
        modified:   memo.md
```

So where does the third one, the repository, show up? **It doesn't.** Files that are already saved and unchanged don't appear in `git status` at all. You'll verify this rule of thumb for yourself in the Git Basic Operations Course: not shown = identical to what's saved in the repository.

`Changes to be committed` means "changes that are set to be included in the save," and `Changes not staged for commit` means "changes that haven't been picked yet." Once you know that "the `git status` output maps onto the three areas," you won't get lost when you actually type it.

## Try it

Fill in (A) through (C) in the diagram below with the area names (working tree / staging area / repository).

```text
   ┌───────────────┐  git add   ┌───────────────┐  git commit  ┌───────────────┐
   │      (A)      │ ─────────→ │      (B)      │ ───────────→ │      (C)      │
   │ where you     │            │ where you pick│              │ vault where   │
   │ edit files    │            │ changes       │              │ saves pile up │
   └───────────────┘            └───────────────┘              └───────────────┘
```

- Given: this diagram follows the same flow as the one in the text above
- Don't worry about: how to spell or type the commands (covered in the Git Basic Operations Course)

<details>
<summary>Sample answer</summary>

(A) Working tree, (B) Staging area, (C) Repository.

</details>

## Summary

What to take away: **three places and one flow**.

1. **Working tree** — where you edit (the live play state)
2. **Staging area** — where you pick the changes to include in the save (a step games don't have — unique to Git)
3. **Repository** — the vault where save data (commits) accumulates
4. The flow is always **edit → pick with add → save with commit**

In the next course you'll install Git, and in the course after that you'll walk this map with real commands. You have the map now — concepts course, cleared.

## Check your understanding

1. Right after you edit a file and save it with Ctrl+S, which of the three areas holds that change? And where is it *not* yet?
2. In one sentence, in your own words, describe the benefit of "having a pick step before saving."
