<!-- source: sha256:96cdba22c04e75cda7d50858bda3c00e7a70d16cb491e8fcd960c702c795ebdc -->

# What is Python?

## Learning goals

A new series begins. The Python Basics Series is **nine lessons in total**, including this one. You'll move through setting up an environment, basic syntax, reading and writing files, and using off-the-shelf libraries. By the end, you'll be able to write **a script that reads a file of work data, transforms it, and writes it out in another format** with your own hands. That's one more weapon of your own — one that takes your repetitive manual work off your hands. (The word "script" is explained later in this lesson.)

This lesson is the first quest on that road. You won't write code yet. First you get a map: "what is Python good at, and where in my own job could I use it?" The goal is to be able to **describe, in words, one task in your job you'd like to automate**.

## What kind of language Python is

There are plenty of programming languages, so why does this training use Python? Let's start there. There are three reasons.

| Reason | What it means |
| --- | --- |
| **It's readable** | The syntax has little ornamentation, so the intent comes across to readers other than the author |
| **It's concise** | The same task often takes fewer lines than in other languages |
| **There are plenty of ready-made libraries** | For common jobs — aggregating tables, working with files, drawing graphs — ready-made **libraries** already exist, so you don't have to write from scratch |

For example, code that greets each name in a list in turn can be written like this.

```python
names = ["Sato", "Suzuki", "Takahashi"]
for name in names:
    print("Hello, " + name)
```

If you've used other languages before, you can probably guess roughly what this does at a glance. **It's fine if the details don't make sense yet** — this way of writing is covered piece by piece in the Python Syntax Basics Course. Here, just get the sense that it's a language you can read without bracing yourself.

Those three are why it was chosen, but there's one more trait that's nice while learning. Python is the kind of language you **can run as soon as you write it** (strictly speaking there is a conversion stage inside, but "save it, run it, see the result immediately" is plenty for a first understanding). You can try something, fix it, and try again in short cycles, which suits both beginner practice and building small tools for work.

## Where you can use it at work

So where in the day-to-day work of an engineering department does Python come in? Here are four common situations.

<!--
A card grid of four situations where Python helps at work. Card 1, "Aggregating table data": an image of reading several CSVs and pulling them into one. Card 2, "Tidying files": an image of sorting a large number of files in a folder by a rule. Card 3, "Prep for routine reports": an image of automating document work that follows the same steps every week. Card 4, "Small work tools": an image of building a duty roster or a grouping table. Each card has a short title and a one-line description
-->
![Card grid of four work situations where Python helps: aggregating table data, tidying files, routine report prep, and sm](images/python-work-use-cases-grid-2.png)

From the picture above, just take in that there are four situations. You can check the specifics of each in the table below.

| Situation | Example |
| --- | --- |
| Aggregating table data | Read several CSV files and pull them into a single summary table |
| Tidying files | Sort and rename hundreds of files piled up in a folder by a naming rule |
| Prep for routine reports | Hand over the data gathering and formatting for a report you build the same way every week |
| Small work tools | Turn "slightly annoying every time" work, like a duty roster or a grouping table, into a single script |

What they have in common is that they're **work with a fixed set of steps that a person repeats**. Conversely, work where the steps change every time — judgment calls, negotiation — isn't where Python comes in. "Is it a repetition of set steps?" is the first way to tell whether something can be automated.

## The goal of this series

We've been using the word "script" without explaining it. A script is **a file with the work you want done written out as instructions**. Hand it to Python and it runs exactly what you wrote. What you'll be able to write by the end of this series is a script in this shape.

```text
Input file (CSV, etc.) ──→ your script ──→ output (JSON, aggregated results)
        read                 transform              write out
```

Most of the four situations above are variations of this "read → transform → write out." Some don't map neatly onto all three (tidying files has no "write out," for instance), but the backbone is the same. Once you've built this shape with your own hands, its range of use widens dramatically.

Three more courses get you there. First the **Python Setup Course** gets you to where you can run Python, then the **Python Syntax Basics Course** teaches you how to use the parts, and the **Python Intermediate Course** assembles a script in this shape. Each lesson is 10–15 minutes, so taking it a bit at a time is fine.

## Try it

Write down one task in your own job that you'd like to automate. A notes app or paper is fine.

- What to do: write the name of the task and what's annoying about it now, in one or two lines
- Given: pick something that looks like it fits "a repetition of set steps"
- Don't worry about: how you'd actually do it, or whether you could build it

<details>
<summary>Sample answer</summary>

Something like "for the weekly progress report, I copy and paste the same fields out of several Excel files into one table" is plenty.

</details>

Don't throw the note away. As you work through the series it becomes the example you keep coming back to, asking "how would I do this in Python?"

## Summary

These three are all you need to take away.

1. Python is a language that's **readable, short to write, and rich in ready-made tools (libraries)**
2. What it's good at is **work with a set method that a person repeats**
3. The goal of this series is being able to write a "**read → transform → write out**" script yourself

You have the map. In the next lesson, you finally welcome Python into your own environment.

## Check your understanding

1. Put the condition shared by the four situations in "Where you can use it at work" into one sentence of your own.
2. Which parts of "read → transform → write out" does the task you wrote down in "Try it" involve? It doesn't have to involve all three.
