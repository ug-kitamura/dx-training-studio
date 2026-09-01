<!-- source: sha256:0421b48d6c9713370be3563fd867ade92d80bced8d396b1b438accec2c1a1237 -->

# Setting up your Python environment

## Learning goals

You got the map in the previous course. Now it's time to gear up. In this lesson you'll install **uv**, the tool that gets Python running. It takes a few minutes, and there's **no request and no waiting for approval** — you install it with a single command through Chocolatey, which you already set up in the Getting Started Series.

By the end, `uv --version` will print a version number, and you'll understand why you install uv first rather than Python itself.

## Why uv

Some of you will be thinking, "isn't Anaconda what we use internally?" — the answer to that is at the end of this section. First, what uv is.

When learning to program, plenty of people trip over **setting up the environment** before they ever get to the syntax. Picking a Python version, adding libraries, keeping projects separate — there's a lot to manage, and doing it by hand breaks easily.

That's where uv comes in. Think of uv as Python's **quartermaster**. Instead of hunting down and installing Python itself and the libraries you'll use later, you ask the quartermaster. uv handles getting and managing everything you asked for.

<!--
A structural diagram presenting uv as a "quartermaster". On the left, the flow of uv arriving from Chocolatey (the internal distribution platform); in the center, a card for uv; on the right, two cards for the things uv sources: "Python itself" and "libraries (ready-made tools)". Arrows show the direction of "ask → it gets sourced". A simple layout of cards side by side
-->
![Structural diagram showing uv installed from Chocolatey acting as the quartermaster that sources Python itself and libra](images/uv-as-procurement-agent-2.png)

The point of the diagram is this: **the only thing you touch directly is uv**. Python and the libraries stay behind uv — you never handle them directly.

_Source: [uv - Astral Docs](https://docs.astral.sh/uv/) (retrieved August 2026)_

> [!NOTE]
> Internal Python environments have mostly been set up with **Anaconda** until now, but Anaconda **will no longer be supported after the end of 2026**. This training sets things up with uv, which is the standard going forward. uv can coexist with Anaconda, so even if your PC already has Anaconda, follow the steps below as written.

## Installing uv

You install uv through Chocolatey. **No request to the IT Service Portal is needed** — you already filed that request when you set up Chocolatey, so it's covered.

Run the following in a terminal. You can reuse **the same PowerShell window** you opened when checking the Chocolatey setup (the terminal inside VSCode does the same thing).

```powershell
choco install uv
```

A few lines of progress scroll by. If the following line is in the output, it worked (other lines appear before and after it).

```text
The install of uv was successful.
```

> [!TIP]
> If you're asked for a confirmation like `[Y]es` along the way, type `Y` and press Enter to continue. If it stops with a permissions error (Access Denied and the like), reopen the terminal with **"Run as administrator"** and run it again. If it says the `choco` command itself can't be found, go back to the check steps in "Setting up Chocolatey" in the Getting Started Series.

Next, confirm that it's installed.

```powershell
uv --version
```

```text
uv 0.11.6 (65950801c 2026-04-09 x86_64-pc-windows-msvc)
```

It doesn't matter if the version numbers or what's in the parentheses differ from the above. If one line starting with "uv" comes back, **that's all the confirmation you need**.

> [!TIP]
> If it says the `uv` command can't be found, **close the terminal and reopen it**, then try again. Right after an install, a terminal that's been left open sometimes hasn't been told about the new command yet.

## Wait — when do we install Python?

You might be wondering: "this is a Python lesson — when do we install Python?"

The answer is that **you don't install it yourself in this training** (strictly speaking there is a command for installing it yourself, but you'll never need it). When you try to run a script, uv prepares the Python it needs automatically. You hired a quartermaster, so you can leave the individual supply runs to it. You'll see this happen in the next lesson — at the moment you run your first script, you can watch uv fetch Python.

_Source: [uv - Astral Docs, "Running scripts"](https://docs.astral.sh/uv/guides/scripts/) (retrieved August 2026)_

## Try it

- What to do: if you haven't already run `choco install uv` while reading, run it, then confirm that `uv --version` returns a version line. **If you already ran it while reading, just the `uv --version` check completes this**
- Given: Chocolatey is installed (the Development Environment Setup Course in the Getting Started Series)
- Don't worry about: what the version numbers mean. As long as something comes back, you can move on

<details>
<summary>Sample answer</summary>

You've succeeded if a line like `uv 0.11.6 (...)` appears.

</details>

## Summary

Three things to take away from this lesson.

1. uv is Python's **quartermaster** — you ask uv to source both Python itself and your libraries
2. Installing it is **one command from Chocolatey, `choco install uv`**. No request needed
3. You don't install Python yourself. **uv prepares it automatically when it's needed**

One more piece of gear. In the next lesson, you finally run your first script.

## Check your understanding

1. Put uv's role into one sentence of your own, without using the word "quartermaster."
2. Why didn't you install Python itself in this lesson?
