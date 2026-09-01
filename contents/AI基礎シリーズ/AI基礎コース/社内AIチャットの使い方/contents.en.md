<!-- source: sha256:6b69923a03e1e3bc7869ef56ed662b5b4fea5bef2ae35f82a5d6ed9022096dc0 -->

# Using the internal AI chat

## Learning goals

This is where the **AI Basics Series** begins. In this series you'll learn how to open the internal AI chat, and how to ask in a way that gets you an answer. By the end of this lesson, you'll have a weapon in hand: "when I'm stuck, I ask the AI first."

In the Getting Started Series you made a promise — when you don't know something, look it up yourself first, and ask an AI to keep moving. Plenty of people have used ChatGPT to look something up. But when you were stuck on a work error or an internal procedure, did you ask an AI? "I don't know how much internal information I'm allowed to put in" and "I don't know how to ask" — this lesson clears both of those up.

There isn't much to memorize. **Open it and ask, attach three pieces of material to your question, and know where the line is on what you may put in.** Take away that much and you've passed.

## What the internal AI chat is — the colleague at the next desk

The internal AI chat is an in-house AI chat tool you open in your browser. Under the hood it's based on Google's Gemini, and everyone in the company can use it for free. There's no pay-per-use charge either.

Roughly speaking, it's **a colleague at the next desk who is always there**. Asking costs nothing, and nobody ever gets tired of your questions. That said, it doesn't know everything about how the company works, and it does get things wrong now and then (how to deal with that is covered in a later section).

You may be worried that "what I type gets used to train the AI and leaks out somewhere." With the internal AI chat, **what you type is not used as AI training data**. This matches the policy Google publishes for its enterprise Gemini. Go ahead and try it.

