<!-- source: sha256:9576faee7dd7e28195b0b179226f89c1493c5a8cfffe34ee2e5aa1bae6d734f9 -->

# Variables and types

## Learning goals

From here it's the Python Syntax Basics Course — the stage where you widen the range of things you can tell Python to do. This first lesson covers **variables** and **types**, the foundation of every script.

By the end, you'll be able to give values names and reuse them, and you'll be able to get yourself out of the situation every beginner hits at least once: "I mixed text and numbers and got an error."

## A variable is a "box with a name tag"

From this lesson on, read while **running the code on your machine**. Create a file such as `variables.py` inside `python-practice`, type in the code from the lesson, and run it with `uv run variables.py` — the same loop you learned in the previous course, repeated. Every piece of code from here on can be tried the same way.

A variable is **a box with a name tag that you put a value into**. Put something in the box and you can call it back later by its tag.

```python
name = "Sato"
count = 12
print(name)
print(count)
```

```text
Sato
12
```

`=` doesn't mean "equals" — it's the instruction **put the value on the right into the box with the tag on the left**. This means something different from what it means in maths, so retrain your reading of `=` right now.

So how is this different from writing `print("Sato")` directly? The point of the box is **reuse**.

```python
name = "Sato"
print(name + " is in charge")
print(name + " is the person to contact")
```

If Suzuki takes over, the only thing you fix is **the first line**. Scatter the value around directly and you'll be hunting down every line to fix each time it changes.

<!--
A diagram presenting a variable as a "box with a name tag". Two boxes side by side: the first with the tag "name" and the contents "Sato", the second with the tag "count" and the contents 12. Under each box, a small type label (str / int). Above them, code-style labels reading name = "Sato" and count = 12, with arrows showing that assignment is the action of "putting it in the box"
-->
![Two labeled boxes showing variables name and count, with assignment code above and str/int type labels below](images/variable-as-labeled-box-2.png)

The one thing to see in the diagram is that **the name tag (the variable name) and the contents (the value) are different things**. The small labels under the boxes (str, int) are explained in the next section. When you write `print(name)`, what appears on screen is the contents, not the tag.

You choose the variable names yourself. The convention is **an English word that suggests what's inside**, like `name` or `count`. `a` or `x` will run too, but you won't be able to read it a week from now.

## The contents have kinds — "types"

The contents of a box come in **kinds**. These are called **types**. Four of them are plenty to start with.

| Type | What the value is | Example |
| --- | --- | --- |
| `str` (string) | A sequence of characters. **Wrapped in quotation marks** | `"Sato"`, `"hello"` |
| `int` (integer) | A number with no decimal point | `12`, `-3` |
| `float` (decimal) | A number with a decimal point | `0.75`, `2.5` |
| `bool` (boolean) | Either yes or no, nothing else | `True`, `False` |

`True` / `False` **start with a capital letter**. Write `true` out of habit from another language and you get an error saying it doesn't know that name (`NameError`). Also, bool takes the lead role in the next lesson (conditionals), so knowing its name and the two values `True` / `False` is enough for now.

You can check what type a value is with `type()`.

```python
print(type("Sato"))
print(type(12))
print(type(0.75))
print(type(True))
```

```text
<class 'str'>
<class 'int'>
<class 'float'>
<class 'bool'>
```

Reading `<class 'str'>` as "this is of type str" is enough. Don't worry about what the word `class` means for now.

One important distinction here. **`12` and `"12"` are different things.** The first is an integer you can do arithmetic with; the second is "just the characters 1 and 2 next to each other." Because they look so alike, they're the main culprit behind the error in the next section.

## Different types don't mix

So what happens if you join a string and an integer with `+`? Let's try.

```python
print("1" + 1)
```

```text
TypeError: can only concatenate str (not "int") to str
```

An error. As you learned in the previous lesson, read **the last line**. (Only the key final line is shown here. On your machine several lines starting with `Traceback` appear, but the place to read is the same.) It means "you can only concatenate str with str; int can't be joined on." **Python doesn't mix values of different types on its own.** That looks inconvenient, but deciding for you between "1 + 1 = 2" and "the characters 11" would cause far nastier bugs. Stopping here is a safety feature, not an obstacle.

When you do want to mix them, **convert the type first**.

```python
print(int("1") + 1)
print("Handling " + str(12) + " items")
```

```text
2
Handling 12 items
```

`int()` converts a string into an integer, and `str()` converts a value into a string. "**If you want to add, use `int()`; if you want to join it into a sentence, use `str()`**" — remember that pairing and this error will never scare you again. For a string holding a decimal, `float()` works the same way.

## Tidying up your output — the f-string

You'll often want to mix variables into text you display, so let's learn one handy way to write it. Put an `f` before the opening quotation mark and you can embed variables directly inside `{}`.

```python
name = "Sato"
count = 12
print(f"{name} is handling {count} items")
```

```text
Sato is handling 12 items
```

No `str()` conversion and no joining with `+` needed. This way of writing (called an **f-string**) is what we'll keep using for displaying things throughout the rest of this series.

## Try it

Create a new file `profile.py`, make variables of three types, and display them.

- What to do: make one string, one integer, and one decimal variable (for example, a name, years of service, and a utilization rate), and `print` them as one sentence with an f-string
- Given: do this inside the `python-practice` you created in the Python Setup Course, and run it with `uv run profile.py`
- Don't worry about: how elegant your variable names are. Any English word that suggests the contents is fine

<details>
<summary>Sample answer</summary>

You've succeeded if a sentence like `print(f"{name} is in year {year}, utilization {rate}")` is printed.

</details>

## Summary

Three things to take away from this lesson.

1. A variable is **a box with a name tag**. `=` means "put it in the box"
2. Start with four types — **str / int / float / bool**. `12` and `"12"` are different things
3. Different types don't mix. **For addition use `int()`; to join into a sentence use `str()` or an f-string**

You know how to use the boxes now. In the next lesson you'll learn how to write branches and loops into your code.

## Check your understanding

1. The result of `"3" + "4"` is `"34"` (a string). Explain why it isn't `7`, using the word "type."
2. When `count = 5`, what do `print(f"{count} items left")` and `print(str(count) + " items left")` display? Run them, check, and then say in your own words which way is easier to read.
