<!-- source: sha256:19cd3cd718751365a9cabeeabdc2a3f5d94878147195d4b2057652286c02c226 -->

# Building a grouping script (day 1)

## Learning goals

Welcome to day 1 of the hands-on. Today you finally swing the weapons you've gathered. When these 60 minutes are over, the main branch on your internal GitHub will have **one working tool that solves a task, merged after review**. You build it, your partner reviews it, and you merge it.

This page doubles as today's schedule and the task brief. Whenever your hands stop, come back here.

## Today's schedule

```text
00-10  Task released, the outline of the day explained
       Pairing script demo → pairs decided → script distributed
       How to invite a collaborator
10-38  Part 1 implementation (each on your own)
       * Branch off onto a side route (a branch) before you implement
       * Send and accept partner invitations within this window (steps under "Inviting your partner")
38-50  Create a PR → partner reviews → approves → merge
50-55  Check it on main — the working tool is finished here
55-60  The advanced task (Part 2) explained
```

## Deciding pairs — a tool running right in front of you

First, the organizers run a **pairing script**. It reads the list of participants, shuffles it (Python's random module), and splits it into twos — a ten-line Python script and nothing more. Its result decides today's pairs.

Notice that **a small tool just processed real data, right in front of you**. The script is distributed after the demo, so **feel free to use it as a reference for how to write yours**.

_Source: [Python documentation, "random — Generate pseudo-random numbers"](https://docs.python.org/ja/3/library/random.html) (retrieved August 2026)_

Your pair is **who you review with**. Each of you implements in your own repository; you don't write together.

## The task, Part 1

That sample CSV in the repository you copied during preparation — that's today's task data. Today's task is to **split the ten people in your section into three groups, leaving out anyone on leave**.

Before you start, branch off a working branch (as in the GitHub Branches and PRs Course). Create one script at the top level of the repository (`grouping.py`, say — the name is up to you), and while you implement, run it as many times as you like with the command below to check as you go.

```bash
uv run python grouping.py
```

| File | Columns | Contents |
|---|---|---|
| `members.csv` | `name` | The names of the ten members of the section |
| `vacations.csv` | `name,week` | One row per person per week of leave (`week` is 1–4) |

**What to do in Part 1**: split the members into three groups, excluding those on leave in `week` 1, and write the result out to a JSON file. Keep the group sizes as even as you can (a difference of no more than 1 person between the largest and smallest group).

Here's the idea of the output.

```json
{"week": 1, "groups": [["Sato", "Suzuki", "Ito"], ["Watanabe", "Kobayashi", "Kato"], ["Yoshida", "Nakamura", "Sasaki"]]}
```

- Don't worry about: matching this example word for word. **Any JSON in which the week, the groups, and the names are identifiable** is fine; the shape is up to you
- There's no "right answer" for who lands in which group. If those on leave are excluded and the three groups are roughly even, it's correct
- **Don't commit the JSON you write out.** Files a script generates don't belong in the repository — as you did in the Git Basic Operations Course, add it to `.gitignore` (the list of things not to save)

<!-- A conceptual data flow diagram for the task. On the left, two file icons for members.csv and vacations.csv; in the center, the Python script; on the right, a JSON file. From the script in the center, two processing labels: "exclude those on leave" and "split into three groups". Arrows go one way, left → center → right -->
![Data flow diagram: members.csv and vacations.csv feed a Python script that excludes people on leave and splits into thre](images/grouping-script-data-flow-2.png)

## Every tool you need is one you've already learned

Not a single piece of new syntax is required. Break the task down and it's all things you did in one lesson or another.

| Element of the task | Where you learned it |
|---|---|
| Reading CSVs (two files) | Reading and writing files in the Python Intermediate Course (csv.DictReader) |
| Excluding those on leave | Conditionals and loops in the Python Syntax Basics Course (for and if, `in`) |
| Splitting into three groups | The **pairing script** you were given shows one way to split |
| Writing out JSON | Reading and writing files in the Python Intermediate Course (json.dump) |
| Branch → PR → review → merge | The GitHub Branches and PRs Course |

- You can use pandas or the standard `csv`, either is fine (for pandas, `uv add pandas`. If you haven't made it a project yet, run `uv init` first)
- Splitting into functions is optional. If it works, writing it all out in one block counts as finished
- If you're stuck, feel free to ask the internal AI chat (the colleague at the next desk). Remember to paste the error text in as-is. **But you must be able to explain the code you wrote in your own words in the day 2 talk**

## Inviting your partner — while you implement

To review each other's work, you need to be able to get into each other's repositories. In the GitHub Remote Workflow Course you only read about collaborator invitations. Here you actually send one.

> [!IMPORTANT]
> Invitations go **both ways**. You and your partner each invite the other to your own repository. If only one side does it, one of the two PRs can't be reviewed. And an invitation **only takes effect once the other person accepts**. The round trip takes time, so **send your invitation first, even if it means pausing your implementation**.

| Order | Who | What to do |
|---|---|---|
| 1 | You | In your own repository, **Settings** → **Collaborators** → **Add people** → enter your partner's username and add them |
| 2 | Your partner | Open the invitation that arrives (an on-screen notification or a link in an email) and **Accept** |
| 3 | Both | Swap roles and do 1–2 again (you get invited to your partner's repository) |

If the invitation can't be found, whoever sent it should send their repository's URL to the other person. Opening that page shows them an accept banner. If that still doesn't move things along, **flag it with the organizers** — permission and invitation problems are the kind that get solved faster by calling the organizers than by asking an AI.

_Source: [GitHub Docs, "Inviting collaborators to a personal repository"](https://docs.github.com/en/enterprise-server@latest/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository) (retrieved August 2026)_

## Open a PR and review each other

Once your implementation is done, run the flow from the GitHub Branches and PRs Course for real, with your partner. You're the author in your own repository and the reviewer in your partner's — **two roles in one person**.

```text
 Your repository                   Your partner's repository
   side route (feature)              side route (feature)
       │ PR                              │ PR
       ▼                                 ▼
   partner reviews & approves        you review & approve
       │                                 │
       ▼ you merge                       ▼ partner merges
     main                              main
```

| Order | What to do |
|---|---|
| 1 | Branch off, implement, and build up commits (this is the 10–38 implementation window. Up to here you're on your own) |
| 2 | Push and **create a PR** in your own repository (two lines of "what and why" in the description) |
| 3 | Open your partner's PR and **ask one question about "why did you write it this way?"** (as a comment on a line in Files changed) |
| 4 | When a question arrives on your PR, answer it in your own words |
| 5 | Once you've read their answer, **Approve** |
| 6 | Once you have an Approve, **merge your own PR yourself** |

- **You can review before your own implementation is finished.** If your partner's PR arrives first, pausing to send a review back moves everyone along faster
- One question is enough, and it isn't nitpicking. For example: "why did you choose a list rather than a dictionary on line 12?" — **a question only the person who wrote it can answer** (this example is made up)
- Once they can answer it, that's your sign to Approve. This is the first check that you can explain your own code, and it doubles as a rehearsal for the day 2 talk

## Run it on main — the moment it's finished

Once the merge is done, go back to main on your machine, pull, and run it.

```bash
git switch main
git pull
uv run python grouping.py
```

(Substitute whatever you named your script.) When the JSON is written out — **one working tool is finished**. It's the halfway mark of the two-hour course (two 60-minute sessions), and the first goal of this training.

## The advanced task, Part 2 — until we meet again

Finally, the advanced task to work on before day 2.

**What to do in Part 2**: generate groupings for all four weeks at once (reflecting `week` 1–4 in `vacations.csv` for each). But **no pair that was in the same group the previous week may be in the same group again**. The output is Part 1's shape extended into an array of weeks (`{"weeks": [...]}`).

When you work on it over the days in between, **branch off onto a side route first**, as always. The day 2 PR comes off that branch.

For the three or four days between now and day 2, **no solution is handed out**. Asking the organizers won't get you one either. That's by design. In exchange, you may use all of the following.

- Talk it over with colleagues (your pair partner or anyone else)
- Ask the internal AI chat (how to ask is as in the AI Basics Course)
- Ask in the **DX Tools Training** Teams channel (the solution itself won't be answered)

How to produce four weeks of groupings — that's where your ingenuity comes in, and **there's more than one way to solve it**. And **day 2 works even if you don't get all the way there**. Talking about how far you got and where you got stuck is enough (the shape of the talk is on the day 2 page). Day 2's quest ends with presenting that ingenuity in two minutes.

## Summary

Three things to take away today.

1. **A working grouping script**, merged into main
2. **The experience of one round of review** with your partner (you asked, answered, and approved each other)
3. **The Part 2 task** — to take on with your own ingenuity until we next meet

Let's drop a save point on how far you've come. Nicely done.