_Source: [Google Workspace — AI privacy](https://workspace.google.com/security/ai-privacy) (retrieved August 2026)_

Here's how to open it.

> **社内**: 社内AIチャットの正式名称と開き方を書く。答えるべき問い —
>
> - ツールの正式名称は何か（本文中の「社内AIチャット」はそのまま残してよい。初出のここでだけ正式名称を添える）
> - どこから開くか（ポータルのリンク名、または URL）
> - サインインや追加認証は要るか。要るならどのアカウントか
>   形式: 番号付き手順2〜4ステップ / 100〜200字

> **社内画像**: 社内AIチャットを開いた直後の画面。メッセージの入力欄が見える状態で撮る。画面が変わるごとに1枚を目安に（ポータルのリンク → 開いた直後、の2枚程度を想定）。個人名・過去の会話履歴はマスクする

<!-- 訳注: `> **社内**:` / `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

Once it's open, type something into the input box and send it. "What is Python?" is fine. If a reply comes back, you're ready.

We said it doesn't know everything, but it does know some things. The internal AI chat can look at information in docupedia, the internal documentation system, and it's also connected to your own Outlook data. That's why it can answer questions like "where is the internal procedure written down?" You can switch each of these sources on and off yourself (turning Outlook off, for example). This lesson doesn't get into when to use which. Just remember that the setting exists.

> **社内**: データ取得先（docupedia / Outlook など）の on/off を切り替える画面の場所を書く。答えるべき問い —
>
> - どのメニューから開くか
> - 既定では何が on になっているか
>   形式: 手順2〜3ステップ / 80〜150字

## Three tips for asking

So how do you ask in a way that gets you a useful answer? First, look at an example that doesn't work.

```text
It doesn't work. What should I do?
```

What comes back from this is generic advice that fits anywhere. It isn't the AI's fault — **it doesn't have enough material to answer with**.

The trick is **the same as asking for directions**. "Where is the station?" isn't enough for anyone to help. If you say where you are now, where you want to go, and how far you've got, the other person can point the way. Attach those same three things to your questions for the AI.

| What to attach | Asking for directions | Asking the AI |
|---|---|---|
| **Situation** | Where you are now | What you were doing and what happened (the tool, the screen, the error text) |
| **What you want** | Where you want to go | How you want things to end up |
| **What you tried** | How far you've got | What you've already attempted, and what came of it |

Here's that same "it doesn't work," rewritten with all three attached.

```text
[Situation] I ran the Python script report.py in PowerShell on Windows and got
"ModuleNotFoundError: No module named 'pandas'".
[What I want] I want report.py to run all the way through.
[What I tried] I opened the script and checked that "pandas" is spelled correctly.
Please tell me what this means and what I should do next.
```

<!--
A chat UI mock. In the user's bubble, a question written on three lines labeled [Situation], [What I want], and [What I tried] (the same ModuleNotFoundError example as in the body); below it, the AI's reply bubble (short — only the opening, "This means pandas isn't installed. Follow these steps…"). The three labels are visibly color-coded. Add no other explanatory labels, hints, or titles. Light color scheme, about 720px wide
-->
![Chat UI mock showing a user question labeled Situation, What I want, and What I tried, with a short AI reply](images/ai-chat-three-part-question-2.png)

In the diagram, just check that all three lines are there in the question bubble. You don't need to read what the AI actually replied.

Labels like [Situation] are optional. What matters is **that all three are in there**. It's fine if it gets long — we tend to keep things short out of politeness when asking a person, but with an AI there's no need to hold back.

For what it's worth, Google's official guide recommends attaching four things to a prompt: persona, task, context, and format. Here we've simplified that down to three that are easy to reach for when you're stuck. That's plenty for a first understanding.

_Source: [Gemini for Google Workspace Prompting Guide 101 (Google)](https://services.google.com/fh/files/misc/workspace_with_gemini_prompting_guide.pdf) (retrieved August 2026)_

## Paste the error in as-is and ask

Once you start touching Git and Python in the series ahead, you'll see red English error messages over and over. Some people close them without reading; others go ask a person without reading. Both are common, and understandable — an error you've never seen before is intimidating.

But **error messages are exactly the kind of question AI is good at**. Error text follows a fixed format, and the AI has seen enormous numbers of messages in that same format. You don't need to understand it, so just paste it in. One thing only: before you paste, check that nothing above the allowed level is mixed in (where that line is comes in the next section). There are two routes.

| Route | What you do | When it fits |
|---|---|---|
| Paste as text | Select the error text with the mouse, copy it, and paste it into the input box | Screens where text can be selected, such as a terminal |
| Paste as an image | Take a screenshot and paste it into the input box | Screens where text can't be selected, or when you can't tell what the problem is |

On Windows you can take a screenshot of a selected area with `Win + Shift + S`. Once you've taken it, `Ctrl + V` pastes it straight into the input box.

Attach the three things from the previous section here too. "I got this error (situation). I want it to run (what I want). I haven't tried anything yet (what I tried)" — if you haven't tried anything, it's fine to say so.

> **社内画像**: 社内AIチャットで、本文の ModuleNotFoundError の例をそのまま送り、回答が返ってきた画面。質問と回答の冒頭が1枚に収まる状態で撮る。スクリーンショットを貼って質問した画面も1枚あると経路2つが揃う。社内情報・個人名が写る場合はマスクする

## What you may put in, and what you may not

Now let's draw the line on how much internal information you may put in.

To get straight to it: **internal information has security levels, and the normal level — information anyone in the company can view — is fine to type in.** It is not "never put anything about the company in." That would leave you unable to ask your colleague about internal procedures, which would take away half the point.

The line is drawn above that level. The internal guidelines are the authority on all of it: which information falls into which level, what the levels are called, and how to judge.

> **社内**: 社内情報のセキュリティレベルと、社内AIチャットへの入力可否を書く。答えるべき問い —
>
> - レベルの区分名は何か（例: 通常／社外秘／機密、のような呼び名）と、それぞれの一言の説明
> - どのレベルまで社内AIチャットに入力してよいか。境界の目安になる具体例を、入れてよい側・いけない側で1つずつ
> - ガイドラインはどこにあるか（docupedia のページ名とリンク）。迷ったとき誰に（どこに）確認するか
> - 「入力が AI の学習に使われない」「誰でも無料で使える」の根拠はどこに書かれているか（本文の該当箇所に出典として添える。根拠が無ければ本文の断定を弱める）
>   形式: 表（レベル／説明／入力可否）1つ＋リンク1本＋箇条書き2〜3点 / 150〜300字

Error text and screens sometimes have higher-level information mixed in. Check for that before you paste, and delete anything you find. With a screenshot, crop that part off or black it out before pasting.

You might think, "if it isn't used for training, surely I can put anything in?" **Not being used for training and being allowed to type it in are two different things.** Where that line sits is set by internal rules, separately from whether something is used for training. This isn't specific to our company either — it's a shared principle in public guidelines too.

_Source: [IPA, "Guidelines for introducing and operating text-generation AI" (July 2024)](https://www.ipa.go.jp/jinzai/ics/core_human_resource/final_project/2024/f55m8k0000003spo-att/f55m8k0000003svn.pdf) (retrieved August 2026)_

One more thing: some of you will have thought, "if it's connected to Outlook, what happens to the information inside my email?" That's a fair question. The connection is a mechanism managed by the tool itself, and it's handled **separately from what you paste into the input box yourself**. You don't need to think about that distinction for now — just keep what you paste yourself inside the line.

## Check the answer before you use it

One last weakness of your colleague. **AI can be confidently wrong.** It will sometimes answer with a command that doesn't exist, or an out-of-date procedure.

That's no reason to approach it with suspicion. There's only one thing to do: **check the answer by running it yourself**. If you're taught a procedure, do the procedure. If you're taught a command, type it. If it works, it was right; if it doesn't, paste that result back in and ask again — "I did what you said, and now this happens." That back-and-forth is the right way to work with an AI.

If a word you don't know shows up in the answer, it's fine to ask right back. "What is pip?" Your colleague never gets tired of you, however many times you ask.

## Try it

Ask the internal AI chat about one error message.

- What to do: open the internal AI chat, paste in an error message, and ask what it means and what to do next. Attach the three things — situation, what you want, what you tried — when you paste it
- Given: if you don't have an error on hand, it's fine to paste the sample below as-is. In that case, you can copy the situation and what-you-tried straight from the rewritten example in "Three tips for asking" (it doesn't have to have actually happened)
- Don't worry about: whether the answer is correct. The point this time is to experience asking and getting something back

```text
ModuleNotFoundError: No module named 'pandas'
```

<details>
<summary>Sample answer</summary>

You've succeeded if you get back an explanation along the lines of "pandas isn't installed," plus the steps to install it. You don't need to run those steps yet.

</details>

## Summary

These three are all you need to take away.

1. **Open the internal AI chat and ask.** Asking costs nothing, as many times as you like
2. Attach the three things to your question — **situation, what you want, what you tried**. Paste errors in as-is
3. What you may put in goes **up to the normal level (information anyone in the company can view)**. When in doubt, check the guidelines

And check the answers you get back by running them yourself — that's how you work with this colleague.

That completes the AI Basics Series. It was one lesson, but the weapon you picked up is a big one: **when you're stuck, ask first**. You'll keep using it in every series ahead — Git, GitHub, Python — and in the final hands-on. In the hands-on you're allowed to build your tool while asking the AI. So get comfortable with asking today.

## Check your understanding

1. Take the question "I got an error. Please fix it" and rewrite it yourself in the form this lesson describes, with all three things attached. The content can be made up.
2. If "what you type isn't used for training," why is there still a line on what you may type in? Read back through the lesson and put it in one sentence of your own.
