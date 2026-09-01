<!-- source: sha256:ca20b89ce45876dba73b0b67e8a941fadc0dbe7a9a705c2c220bbc7f6c2c88c1 -->

# Functions and modules

## Learning goals

This is where the Python Intermediate Course begins — the stage where you **assemble the parts you gathered in the Python Syntax Basics Course into tools**.

This lesson covers **functions**, which give a name to a chunk of processing, and **splitting into modules**, which divides your code across files. By the end, you'll be able to reshape one long script into something readable, fixable, and reusable.

In this lesson, as before, create a file in `python-practice` and run the code as you read.

## Why split at all?

Let's answer the obvious question first. **"It works — is there any point in going to the trouble of splitting it?"**

Imagine a script that reads a supplies list, narrows it down to the items running low, and displays the result. Writing it all out in one block works. But two weeks later, when you want to change the filter condition, you'll be hunting through dozens of lines to find **the ones that do the filtering**.

<!--
A left-right comparison. The left card is "one long set of instructions": an unbroken band of long code lines with no divisions, where you can't tell which part does what. The right card is "instructions split into functions": divided into three blocks named "read", "filter", and "output", each with a short label. Line the elements of the two sides up with each other, and add a one-liner on the right: "findable by name, fixable in one place"
-->
![Left-right comparison of one long undivided script and the same logic split into read, filter, and output functions](images/function-split-long-script-vs-named-blocks-2.png)

Split your processing into **named chunks**, as on the right of the diagram, and you can jump to the place you want to fix by name. That chunk is a **function**. There are three benefits to splitting.

| Benefit | What it means |
| --- | --- |
| Readable | You can follow the flow by name: "read → filter → output" |
| Fixable | A change stays inside one chunk. Less worry about breaking the rest |
| Reusable | When the same processing is needed in two places, you call it by name instead of copy-pasting |

## Writing a function

You create a function with `def` (short for "define"). Write it in a new file (`functions.py`, say) and run it.

```python
def greet(name):
    return f"Thanks for your work, {name}"

message = greet("Sato")
print(message)
print(greet("Suzuki"))
```

```text
Thanks for your work, Sato
Thanks for your work, Suzuki
```

Let's break the syntax down.

| Part | In this example | What it does |
| --- | --- | --- |
| Function name | `greet` | The name you call it by |
| **Argument** | `name` | The material you hand the function. You can change it on each call |
| **Return value** | What's to the right of `return` | The result the function gives back |

A `:` at the end of the `def` line, the body indented — the same rules as `if` and `for`. Note that defining it doesn't run it: **it only runs when you call it**, as in `greet("Sato")`.

One more thing beginners often mix up is the difference between `return` and `print`. `print` **only displays on screen**; `return` **hands the result back to whoever called it**. `message` can hold a value because `greet` hands its result back with `return`. A handed-back result doesn't have to go into a variable — you can pass it straight to another function. The last line, `print(greet("Suzuki"))`, is that shape, passing greet's result directly to print. When displaying it is all you need, use print; when a later step will use the result, use return — this distinction pays off through the rest of the Python Intermediate Course.

## Splitting files — modules

Once you have a few functions, you start splitting the work across **separate files**. A split-off file is called a **module** — think of each one as a volume of a multi-volume book. It's just what you do when your code gets long: split it into volumes.

Let's try putting a small function that checks a condition into a separate file called `helpers.py`.

```python
# helpers.py
def is_low_stock(item):
    return item["stock"] < 5
```

The result of a `<` comparison is `True` / `False` — the **bool** type you met in the "Variables and types" lesson. This function returns that directly, so you can drop it straight into an `if` condition later.

In the file that uses it, you fetch the volume with `import`.

```python
# report.py
from helpers import is_low_stock

items = [
    {"name": "monitor", "stock": 4},
    {"name": "keyboard", "stock": 12},
]
for item in items:
    if is_low_stock(item):
        print(item["name"])
```

The file you run is **the one that does the importing**. Type `uv run report.py` and —

```text
monitor
```

Running `helpers.py` displays nothing. Defining a function doesn't run it, just as you learned — nothing is broken.

`from helpers import is_low_stock` means "from the volume called `helpers.py`, fetch the function called `is_low_stock`." **For a file in the same folder, you fetch it by its name minus the `.py`.** If you get a `ModuleNotFoundError`, check the spelling of the file name and that both files are in the same folder (`python-practice`).

It's fine if splitting into volumes doesn't feel necessary yet. For a short script you write alone, one file is enough. But this is exactly the mechanism **the libraries out in the world are distributed by** — when you write `import pandas` in the external libraries lesson, you're "fetching a volume someone else wrote." This lesson just lets you see the mechanism with a volume of your own.

## Try it

Take the display part of `stock.py` from the previous lesson (the script that shows a dictionary with an f-string) and pull it out into a function.

- What to do: define a function like `format_item(item)` that returns the sentence to display, and call it in the form `print(format_item(item))`
- Given: do this inside `python-practice`. If you don't have `stock.py`, copy one of the dictionaries from `items` in the lesson and use it as `item = {...}`
- Don't worry about: how you name the function. Any verb-ish English word is fine

<details>
<summary>Sample answer</summary>

You've succeeded if `format_item(item)` returns a sentence like `f"{item['name']}: {item['stock']} left"`.

</details>

## Summary

Three things to take away from this lesson.

1. A function is **a named chunk of instructions**. You define it with `def`, and it only runs when called
2. **Hand it materials with arguments, receive the result with `return`.** print only displays
3. A file you've split off is a **module**. You fetch it with `from <filename> import <function name>`

You have the tools for cutting your code into pieces. In the next lesson you finally read and write files — the "read → transform → write out" shape connects to real data from here.

## Check your understanding

1. Explain the difference between `return` and `print`, using the phrase "hands back."
2. In a script split into "read, filter, output" functions, where do you touch when you only want to change the filter condition? Compare it with the case where you hadn't split it.
