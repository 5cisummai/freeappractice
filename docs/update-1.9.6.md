# Update 1.9.6: Practice, understand, challenge a friend

## Goal

Make practice more interactive, help students learn from mistakes, and give them a simple reason to share Free AP Practice with a friend. This update builds on the existing Coach canvas and practice flows with four improvements.

This document describes the general product direction. It is not a detailed implementation specification, and the features below are planned rather than shipped.

## 1. Sim challenges

Turn Coach's Physics and Math Sims into short learning challenges instead of only interactive demonstrations.

### Student experience

1. Coach presents a simulation and asks the student to predict an outcome.
2. The student changes a variable and runs the simulation.
3. The student explains what happened, and Coach connects the result to the underlying concept.

For example: “Keep launch speed fixed. What happens to the range when you change the launch angle from 30° to 45°?” The student predicts, tries it, and discusses the result.

### Initial scope

- Start with a few well-defined physics and math challenges using the existing canvas.
- Keep the prediction, experiment, and explanation together in the Coach conversation.
- Make controls and instructions clear on both mobile and desktop.
- Let students retry and explore without making every interaction a graded assessment.

Success means students can complete a coherent challenge and understand how changing a variable affects the result.

## 2. “Fix my mistakes” mini-quizzes

Give students a direct way to practice the concepts they missed rather than leaving them at a score or explanation.

### Student experience

After a practice session or graded quiz, the student selects **Fix my mistakes**. The app offers a short follow-up quiz focused on missed concepts, then shows a concise recap of what improved and what still needs practice.

For example: a student misses questions about cellular respiration, completes a short follow-up quiz on that concept, and sees the results alongside the original mistakes.

### Initial scope

- Build a short quiz from the course, units, and available concept information associated with missed questions.
- Prefer fresh questions that test the same ideas rather than simply repeating the original answers.
- Show explanations after answering and a clear next step after completion.
- Be honest about limited question availability and the precision of concept targeting.
- Avoid treating success on a few questions as proof of full mastery.

Success means a student can move from a mistake into relevant follow-up practice with one clear action.

## 3. Challenge a friend

Make sharing useful by letting two students answer the same short quiz and compare results.

### Student experience

A student creates a five-question challenge for a course or unit, completes it, and shares a link. A friend opens the link, answers the same questions, and sees a comparison after submitting.

### Initial scope

- Use a fixed question set so both students receive the same challenge.
- Start with asynchronous challenges that work through a shareable link.
- Keep answers and the creator's results hidden until the friend submits.
- Compare scores; avoid making speed the primary measure of learning.
- Keep joining simple and explain clearly when an account is needed to save results.
- Share only the display information needed for the comparison, with no email addresses or private practice history.

Live multiplayer, matchmaking, public leaderboards, and tournament systems are outside the initial scope.

Success means a student can create, share, and complete a challenge with a friend without coordinating a live session.

Related Linear issue: [DEV-92: Create a quiz battle system](https://linear.app/freeappractice/issue/DEV-92/create-a-quiz-battle-system).

## 4. Bring back Desmos

Restore convenient calculator access for math and physics practice.

### Student experience

The student opens Desmos beside a relevant question, uses it while solving, and returns to answering without losing their place.

### Initial scope

- Inspect the previous calculator integration and reuse it where appropriate.
- Provide an obvious entry point on relevant practice and quiz surfaces.
- Keep the calculator usable on mobile without covering the question or answer controls.
- Preserve the current question and answer when opening or closing it.
- Respect the calculator rules of the selected practice or exam mode.

Success means calculator access supports solving a question without interrupting the practice flow.

Related Linear issue: [DEV-141: Bring back Desmos calculator](https://linear.app/freeappractice/issue/DEV-141/bring-back-desmos-calculator).

## Release shape

Sim challenges are the headline feature. Mistake mini-quizzes improve the everyday learning loop. Friend challenges make that loop shareable, and Desmos supports the math and physics experience.

Keep each feature small enough to deliver a complete student flow. Resolve the exact entry points, question-selection behavior, account requirements, and calculator integration during implementation rather than adding new systems preemptively.

## Measurement

Track whether students:

- Start and complete Sim challenges.
- Start and finish mistake mini-quizzes, then continue practicing.
- Create and share friend challenges, and whether recipients complete them.
- Open the calculator and continue answering questions.

Use these signals to assess adoption and friction. Completion counts alone do not establish learning gains or retention improvements.
