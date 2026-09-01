<!-- source: sha256:00729faad7d032d572747784277600de8b610c1d37d781ce7f0143d07b8f0e3f -->

# Running your first script

## Learning goals

uv, your quartermaster, is in place, so it's finally time to run your first script. In this lesson you'll create a practice project, write one script, and run it. You'll also actually see "the moment uv fetches Python itself," which the previous lesson promised.

By the end, you'll be able to go round the "write → run → see the result" loop with your own hands. That loop is the basic move for every lesson that follows.

<!--
A three-step flow diagram of "write → run → see the result". Left, "Write": an editor UI mock (hello.py with the single line print("Hello, Python!")). Center, "Run": a terminal UI mock (with uv run hello.py typed in). Right, "See the result": a terminal UI mock (the output Hello, Python!). Connect them left to right with arrows, and add a return arrow from right to left labeled "fix it and go round again"
-->
![Three-step flow: write hello.py in an editor, run it with uv run in a terminal, see the output, with a return arrow read](images/write-run-see-loop-2.png)

Rather than the details of the diagram, look at the **arrow going back from right to left**. You don't go round once and stop — you fix it and go round again. That cycle is everyday life in programming.

## Creating a project

First, create a practice **project**. A project is a workshop folder that holds a script together with the full set of tools it uses.

In a terminal, move to where you want the project to live and run the following. From here on the examples assume Documents, but **anywhere else is fine** — in that case it's normal for the paths on your screen to differ from the examples.

```powershell
cd Documents
uv init python-practice
```

If `cd` fails, the path shown in your prompt (the `C:\Users\...>` part) tells you where you currently are, so move again from there.

```text
Initialized project `python-practice` at `C:\Users\(your username)\Documents\python-practice`
```

A folder called `python-practice` appears, with a few files inside.

```text
python-practice/
├─ main.py           a sample script (you can delete it later)
├─ pyproject.toml    this project's settings file (uv reads and writes it)
├─ README.md         where you write a description of the project
└─ .python-version   records which Python version to use (uv reads it)
```

**Knowing the file names is enough for now.** The only thing you edit is a script like `main.py`; uv looks after the other files. Hidden files whose names start with `.` (such as `.gitignore`) are created too, but those belong to the Git Basics Series, so we won't touch them here. It doesn't matter whether you can see them or not.

## Writing a script

Now that you have a workshop, write one set of instructions (a script). You could use the sample `main.py` as-is, but **to experience creating a file from scratch with your own hands**, make a new one (you can leave `main.py` untouched).

In your editor (VSCode is handy if you have it), open the `python-practice` folder, create a file called `hello.py`, write just this one line, and save.

```python
print("Hello, Python!")
```

`print()` is the instruction "display what's inside the parentheses on screen." Why the text is wrapped in `"..."` (quotation marks) is covered in the Python Syntax Basics Course, so for now just take it as a fixed way of writing it. This one line is your first script.

## Running it

In the terminal, move into the `python-practice` folder and run it (if you opened this folder in VSCode and brought up a terminal, you're already inside it, so no `cd` is needed).

```powershell
cd python-practice
uv run hello.py
```

On the first run, a few lines of output scroll by before the result.

```text
Using CPython 3.12.13
Creating virtual environment at: .venv
Hello, Python!
```

Those first two lines are what the previous lesson was pointing at. **uv prepared Python itself (CPython) and created a tool shed just for this project (a folder called `.venv`)** — these are the traces of the quartermaster doing its job. Depending on your environment, a line about downloading Python may appear, and the version numbers may differ; all of that is normal.

If `Hello, Python!` is on the last line, it worked. Run `uv run hello.py` once more — this time the sourcing is done, so just the one line of output comes back instantly.

> [!NOTE]
> A file called `uv.lock` has also appeared. It's the **inventory list** for the tool shed, and uv rewrites it. **You'll never open or edit it.** Just get familiar with the name.

## Don't be afraid of errors

Now let's break it on purpose, once. Delete the `)` at the end of the line in `hello.py`, save, and run it again.

```text
  File "C:\...\python-practice\hello.py", line 1
    print("Hello, Python!"
         ^
SyntaxError: '(' was never closed
```

It looks like a wall of text, but there are only two parts you need to read: **which file and which line** (the first line), and **the error name and explanation on the last line** (a `(` was never closed). Reading just those two parts points you close to the cause.

If you still can't make sense of it, the fast route is to **paste the error message straight into the internal AI chat (the chat tool covered in the AI Basics Series) and ask "what does this error mean?"** An error isn't a failure, it's Python replying to you. They come up plenty of times in this series, so get used to the idea now: seeing one doesn't break anything.

Once you've had a look, put the `)` back, save, and run `uv run hello.py` again. `Hello, Python!` should come back — **break it, fix it, and it returns**. Having seen that with your own eyes is the biggest thing you get out of this lesson.

## Try it

Add a second line to `hello.py` so that two messages are displayed in order.

- What to do: write one more `print()` line and run it with `uv run hello.py`
- Given: do this inside the `python-practice` project you created while reading
- Don't worry about: what the messages say. Any text you like is fine

<details>
<summary>Sample answer</summary>

You've succeeded if you add `print("This is the second line")`, run it, and two lines appear.

</details>

## Summary

These three are all you need to take away.

1. `uv init <name>` creates a project (a workshop). uv looks after the settings files
2. **`uv run <filename>` runs it.** On the first run, Python itself and the tool shed (`.venv`) are prepared automatically
3. When an error appears, read **the file name and line number, and the last line**. If you can't work it out, paste it into the internal AI chat

You've been round the "write → run → see the result" loop once. That completes the Python Setup Course. Next, in the Python Syntax Basics Course, you start widening the range of instructions you can write.

## Check your understanding

1. A folder called `.venv` was created on your first `uv run`. Explain in your own words what it's there for.
2. When an error message appears, which two parts should you read first?
