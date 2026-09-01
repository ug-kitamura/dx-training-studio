<!-- source: sha256:5b555ad4dcb2a3e298d016c3d1508d89cb77ff8d090605f3580cada82ffe9dd9 -->

# Using external libraries

## Learning goals

This is the last lesson of the Python Basics Series. To round things off, you'll learn how to **fetch and use ready-made tools (libraries)**. The subject is **pandas** — the go-to library for table data, effectively a purpose-built machine for spreadsheet work.

In the previous lesson you read a CSV row by row and transformed it. With pandas, the same thing can be written even more briefly. By the end, you'll be able to source a tool with `uv add`, read a CSV with pandas, and do simple aggregation.

## Sourcing a ready-made tool — uv add

"Do I write all of this myself?" No, you don't. For common jobs like aggregating tables, there are ready-made tools that developers around the world have refined over the years. Fetching them is **also uv's job — your quartermaster again**.

Run the following inside `python-practice`.

```powershell
uv add pandas
```

```text
Resolved 6 packages in 34ms
Installed 5 packages in 1.18s
 + numpy==2.5.2
 + pandas==3.0.5
 + python-dateutil==2.9.0.post0
 + six==1.17.0
 + tzdata==2026.3
```

It finishes in a few seconds (the version numbers may differ). Look at the **Installed line** — you asked for one thing, pandas, and **five went in** (don't worry about the number on the Resolved line). The quartermaster sourced the other tools pandas needs to run, all together. This "chain of dependencies" is the most breakable part of setting up an environment by hand, and it's the reason to use uv.

They went into the **tool shed** just for this project (`python-practice`'s `.venv`). They don't go into your PC as a whole, so when you want pandas in another project, you run `uv add pandas` there too.

By the way, the `csv` and `json` tools you imported ship with Python, which is why no `uv add` was needed. **`uv add` only for tools that don't ship with Python** — that's the only distinction to remember.

## Reading with pandas

Let's read `items.csv` from the previous lesson (the table of three supply items), this time with pandas. Create a new file inside `python-practice` (`analysis.py`, say), write the following, and run it with `uv run analysis.py` (the code that follows gets added to the end of this file).

```python
import pandas as pd

df = pd.read_csv("items.csv")
print(len(df))
print(list(df.columns))
```

```text
3
['name', 'stock', 'place']
```

`import pandas as pd` means "fetch pandas under the short name `pd`," and it's a universal convention. `pd.read_csv` **reads a table in one line**, including opening and closing the file. Compare it with the previous lesson's code and you'll see how much shorter it is — no need to read it closely, just look at the **difference in line count**.

```python
# reading with the standard csv (previous lesson)
with open("items.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

# reading with pandas
df = pd.read_csv("items.csv")
```

What you read into `df` is a **DataFrame**, a "whole table" piece of data. `len()` gets you the number of rows and `list(df.columns)` the column names. You don't need to know how a DataFrame works inside for now.

When you want to see the contents, use `head()`.

```python
print(df.head())
```

```text
       name  stock        place
0   monitor      4  Warehouse A
1  keyboard     12  Warehouse B
2     cable      2  Warehouse A
```

The table appears as-is. The 0, 1, 2 at the left are row numbers pandas added (starting at 0, the same as list numbering).

## Aggregating

Let's look at just two of pandas' specialties. First, **counting the values in a column**, `value_counts`.

```python
print(df["place"].value_counts())
```

```text
place
Warehouse A    2
Warehouse B    1
Name: count, dtype: int64
```

"How many are in each place" came out in one line. Writing `df["column name"]` to take out a column is the same shape as looking a value up in a dictionary by its key. You can skip over the `Name: count, dtype: int64` at the end of the output for now.

Second, **the total of a numeric column**.

```python
print(df["stock"].sum())
```

```text
18
```

Did you notice the difference from the previous lesson here? With `csv.DictReader`, the stock counts were read as strings and needed an `int()` conversion. **pandas reads numeric columns as numbers automatically.** That's why you can total them directly.

That's as far as this lesson goes. pandas has plenty more tools — sorting, grouped aggregation, handling missing values — but looking those up when you need them (or asking the internal AI chat) is plenty.

_Source: [pandas documentation, "pandas.read_csv"](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html) (retrieved August 2026)_

## So which should you use, the standard csv or pandas?

You may be thinking, "if pandas is this much easier, what was the `csv` in the previous lesson for?" The answer is that **either is fine**.

| | Standard csv / json | pandas |
| --- | --- | --- |
| Installing | Not needed (ships with Python) | Needs `uv add` |
| Best for | Reading row by row, writing conditions and conversions in detail | Reading a whole table, writing aggregations briefly |
| What you get | A list of dictionaries (transformed with the tools from the Python Syntax Basics Course) | A DataFrame (transformed with pandas' tools) |

Use csv when row-by-row transformation logic is the star; use pandas when aggregation is. A rule of thumb that loose is enough, and either one works in the hands-on ahead (the Tool Development Practice Series, in preparation). **The "read → transform → write out" backbone you learned with csv stays the same whatever the tool.**

## Try it

Read `items.csv` with pandas and display the number of rows and the column names.

- What to do: check the row count and column names displayed by the `analysis.py` you ran while reading, then try either `value_counts` or `sum` once more **on a different column** (for example, `df["name"].value_counts()`)
- Given: `uv add pandas` is done and you have the `analysis.py` from the lesson. `items.csv` is the one you created in the previous lesson (if you don't have it, copy it from the start of that lesson)
- Don't worry about: how a DataFrame works. Reading it and counting rows is enough for today

<details>
<summary>Sample answer</summary>

You've succeeded if `3` and `['name', 'stock', 'place']` are displayed.

</details>

## Summary

Three things to take away from this lesson.

1. Tools that don't ship with Python are sourced with **`uv add`**. The quartermaster looks after the dependencies too
2. `pd.read_csv` reads a table in one line, and **numeric columns become numbers automatically**
3. The standard csv and pandas are **both fine**. The backbone, "read → transform → write out," is common to both

And with that — the Python Basics Series is complete. Nicely done. Looking back: you set up an environment with uv, learned the parts (variables, branching, loops, lists, dictionaries), assembled them with functions, read a CSV and wrote out JSON, and got as far as sourcing ready-made tools. **A script that reads work data, transforms it, and writes it out** — the weapon promised in the first lesson is already in your hands.

You'll put this weapon to use in the hands-on sessions of the Tool Development Practice Series (in preparation). There you'll build one working work tool with your own hands. In the meantime, keep applying the tools you've learned, bit by bit, to **the task from your own job — the one you wrote down in the first lesson's "Try it"**.

## Check your understanding

1. `import csv` worked without `uv add`, but `import pandas` needed `uv add pandas`. Explain the difference in your own words.
2. The stock counts read by `csv.DictReader` needed converting before you could total them, but with pandas they didn't. Read back through the lesson and say why in one sentence.
