# CapCheck domain glossary

## CapCheck

The product that evaluates factual and predictive financial claims made in a
short-form video and returns a cited credibility scorecard.

## Source video

The TikTok, YouTube Short, or uploaded video submitted for analysis.

## Claim

A distinct statement extracted from the source video. A claim is factual,
predictive, or opinion, and may or may not be checkable.

## Checkable claim

A claim that can be compared with external evidence. Opinions are not treated
as checkable claims.

## Verification

The evidence-backed evaluation of one checkable claim. Its verdict is `true`,
`mostly-true`, `unverifiable`, or `false`.

## Evidence source

A cited source used to support a verification. Sources receive a trust tier so
the scorecard can distinguish regulators and government sources from major
outlets and unknown sources.

## Cap Score

The overall 0 to 100 credibility score for a source video. Higher scores mean
the video contains more misleading or unsupported claims. The display labels
range from `No cap` to `Some cap` to `Full of cap`.

## Scorecard

The complete result shown to the user, including the Cap Score, claim
verifications, citations, hype-language analysis, and concrete next actions.

## Hype language

Persuasive wording or framing in the source video that may pressure a viewer,
such as guarantees, urgency, or unsupported popularity claims.

## Demo fixture

A frozen scorecard used by the UI lane and as presentation insurance. A demo
fixture must use the same contract as a live pipeline result.
