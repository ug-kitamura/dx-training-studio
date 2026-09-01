<!-- source: sha256:1b55e893d2afd2bc0823315bc3f9de09efbf9a9d0764528bff9e3b894aa12f0b -->

# Reading and writing files (CSV / JSON)

## Learning goals

Scrolling a CSV and counting by eye. Filtering in Excel and copy-pasting by hand. This is the lesson where you hand that work to Python. The "**read → transform → write out**" shape promised in the first lesson of the series is finally something you carry out on real files. Read a CSV, filter it by a condition, write the result out as JSON — the sequence that forms the backbone of a work script.

This is the high point of the Python Intermediate Course. Check things off one at a time and you'll be fine, and if an error stops you, **paste the whole message into the internal AI chat** just as you did in the first-script lesson.

<!--
A CSV-to-JSON conversion flow diagram. On the left, a card for the CSV file (a table with three columns, name / stock / place, and rows for monitor, keyboard, and cable); in the center, a card for "your script" (three steps: read → filter → write out); on the right, a card for the JSON file (the two filtered records, laid out nested). Connect them left to right with arrows
-->
![Flow diagram: a CSV file is read by a Python script, filtered by a condition, and written out as a JSON file](images/csv-to-json-conversion-flow-2.png)

As in the diagram, in this lesson you'll work the whole path yourself, from the table on the left (CSV) to the JSON on the right.

## A CSV is a "table" in plain text

A CSV is **a file that represents a table using nothing but characters**. The first line is the header, the data starts on the second, and columns are separated by commas. It's also what you get when you "save as CSV" in Excel (unlike Excel's own `.xlsx`, the contents are plain text you can read in Notepad).

First, create a practice file. In your editor, create `items.csv` inside `python-practice`, paste the following in, and save (VSCode saves as UTF-8 by default. That's fine as-is).

```text
name,stock,place
monitor,4,Warehouse A
keyboard,12,Warehouse B
cable,2,Warehouse A
```

It's a small table: three items, each with a stock count and a location.

## Reading — csv.DictReader

Let's read this file in Python. Create `convert.py` and run it with `uv run convert.py` from inside `python-practice` (the same place as `items.csv`). Run it from somewhere else and the file won't be found, giving you a `FileNotFoundError`.

```python
import csv

with open("items.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

print(rows[0])
print(len(rows))
```

```text
{'name': 'monitor', 'stock': '4', 'place': 'Warehouse A'}
3
```

Look at the output — isn't that **a shape you recognize**? The first row of data is a **dictionary**, and the whole thing is a **list of dictionaries**. `csv.DictReader` is the payoff for the setup laid down in the Python Syntax Basics Course: "one row of a table = a dictionary, the whole table = a list." The header row automatically becomes the keys (name tags).

Three new pieces of syntax to note.

- `import csv` — fetches the standard module for handling CSV. Last lesson you imported a single function; this time you fetch the whole module, and call the functions inside it **joined with a dot**, as in `csv.DictReader`
- `with open(...) as f:` — the standard idiom that opens a file and closes it automatically when the indented block ends. `encoding="utf-8"` specifies the character encoding
- `list(...)` — converts what DictReader returns into a list. It's a conversion, in the same family as `int()` and `str()`

> [!TIP]
> If characters come out garbled or you get a `UnicodeDecodeError`, try changing it to `encoding="cp932"`. Excel and similar tools sometimes save in an encoding other than UTF-8.

One more thing: look closely at the output and `'stock': '4'` has the **number in quotation marks**. **Every value read from a CSV comes out as a string (str).** To use it as a number you convert it with `int()` — the very conversion you learned in the "Variables and types" lesson.

## Transforming — filtering by a condition

Once you can read it, the tools from the Python Syntax Basics Course apply directly. Let's collect only the items with fewer than 5 in stock. **Add** the code below **to the end of** `convert.py` (it uses `rows`, so it won't run in a separate file).

```python
low = []
for row in rows:
    if int(row["stock"]) < 5:
        low.append(row)

print(len(low))
```

```text
2
```

(The print from the previous section appears too. Only the output from the newly added code is shown here, and the same applies to the sections below.)

Take one row at a time with `for`, and `append` only the ones matching the condition to a new list with `if` — every part of that you already know. Forget the `int(...)` and it becomes the comparison `'4' < 5`, which fails with an error, so that's the one thing to watch.

## Writing out — json.dump

Finally, write the filtered result out to a JSON file. JSON is a text format that **can store nested lists and dictionaries exactly as they are**, and it's the standard output format for tools. Add this to the end of `convert.py` too (by convention, `import json` goes at the top of the file, next to `import csv`).

```python
import json

with open("low_stock.json", "w", encoding="utf-8") as f:
    json.dump(low, f, ensure_ascii=False, indent=2)

print(f"Wrote out {len(low)} records")
```

Run it and `low_stock.json` appears. Open it up.

```json
[
  {
    "name": "monitor",
    "stock": "4",
    "place": "Warehouse A"
  },
  {
    "name": "cable",
    "stock": "2",
    "place": "Warehouse A"
  }
]
```

Python's "list of dictionaries" has become a file that looks almost exactly the same. The `"w"` in `open` specifies write mode. `ensure_ascii=False` is there so non-ASCII characters are written as-is, and `indent=2` indents it so people can read it — you can treat **those two as boilerplate you always include**.

If it bothers you that the stock count is still the string `"4"` — **writing it out in its original form is fine**. You converted to a number for the comparison; there's no need to change the form you save it in, too (if you do want to save it as a number, you can put it back before writing out).

_Source: [Python documentation, "json — JSON encoder and decoder"](https://docs.python.org/ja/3/library/json.html) (retrieved August 2026)_

Wondering why we don't write out as CSV instead? A CSV can only represent a flat table, while JSON can write nesting (a dictionary inside a list, a list inside a dictionary) directly. This particular result is still table-shaped, so CSV would work, but as you stack up transformations (grouping by location, say) the shape stops fitting in a table. JSON is what lets you keep writing it the same way when that happens, and **CSV in, JSON out** is the standard combination on the job.

## Try it

If you've followed along, `convert.py` runs the whole "read → filter → write out" sequence. To finish, change the data and check the behavior.

- What to do: add one row to `items.csv`, **predict from its stock count whether that row will appear in the JSON**, then re-run and check your answer
- Given: you have the `convert.py` and `items.csv` you created while reading
- Don't worry about: what's in the row you add. Under 5 in stock and it appears in the JSON, 5 or over and it doesn't — either one works as an exercise

<details>
<summary>Sample answer</summary>

You've succeeded if your prediction matches the contents of `low_stock.json`.

</details>

## Summary

Three things to take away from this lesson.

1. Read a CSV with `csv.DictReader` and you get a **list of dictionaries**. But **every value is a string** — use `int()` to make it a number
2. For transforming, the parts from the Python Syntax Basics Course (for, if, append) apply directly
3. Write out with `json.dump`. **CSV in, JSON out** is the standard at work

"Read → transform → write out" now connects end to end. That's the backbone of the work tools you'll write. Next is the last lesson of the series — fetching a ready-made tool to make this flow easier still.

## Check your understanding

1. Comparing a stock count read by `csv.DictReader` directly with `< 5` gives an error. Explain why, using the word "type."
2. Say in one sentence what the advantage of JSON over CSV is for output, using the word "nesting."
