<!-- source: sha256:87e97378107714e298a7439afffa8f654f2f6b41aa2cba014bce62537e52fbf2 -->

# Conditionals and loops

## Learning goals

In the previous lesson you learned to hold values in boxes (variables). In this lesson you'll learn how to write **forks in the road** and **repetition** into your code. "Only tell me about the items that are running low," "do the same thing to ten files, ten times" — automating work is almost always built out of these two.

Along the way, you'll also meet Python's distinctive **indentation rule**. It isn't decoration, it's the syntax itself, so knowing what it really is up front makes every later lesson easier.

## Writing a fork in the road — if

In this lesson, as before, create a file in `python-practice` (something like `branching.py`), type in the code from the lesson, and run it with `uv run` as you read.

To change what happens depending on a condition, use `if`.

```python
count = 12
if count > 10:
    print("a lot")
else:
    print("normal")
```

```text
a lot
```

It reads almost like English: "if `count` is greater than 10, then 'a lot'; otherwise (else) 'normal'." `count` is 12, so only the upper line runs.

There are only two rules about how it's written.

1. Put a **`:` (colon)** at the end of the condition line
2. Write the lines that run when the condition holds **indented by four spaces** (strictly it works as long as the width is consistent, but four is the standard. That's plenty for now)

That extra space at the start of the line is what's called indentation. Try removing it and running the file — Python refuses to run it at all.

```python
count = 12
if count > 10:
print("a lot")
```

```text
IndentationError: expected an indented block after 'if' statement on line 2
```

(Only the last line of the output is shown. The line number will match where it is in your own file.) It means "there should be an indented block after the if statement on line 2." In many languages indentation is decoration for readability, but **in Python, indentation is what decides where the body of the if starts and ends**. In other words, it's part of the syntax. Editors usually indent for you, so you rarely count spaces by hand — just remember that "if it's out of line, it won't run."

When there are three or more forks, add more branches with `elif` (short for else if).

```python
count = 12
if count > 20:
    print("a great deal")
elif count > 10:
    print("a lot")
else:
    print("normal")
```

```text
a lot
```

The output is the single line "a lot". 12 isn't greater than 20, so Python moves on to the next test, `> 10` — that one is true, so that's the line that runs. **They're tested top to bottom, and only the first one that holds** runs — nothing below `> 10` is even looked at.

## Repeating — for

To do the same thing a set number of times, use `for`.

```python
for i in range(1, 6):
    print(i)
```

```text
1
2
3
4
5
```

`range(1, 6)` is the sequence of numbers "from 1 to 5." **The 6 at the end is not included** — everyone trips over this on first sight, so chant "range(a, b) goes from a to one before b" until it sticks. `i` is an ordinary variable, and you can picture **the contents of the box being swapped out on each pass**.

The body of a `for` is also marked by indentation. Everything that's indented is what gets repeated. Let's check the boundary in the output.

```python
for i in range(1, 4):
    print(i)
    print("working")
print("done")
```

```text
1
working
2
working
3
working
done
```

The two indented lines run three times over, and **the un-indented "done" runs just once** — meaning it's outside the loop. "A line I meant to put inside the loop was actually outside it" is the classic indentation mistake, so when in doubt, remember this shape.

Python does have `while` (repetition with no fixed count), as other languages do, but this series doesn't cover it. For repetition in work scripts, `for` is nearly always enough.

## Combining them — a fork inside a loop

`for` and `if` can be nested. Let's display only the even numbers from 1 to 10.

```python
for i in range(1, 11):
    if i % 2 == 0:
        print(i)
```

```text
2
4
6
8
10
```

Two new faces. **`%` gives you the remainder after division**, so `i % 2 == 0` is the condition "the remainder after dividing by 2 is 0, i.e. it's even." And **comparison uses two `=` signs, `==`**. A single `=` means "put it in the box," so "I meant to compare but assigned instead" is a classic typo. When you meet an error or odd behavior, count your `=` signs first.

Notice too that the indentation is now two levels deep. The `if` line is inside the for, so one level; the `print` is inside the if, so two. **The depth of the indentation says exactly which instruction you're inside.**

```text
for …:            ← the entrance to the repetition
    if …:         ← a fork on each pass (inside the for: one level in)
        print(…)  ← only when the condition holds (inside the if: two levels in)
```

## Try it

Create a new file `even.py` and display **only the even numbers** from 1 to 10.

- What to do: using the nested example from the lesson as a guide, type it yourself and run it with `uv run even.py`
- Given: do this inside `python-practice`
- Don't worry about: coming up with your own way to test for evenness. Use `% 2 == 0` as-is

<details>
<summary>Sample answer</summary>

You've succeeded if the code from "Combining them" displays 2, 4, 6, 8, 10.

</details>

Once it works, change the numbers in `range` or the condition and watch how the behavior changes. If you break it, the worst that happens is an error message — as you learned in the previous course, read the file name, the line number, and the last line, and you can find your way back.

## Summary

Three things to take away from this lesson.

1. Forks are **`if` / `elif` / `else`**. A `:` at the end of the condition line, and the body indented
2. Repetition is **`for i in range(a, b)`**. b is not included
3. **Indentation is syntax.** Its depth says which instruction you're inside

You can now write flow into your code. In the next lesson you get the "shelves" (lists and dictionaries) for handling many values at once.

## Check your understanding

1. Explain the difference between `=` and `==`, using the word "box" from the previous lesson.
2. With `range(0, 5)`, which numbers are displayed — what's the first and what's the last? Read back through the explanation of range in this lesson and check your answer.
