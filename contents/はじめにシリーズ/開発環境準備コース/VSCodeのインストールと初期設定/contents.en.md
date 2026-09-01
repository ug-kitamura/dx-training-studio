<!-- source: sha256:c65bffd4bb3dae19db48c21c816ffb6b5fa71e783d743564cf074b2e44575126 -->

# Installing and setting up VSCode

## Learning goals

This lesson is the finishing touch on getting your environment ready. In this lesson you'll install **VSCode (Visual Studio Code)**. VSCode is a highly extensible code editor. From here on it's the main tool you'll do everything with — using Git and writing Python code alike.

The goal is "I can open a folder, create one file, and edit it." You won't touch anything beyond that for now.

## There are two routes in. We'll take the department's official one

There are two routes to installing VSCode inside the company, and plenty of people get stuck deciding between them. To get straight to the point: **this training uses ① only**.

| Route                                                          | How it's positioned                                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ① Install the **department's customized build** via Chocolatey | **The department's official procedure.** This is what this training uses            |
| ② Install VSCode directly from the internal system             | The company-wide official procedure. It works, but this training doesn't cover it |

There are two reasons for choosing ①: the department's standard settings are in place from the start, and everyone ends up in the same state, so you won't get stuck later on "only my screen looks different." If you've already installed it via ②, you can still follow along, but some screens and settings may differ from what's described here.

## Install VSCode via Chocolatey

If you installed Chocolatey in the previous lesson, this is one click.

1. Search for "**Chocolatey GUI**" in the Start menu and open it
2. Find the department's customized build of **VSCode** in the list
3. Click the "**Install**" button

No commands to type, and no approval request needed (the only thing that needed one was Chocolatey itself).

> **社内画像**: Chocolatey GUI で部門向けカスタマイズ版 VSCode を入れる一連の画面。差し込みは「画面が変わるごとに1枚」を目安に、上の手順1〜3の範囲を対象とする。最低限、一覧で部門向けカスタマイズ版 VSCode の表示名が読める画面と、「Install」ボタンが見える画面の2枚。GUI の起動方法やパッケージの表示名が本文と異なっていたら、本文側をあわせて直す。PC の管理番号・ユーザー名が写る場合はマスクする

<!-- 訳注: `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

Once the installation finishes, launch VSCode from the Start menu. If a "Welcome"-style tab opens on first launch, feel free to close it with the × on the tab.

## Only three places to look at first

Opening it for the first time, you may be thrown by the rows of unfamiliar buttons. There really are a lot of features, but **there are only three places to look at right now**. You can ignore everything else for the time being.

<!--
A UI mock of the initial VSCode screen. A vertical activity bar on the far left (with the two-stacked-pages Explorer icon at the very top), the Explorer sidebar to its right (a folder name and a file list), and the wide area on the right as the editor, showing text. Add only three annotations, "① Activity bar: switch between features", "② Explorer: what's inside the folder", and "③ Editor: where you edit files"; do not add any other explanatory labels, hints, or titles.
Matching the real screen matters for this diagram. If the generated quality is poor, use a screenshot instead.
-->
![UI mock of the initial VSCode screen, marking three spots: the activity bar, the Explorer, and the editor](images/vscode-initial-screen-ui-mock-5.png)

The numbers in the diagram match the numbers in the table below. Getting a feel for where things are is enough.

| Place                                            | Role                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| ① Activity bar (the vertical strip on the far left) | Switches between features. The only icon you'll use now is the Explorer at the top |
| ② Explorer                                       | Shows what's inside the folder you have open                             |
| ③ Editor (the wide area on the right)            | Where you open and edit files                                            |

_Source: [VS Code documentation, "User Interface"](https://code.visualstudio.com/docs/getstarted/userinterface) (retrieved August 2026)_

> [!NOTE]
> You can add "extensions" to VSCode to give it more features (for example, Git Graph, which shows your Git history as a diagram — that one is already approved). However, **the extensions you can install inside the company are limited to approved ones**. You don't need to install anything right now. We'll walk you through it in the lesson where you need it.

## Open a folder and create a file

VSCode is a tool for **opening a whole folder** rather than "opening files one at a time." Both Git and Python from here on work folder by folder. Let's walk through the flow once.

1. Create a practice folder called `dx-practice` somewhere easy to find, such as your Desktop
2. In VSCode, go to the "File" menu → "Open Folder" and select `dx-practice` (if you're asked "Do you trust the authors of the files in this folder?", "Yes" is fine — it's a folder you made yourself)
3. In the Explorer on the left side of VSCode, hover over the folder name row to make the "New File" icon appear to the right of the name, click it, type `memo.txt`, and press Enter
4. Write any one line in the editor and save it with `Ctrl+S`

If the ● on the tab (the unsaved marker) disappears, it's saved.

## Try it

Following the steps above, open the practice folder `dx-practice` and create one file. If you were already following along hands-on in the previous section, it's enough to confirm that the ● is gone (saved).

- Given: Chocolatey was installed in the previous lesson
- Don't worry about: what's in the file, or when to use which file extension. One line in `memo.txt` is plenty

<details>
<summary>Sample answer</summary>

You're done when you can see `memo.txt` in the Explorer and it's saved (the ● is gone).

</details>

## Summary

Three things to take away.

1. Install VSCode through **the department's official procedure (the customized build via Chocolatey)**
2. The places to look at on screen are just three: **the activity bar, the Explorer, and the editor**
3. VSCode is used by **opening a whole folder**

That completes the Getting Started Series. Getting your environment ready is unglamorous but important. The weapons you've obtained are Chocolatey and VSCode — the foundation of everything that follows. On the Mandala, **the Git Basics Series and the Python Basics Series have been unlocked**. Which one you take on first is up to you.

## Check your understanding

1. Why does this training guide you through ① (via Chocolatey) only when installing VSCode? Explain it in your own words.
2. When you type characters into a file you just created, which of the three places on screen are you working in? Check with the table in this lesson.
