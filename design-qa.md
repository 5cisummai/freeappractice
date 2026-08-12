# Question shell design QA

## Evidence

- Source visual truth: `/var/folders/55/w7kk_10d159b57yvkx_1qnvw0000gn/T/codex-clipboard-9817f9c4-22ba-4de9-bfdb-da8a7b5dfd10.png`
- Browser implementation before the final edge-to-edge adjustment: `/private/tmp/question-shell-centered-frame-final.png`
- Side-by-side comparison: `/private/tmp/question-shell-design-qa-final-comparison.png`
- Source pixels: 975 × 723; implementation pixels: 1280 × 720.
- CSS viewport: 1280 × 720; browser device scale factor: 1.
- Density normalization: none; the source is a supplied screenshot with a different viewport, so comparison focuses on the shared fullscreen composition and interaction states rather than pixel-level spacing.
- State: generated unlimited-practice question, fullscreen question shell, controls popover open and then closed in the localhost tab.

## Comparison

The implementation preserves the reference’s core structure in the captured state: a fullscreen question surface, a compact top controls affordance, a large two-column question/answer workspace, a bottom-centered question selector pill, and a bottom-right Next action. The question-card expand/collapse affordance remains on the card header, while the shell owns the fullscreen state. The fullscreen surface is translucent with backdrop blur, and the controls popover is anchored to the card header button.

Focused interaction evidence was captured separately in the browser: opening `Controls` revealed the shared Unlimited practice / Graded quizzes switcher, AP class selector, unit selector, and generation action without changing the fullscreen question layout. The popover measured at `x=819, y=80` within the viewport while the trigger was at `x=1459, y=40`, confirming it is visible and positioned from the card control.

## Findings

- The first popover implementation opened offscreen because the trigger and content were split across the shell and question-card component boundaries. The final implementation colocates the Popover root with the question card and passes an explicit trigger ref as `customAnchor`.

The reference contains exam-specific section/timer/annotation metadata that is not part of this product’s question model. The implementation intentionally uses the app’s question title, generated prompt, answer choices, and existing Next action instead.

## Implementation checklist

- [x] Fullscreen expansion is owned by the shared practice shell.
- [x] Expand/collapse trigger is on the question card header.
- [x] Top course/unit/mode controls are hidden behind the fullscreen `Controls` toggle.
- [x] Quiz question navigation is a bottom-centered expandable pill.
- [x] Unlimited practice / Graded quizzes is integrated into `QuestionShell`.
- [x] `QuestionShell` supports `alignment="center"` and `alignment="left"`.
- [x] Landing page and authenticated practice page use the shared shell.
- [x] Browser interactions checked: mode switch, course selection, quiz generation, fullscreen expansion, controls disclosure, and question navigation visibility.
- [x] Console checked; only the pre-existing Google Identity Services FedCM token warning was observed after the stale hot-reload error was resolved.
- [x] `bun run check`, `bun run lint`, and `git diff --check` pass.

## Comparison history

- Initial shell pass: fullscreen state worked, but the card expand button and top controls were not located according to the reference. The expand trigger was moved back to the question-card header, and the shell controls were collapsed behind `Controls`.
- Final code pass: moved quiz navigation into the question-card footer as a popover and made the fullscreen shell edge-to-edge.
- Controls fix: colocated the fullscreen controls Popover with the question card, added an explicit custom anchor, raised its z-index above the fullscreen surface, and verified open/close behavior in the localhost tab.

final result: passed
