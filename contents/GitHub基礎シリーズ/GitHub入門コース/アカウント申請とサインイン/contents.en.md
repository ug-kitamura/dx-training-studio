<!-- source: sha256:2c717d76d175a153b915a7e16823bfd82a8f56e034e8622ffb357c370e9d5726 -->

# Account request and sign-in

## Learning goals

In the previous lesson you learned that internal GitHub is request-based. The goal of this lesson is to **submit your internal GitHub account request, sign in once it's approved, and finish the first bits of setup**. Get through this and the key to the shared vault is yours.

> [!IMPORTANT]
> **Account approval takes roughly three days.** The lesson itself is 10 minutes, but on the calendar it spans more than one day. It's the longest wait of any request in this training, so **submit the request right now, and work on other series while you wait for approval.** When the approval notice arrives, come back to "Sign in and look at your own page" in this lesson.

```text
Submit request ───about 3 days─── Approved ───── Sign in ───── Check your profile
   ↑ you are here (a few minutes)       └──── about 5 minutes in total from here ────┘
```

It's the same pattern as installing Git. Just look at the shape: it splits into two chunks, "submit the request first" and "do the rest together after approval."

## Submitting the request

The place to go is the same **IT Service Portal** as for Chocolatey and Git. This is your third request, so you should know the drill by now — the one difference this time is that **this request costs money (€16 per month)**. Even if you don't remember the drill, the steps below walk you through it.

> **社内**: IT Service Portal での社内GitHub アカウント申請の手順を書く。答えるべき問い —
>
> - IT Service Portal のどのメニューからたどるか（Chocolatey・Git の「SW install」と同じ入口か、別のカテゴリか）
> - 申請フォームで何を入力・選択するか（サービス名の正式表記・申請理由の書き方の例・費用の承認者を誰にするか）
> - 承認の目安時間と、承認されたことは何で分かるか（メール通知か、画面上の表示か）
> - 承認後、アカウントはどう渡されるか（初回サインインの案内が届くのか、会社アカウントでそのまま入れるのか）
>   形式: 番号付き手順4〜6ステップ / 300字程度

> **社内画像**: IT Service Portal で社内GitHub の申請フォームを開いた状態のスクリーンショット。画面が変わるごとに1枚を目安に、メニューの入口からフォーム送信までを撮る。申請者名・社員番号・所属・承認者名はマスクする

<!-- 訳注: `> **社内**:` / `> **社内画像**:` は執筆者向けの空欄マーカー（構造記法）なので原文のまま残した。中身は人が社内情報を埋める段階で英語化される想定 -->

Once the request is in, you can close this page until the approval comes through.

## Sign in and look at your own page

When the approval notice arrives, open internal GitHub (the previous lesson's "Internal GitHub and GitHub.com" shows how). Signing in is **single sign-on (SSO) with your company account**. You sign in with the same ID you use for every other internal system, so there's no new GitHub-specific password to create.

Once you sign in, the home screen opens. You don't have a single repository yet, so it's almost empty. That's normal.

1. Click the **round icon in the top right** of the screen (your avatar)
2. At the top of the menu that opens, you'll see **"Signed in as your-username"**. That name is your **username**
3. Choose **"Your profile"** from the same menu and your profile page opens. Right under your display name (your real name), the same username sits in lighter text

> **社内画像**: サインイン直後のホーム画面と、右上アイコンのメニューを開いてプロフィールページに着いたところ。画面が変わるごとに1枚を目安。ユーザー名・メールアドレス・所属・アバター画像はマスクする

**Make a note of your username.** When a teammate says "I'll invite you to my repository," the username is what you give them (this actually happens in the hands-on).

## Two things to set up first

There are just two things to check. They live **in different places**, so let's say where up front — the display name is under **"Edit profile"** on your profile page, and the email is under the top-right menu's **"Settings" → "Emails" in the left menu**. Both can be fixed later, so there's no need to get them perfect.

| What to check | Where | Why |
|---|---|---|
| **Is your display name (Name) your real name?** | Edit profile | When teammates look for you, a username alone doesn't tell them who you are |
| **Does your email match the `user.email` you set in Git?** | Settings → Emails | Each save (commit) records whose save it is, using `user.email`. If that matches the email registered in GitHub, your commits show up linked to your account |

That second check refers to the email you set with `git config --global user.email` in "Installing and setting up Git" in the Git Basics Series. If you've forgotten it, you can check in the VSCode terminal.

```bash
git config --global user.email
```

If the email shown here is the same as the one under Settings → Emails on GitHub, you're done. Even if they differ, nothing goes wrong at this stage — your avatar just won't appear next to your commits. Make them match whenever you notice.

> [!NOTE]
> If "I entered the same email but my avatar still doesn't show," check whether that email is marked verified in GitHub. All it takes is clicking the link in the confirmation email you were sent.

## Try it

The "Try it" for this lesson is the steps in the body itself.

1. Request an internal GitHub account through the IT Service Portal (**the sooner the better — approval takes about three days**)
2. Once approved, sign in, open your profile page, and note down your username

- Given: while you wait for approval, feel free to move on to other series
- Given: if you don't expect to use internal GitHub for your job and are still talking it over with your manager, wait until **that's settled** before doing step 1 (see "Requesting it, and the cost" in the previous lesson)
- Don't worry about: your avatar image or your bio. Leaving them empty is fine

<details>
<summary>Sample answer</summary>

You've succeeded if you can see a username starting with `@` on your profile page (the display name and email can come later).

</details>

## Summary

This is your third request, and the longest wait of the three. Three things to take away.

1. Request internal GitHub through the **IT Service Portal**. Approval takes **about three days**, which is why you **submit it first**
2. Signing in is **SSO with your company account**. No new password to create
3. Check your **display name** and **email** on your profile. Match the email to Git's `user.email` and your avatar appears next to your commits

The key to the shared vault is now yours. In the next course you'll finally build your own vault on internal GitHub and connect it to the one on your machine.

## Check your understanding

1. What happens if Git's `user.email` and the email registered on GitHub don't match? Explain it in one sentence using the words "commit" and "account."
2. Why does this lesson have you "submit the request first"? Compare it with installing Git and put it in your own words.
