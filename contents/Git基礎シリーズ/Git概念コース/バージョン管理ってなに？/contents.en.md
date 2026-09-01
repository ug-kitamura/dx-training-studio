<!-- source: sha256:1f04ba74d0f0a531e716ea05f72f45bf16dac0c066b47dc8b2bfb7c476c6c0cf -->

# What is version control?

## Learning goals

This is where your journey through the **Git Basics Series** begins. What you'll learn in this series is the idea of version control, plus seven basic operations. By the end of the last lesson, you'll have a weapon in hand: "I can save my work at any time, and safely go back to it."

"report_final.docx", "report_final2.docx", "report_final_revised.docx" — have you ever squinted at the modified dates because you couldn't tell which one to open? This lesson starts from why that happens, and gets you to the point where you can **name three reasons version control is needed**.

Not a single Git command shows up in this lesson. Before you learn to operate the tool, all you need is a sense of what the tool is for.

## Why does "final2" get created?

<!--
A left-right comparison diagram. On the left, an Explorer-style file list UI mock showing "report_final.docx", "report_final2.docx", "report_final_revised.docx", and "report_final_revised(2).docx" lined up. On the right, a timeline stacked vertically under a single filename: "8/1 first draft", "8/4 replaced the chart", "8/8 revised the conclusion". A short label on the left reading "Which one is the latest?" and one on the right reading "One line of history"
-->
![Side-by-side comparison of a folder full of report copies and a single file with one line of history](images/version-control-before-after-2.png)

The left side of the diagram above is what it looks like when you keep versions by copying files. You don't need to read the small text. Just look at the shape: **the same document keeps multiplying**.

Why does it multiply? Because saving over a file **erases its previous state**. If you want to be able to go back to how things were before your edit, your only option is to copy it before you overwrite and give the copy a different name. In game terms, this is like being **too scared to overwrite your save because you only have one save slot**. So you resort to making copies by hand to create more slots.

This approach hits three problems almost immediately.

- **You can't tell which one is the latest.** Nothing in the names tells you whether "final2" or "final\_revised" is newer
- **You can't tell what changed.** The only way to know what was fixed in "final2" is to open both and compare
- **Going back is scary.** Nobody can decide whether an old version is safe to delete, so files keep piling up in the folder

If your team works out of a shared folder, all of this happens for every person at once.

## What does version control do for you?

Version control is a mechanism that hands this manual "keep versions by copying" work over to a tool. To continue the game analogy, you get **infinite save slots, and every past save is kept**. The file stays a single file, while a record of "when, who, and what changed" builds up behind it. The "which one is the latest?" confusion disappears right here — the latest is always the one you have open.

How can a single file hold every past state? We'll cover that mechanism in the next lesson, "The three areas of Git." For now, "such a tool exists" is enough.

What changes as a result is exactly what this lesson wants you to take away — **three reasons**.

1. **You can go back anytime.** You can reload the state at any point in time, so there's no need to keep copies
2. **A record of changes remains.** You can see at a glance when, who, and what changed, so "what did I even fix in final2?" goes away
3. **You can make changes with confidence.** Knowing that you can reload if you break something, you can take on bolder edits

The third one matters most. Version control isn't "clerical work to keep records" — it's **a tool that creates the confidence that you can go back even when you fail**. That confidence matters especially in the programming you're about to learn, because "it was working, and then I fixed it and it stopped" is an everyday occurrence with code.

## Why Git?

Git isn't the only version control tool out there. But if you're learning one from scratch today, Git is the one to pick, because inside the company it is becoming the main tool for version control. It is also the only one this training covers — you don't need to memorize the names of any other tools.

You may also have seen a similar name: **GitHub**. GitHub is "a service for using Git as a team," and it's covered in the GitHub Basics Series that comes later. For now, it's enough to remember that **Git and GitHub are different things**.

## What to memorize in this series, and what not to

You may be feeling that Git looks hard — there are just so many commands. And it's true, the full list of Git commands is enormous. But relax: **this series only asks you to learn seven operations**.

```text
init   status   add   commit   log   diff   restore
```

At most four new ones show up in any one lesson. Each of them is covered one at a time from the next lesson onward, so you don't need to memorize these seven now. Just take away that "seven is enough."

Also, when you look Git up, the words **push, pull, and branch** come up constantly — but **this series doesn't cover them** (they belong to the GitHub Basics Series). If those words appear in a search result or an AI's answer, it's fine to skip right past them for now.

## Try it

In a working folder you have on hand (a personal folder or a shared one is fine), look for **files whose versions are managed through the filename** — things like "final", "\_v2", "\_0811" — and count how many variants of the same document exist.

- Given: any folder you use for work will do. If you don't have a personal working folder handy, open one of your department's shared folders
- Don't worry about: figuring out which one really is the latest. You don't need to open them

<details>
<summary>Sample answer</summary>

Being able to state the count is enough. If you find zero, a department shared folder will usually turn some up.

</details>

## Summary

These three are all you need to take away.

1. With version control, **you can go back anytime**
2. A record of **when, who, and what changed** remains
3. So **you can make changes with confidence**

In the next lesson, you'll get a map of how Git actually pulls this off — "the three areas." First quest cleared. That's a good start.

## Check your understanding

1. Name one problem you've personally run into with keeping versions by copying files.
2. Why does version control let you take on bolder edits? Explain it in one sentence, using the game-save analogy.
