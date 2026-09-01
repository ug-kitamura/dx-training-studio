<!-- source: sha256:7045e34df95e7033101d8120e0c570184da51bb5598c93160e590f1ad9b54787 -->

# Lists and dictionaries

## Learning goals

Now that you know forks and repetition, it's time to get **containers that hold data together**. This is the lesson that rounds off the Python Syntax Basics Course.

You can't very well make ten variables to handle the names of ten team members. In this lesson you'll learn to use **lists** and **dictionaries**, which hold many values in a single variable. These two show up in almost every script that handles work data.

## Shelves you look up by number — lists

For this lesson too, create a file in `python-practice` (something like `shelves.py`) and read on, running each snippet as you reach it.

The variable you learned earlier was "a box with a name tag." A list is **boxes lined up in order on a shelf**.

```python
members = ["Sato", "Suzuki", "Takahashi"]
print(members[0])
```

```text
Sato
```

Put values inside `[]` separated by commas and you have a list. To take one out, you specify **the position on the shelf**, as in `members[0]`. One important detail here — **the numbering starts at 0**. The first is 0, the second is 1. Together with `range(1, 6)` stopping before the 6, which you saw last lesson, this is one of Python's counting quirks.

Let's deliberately trigger the error you get when you ask for a position that isn't on the shelf.

```python
print(members[3])
```

```text
IndexError: list index out of range
```

(Only the last line of the output is shown.) Learn the error's name along with what it means: **you asked for a spot beyond the end of the shelf**.

You can count how many things are on the shelf with `len(members)` (`3` in this example). To add to the shelf, use `append`.

```python
members.append("Tanaka")
print(members)
```

```text
['Sato', 'Suzuki', 'Takahashi', 'Tanaka']
```

Two new things show up in that code. First, operations that belong to the list are invoked by **attaching them with a dot**, as in `members.append(...)`. Don't worry for now about why that differs from the function form like `len()`. Second, the quotation marks in the output are single, as in `'Sato'`, but in Python `"` and `'` are **both the same string quotation mark**. Only the display style differs; the meaning doesn't change.

And a list comes into its own paired with `for` from the previous lesson. **Take things off the shelf one at a time, from end to end, and do the same thing to each** — this is the single most common pattern in work scripts. The ten-separate-variables approach can't do this; you'd be adding code every time an eleventh person arrives.

```python
for member in members:
    print(f"Thanks for your work, {member}")
```

```text
Thanks for your work, Sato
Thanks for your work, Suzuki
Thanks for your work, Takahashi
Thanks for your work, Tanaka
```

The shape is the same as with `range`; you just hand it a list instead of a sequence of numbers. The contents of the `member` box are swapped out on each pass, and all four people are processed, right down to the Tanaka you appended a moment ago.

## Shelves you look up by name tag — dictionaries

If a list is "a shelf you look up by number," a dictionary is **a shelf you look up by name tag**. It holds the contents of a single record with names attached.

<!--
A left-right comparison of a list and a dictionary. The left card is "list = a shelf you look up by number", with "Sato", "Suzuki", and "Takahashi" on a shelf tagged with the numbers 0, 1, and 2. The right card is "dictionary = a shelf you look up by name tag", with "monitor" and 4 on a shelf tagged "name" and "stock". Line the elements of the two cards up with each other, and add code labels underneath showing how you take things out: members[0] / item["name"]
-->
![Left-right comparison: a list is a shelf looked up by number, a dictionary a shelf looked up by name tag](images/list-vs-dict-shelves-2.png)

The contrast in the diagram is the whole point — **on the left (list) you take things out by number, on the right (dictionary) by name tag**. Both are "shelves," but you reach into them differently. The code labels under the diagram are explained just below.

```python
item = {"name": "monitor", "stock": 4}
print(item["name"])
print(item["stock"])
```

```text
monitor
4
```

Inside `{}` you line up `name tag: value` pairs. The name tag is called the **key**, and the thing it points to is the **value**. To take something out, you specify the name tag, as in `item["name"]`. A dictionary's strength is that you never have to work out which position the stock count was in.

Asking for a name tag that isn't there raises a `KeyError`. Because **the tag you typed appears in the error as-is**, you notice typos (`"nmae"` instead of `"name"`) straight away. Learn it as the counterpart to a list's IndexError.

Choosing between them is easy.

| Container | What it suits | Example |
| --- | --- | --- |
| List | A sequence of values **of the same kind**. Something you want to process in order | A list of member names, a list of file names |
| Dictionary | **The contents of a single record.** The fields have names | One supply item's "product name and stock count" |

## Combining shelves — a list of dictionaries

You model real data by combining the two. For a list of supplies, the shape is "**put a dictionary (one record) into a list (the sequence)**." Note that inside the f-string in the code below, the name tags are written with **single quotes** as `item['name']`, so they don't collide with the outer `"` (they're the same quotation mark, remember).

```python
items = [
    {"name": "monitor", "stock": 4},
    {"name": "keyboard", "stock": 12},
]
for item in items:
    print(f"{item['name']}: {item['stock']} left")
```

```text
monitor: 4 left
keyboard: 12 left
```

Take one out at a time with `for` and read its contents by name tag. **One row of a table is a dictionary, the whole table is a list** — that same mapping applies unchanged when you read CSV files in the Python Intermediate Course. Get familiar with the shape here.

## Try it

Create a new file `stock.py` and display one thing from your own work as a dictionary.

- What to do: make one dictionary with three fields (for example, product name, quantity, location), and `print` it as one sentence with an f-string
- Given: do this inside `python-practice` and run it with `uv run stock.py`
- Don't worry about: choosing a subject. If nothing comes to mind, adding one field to the supplies example from the lesson is fine

<details>
<summary>Sample answer</summary>

You've succeeded if a sentence like `print(f"{item['name']}: {item['stock']} in {item['place']}")` is printed.

</details>

If you have the energy, make a second dictionary, put both into a list, and display two lines with the `for` from "Combining shelves." It's a rehearsal for the shape you'll use in the Python Intermediate Course.

## Summary

Three things to take away from this lesson.

1. A list is **a shelf you look up by number**. Numbering starts at 0, and `for` processes one at a time
2. A dictionary is **a shelf you look up by name tag (key)**. It names the contents of a single record
3. Real data is usually shaped as a **list of dictionaries**. One row of a table = a dictionary, the whole table = a list

That completes the Python Syntax Basics Course. Variables, branching, repetition, lists, dictionaries — you have the basic parts of a script. In the Python Intermediate Course next, you'll combine those parts into the "read → transform → write out" shape.

## Check your understanding

1. Explain the difference between a list and a dictionary in one sentence each, using the word "shelf."
2. If you were to hold "the name and extension number of everyone in your department," how would you combine a list and a dictionary? Write out the shape while looking at "Combining shelves."
