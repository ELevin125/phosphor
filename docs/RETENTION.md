# RETENTION — what makes people keep watching

Companion to FORMAT.md. FORMAT.md says what a video *is*; this says what makes
one get watched. Everything here is derived from the four Instagram uploads
measured on 4 August 2026, checked against attention research where research
exists.

Read this before writing a hook. Run the checklist at the bottom against every
script before it goes to record.

## The measured data

Runtimes are actual, from `beats.generated.ts`, not the target.

| | runtime | views | skip | avg watch | **% of video** | @12s | @60s | **12s→60s** |
|---|---|---|---|---|---|---|---|---|
| flow-field | 73.0s | 132k | 30% | 29s | **40%** | 50% | 27% | **54%** |
| every-frame | 75.3s | 4.8k | 54% | 16s | **21%** | 23% | 14% | **61%** |
| second-listener | 68.6s | 1.9k | 49% | 12s | **17%** | 18% | 7% | **39%** |
| you-vs-ai-3 | 13.8s | 3k | 44% | 7s | **51%** | 60% @3s | 22% @13s | **37%** |

Upload dates: flow-field and you-vs-ai-3 on 26 July, every-frame 29 July,
second-listener 2 August. Follower count was 29 at the first upload and 700 at
the time of measurement; 650 of those came from flow-field.

### The two columns that matter

**`% of video`** is the denominator problem. Distribution is scored on the
*fraction* watched, not the seconds. 29 seconds of a 73s video is 40%; the same
29 seconds of a 45s video is 64%. The runtime is chosen, so the penalty is
self-inflicted.

**`12s→60s`** separates a hook problem from a body problem, and it is the single
most useful number in the table:

- **every-frame's body is the best in the set** — 61% of the people who reached
  12s reached 60s, better than flow-field's 54%. The video is not worse. Its
  first seven seconds are worse, and that is the whole difference between 4.8k
  and 132k.
- **second-listener is the only one that fails at both ends** — 18% at 12s *and*
  39% survival. That is a topic problem, not a hook problem.

Always compute this before diagnosing a video. A low overall number with high
conditional survival means fix the opening; a low number in both means the
subject was wrong.

### flow-field was not just luck

Two figures cannot be explained by the reach lottery:

- **30% skip rate** against 44–54% for everything else. Skip is measured before
  the algorithm has decided anything.
- **0.49% follow rate** (650 from 132k), roughly double a normal Reel.

Luck decided how far it went. The skip rate decided whether it went at all.

Note also that flow-field reached 132k at **29 followers**, and every-frame
reached 4.8k at **700**. Follower count is not an input to distribution. Cold
retention is.

---

## The rules, ordered by leverage

### 1. Ship at 40–50s, not 68–75s

FORMAT.md states a 35–50s target and records that every shipped explainer runs
68–75s. That gap is a ~40% scoring penalty applied to every video before
anything else is considered.

Cutting is an editorial act, not a trimming one — drop a beat, don't speed up
the read:

- flow-field's `walls` and `congestion` are two variations on one idea ("you can
  lie to the grid"). One of them is a better standalone video than a third act.
- every-frame's `timer` beat is 11.6s, the longest in the video, spent on an
  approach the video then rejects.

Three ideas is the ceiling for a short. Four means one of them is a sequel.

### 2. First-frame law: something must *arrive*

> **No video opens on continuously-running footage.**

Abrupt onset — a new object appearing, or motion *starting* — captures attention
involuntarily. Motion that was already running does not. Perceptually,
continuous footage is wallpaper.

This is the clearest split in the data. flow-field's hook is a sequence of
onsets: dots appear, reach-lines arrive one every 0.28s, and a wall slab drops,
kicks the screen and severs the lines at 5.72s. The other three open on gameplay
already in motion with zero onsets.

If beat 1 is footage, something enters, lands or switches on inside the first
second — a badge stamping, a grid snapping over the floor, an element dropping.

A **freeze** is not an onset and reads as playback stalling. The every-frame
code comment was right to cut the freeze and wrong to replace it with nothing.

### 3. Put a physical event on the drop-off cliff

flow-field lands its wall at 5.72s, with a three-pixel screen kick and the
connecting lines snapping. That is a re-capture placed exactly where casual
scrollers bail.

Budget one deliberate event in the 5–8s window of every video. It costs almost
nothing to author and it is the difference between a 30% and a 50% skip rate.

### 4. Never open on a sequel reference

> "**So last time** we built one flow field that every enemy reads."

For a cold audience — ~95% of Reels viewers — this says *you missed something,
this isn't for you*. It cost every-frame a video whose body outperformed
flow-field's.

If a video depends on prior context, **restate it as a fact, not a callback**:
"This grid gets rebuilt sixty times a second" needs no previous episode.

### 5. Open on the number or the absurdity, not the setup

Hooks currently spend 6–8s arriving at the interesting part. flow-field survives
it because its setup *is* a story premise — goal, actor, obstacle, and a
precisely shaped hole (how do two hundred of them get round it?).

Where the setup is not a premise, lead with the concrete figure or the absurd
consequence, and close the beat on a directed instruction to look, which the
next beat pays off:

> This grid gets rebuilt sixty times a second. That's a hundred and forty
> thousand cells, every second, just so a few hundred enemies know where you
> are. Now watch how far the player actually moves in one frame.

> This one health script runs on the enemies and on the player. And right now it
> knows about the camera, the particle system, the object pool, and the enemy
> manager. It's a script that counts down to zero, and it knows about the camera.

### 6. Topics need a foothold *and* behaviour you can point at

Two independent filters. FORMAT.md already states the second one; the first is
new and it caps the audience before a frame plays.

- **Foothold** — can someone who has never opened Unity understand the problem
  statement? "Two hundred enemies, a wall in the way" passes. "When should code
  use pub-sub" does not.
- **Behaviour you can point at** — motion, state over time, a measurable
  before/after.

The descending ladder in the shipped set is exactly the performance ladder:

| topic | foothold | behaviour | result |
|---|---|---|---|
| a named algorithm most gamedevs haven't implemented | wide | yes | 132k |
| an optimisation to that algorithm | narrow — needs the problem already | yes | 4.8k |
| an architecture opinion | none without scar tissue | **no** | 1.9k |

Architecture, naming and code-organisation topics have no motion and no
before/after. second-listener's Fanout diagram is a picture of a *decision*, not
of behaviour, which is why its body retention collapsed too — there was no
payoff coming, because you cannot show someone being right about coupling.

**The 650 followers came for "show me an algorithm I don't know."** That is the
promise now. Spatial partitioning, A*, boids, navmesh generation,
sweep-and-prune, object pooling all pass both filters. Micro-optimisations and
architecture opinions pass neither.

### 7. Stack loops instead of running one

Current structure opens one question at 0s and closes it at ~68s. That is a long
time on a single thread of tension.

Close the first loop around 25–30s and open a second immediately. flow-field
does this semi-accidentally — `walls` ("we can lie to the grid") is a *new*
surprise arriving at ~45s, and it is plausibly why its 12s→60s survival held.

Each act ends on a question, not a conclusion.

### 8. Showcases: make them loop

A showcase has no hook, so the fix is structural. you-vs-ai-3 held an unchanging
composition for 13.8s — by design, per its script.md: "Both panels are present
from frame one. No reveal, no wipe, nothing animating in on its own." Good
composition, no reason to watch second 8 rather than second 3.

Either:

- **Cut to 5–6s and match the last frame to the first.** Reels auto-loop; a
  seamless loop harvests replays and watch time accumulates across them.
- **Or give it one onset** — the AI panel starts black and the field floods in
  at t=2s.

Prefer the short loop and spend the effort on explainers.

### 9. Descriptions and scheduling

- **Hashtags are near-irrelevant.** flow-field's description contained two broken
  tags (`#gamedeve`, and `#unity 3d` — the space kills it) and reached 132k.
  Stop optimising them.
- **Write the description as a person and end on a question.** flow-field's
  opened first-person ("Trying out some educational style content for stuff I'm
  working on") and invited a reply. The later ones are dry topic summaries.
- **One upload per day.** Two videos went out on 26 July, which split the test
  batch and makes you-vs-ai-3's numbers uninterpretable — some unknown share of
  its 3k is profile-visit spillover from flow-field.

---

## What the research actually supports

Separated by how much to trust it. Most writing about hooks is marketing blogs
citing each other.

### Reliable — abrupt onset captures attention

Yantis & Jonides (1984) and Jonides & Yantis (1988): an abruptly appearing new
object captures attention pre-attentively, before any decision is made. They
tested luminance and hue differences as controls and those **did not** capture.
Abrams & Christ (2003) extended it to motion onset — motion *starting* captures,
ongoing motion does not.

The precision is the useful part: the effective stimulus is a **transition**
(nothing→something, still→moving), not the presence of movement.

Caveat: Folk, Remington & Johnston (1992) showed capture is contingent on
attentional control settings — you are captured by what matches what you are
already looking for. On a feed the setting is roughly *is this for me?*, so onset
buys the eye but not the second.

### Reliable — curiosity needs a bounded gap

Loewenstein's information-gap theory (1994): curiosity is not caused by
ignorance but by **awareness of a specific, bounded absence**. General ignorance
produces nothing; partial knowledge revealing a precise hole produces tension
that demands closure. The more precisely the gap is identified, the stronger the
pull.

This makes it an **inverted U** — too small a gap (already known) and too large
(no foothold) both give zero. Related work also finds that gaps which *cannot*
be closed feed frustration rather than curiosity.

Mapped onto the data:

- flow-field sits at the peak — everyone knows what an enemy, a wall and chasing
  are, so the foothold is free and the hole is precise.
- every-frame's "so last time" creates a gap the viewer cannot close, because
  the missing information is a video they did not watch. Frustration side.
- second-listener has no foothold, so there is no gap — there was never any
  knowledge for a hole to be in.

This is the theory behind rule 6.

### Reliable enough — Zeigarnik, open loops

Incomplete tasks are retained better than completed ones. Practically: pose the
question before answering it, and do not close every loop where you opened it.
The psychology is established; the "+32% watch time" figures circulating in
content-marketing posts are not sourced to anything citable.

### Folklore — the platform numbers

Every "3-second retention determines distribution", "50% drop before second
four", "shares > saves > replays" claim traces to marketing blogs citing each
other, not to anything Meta published. Discard the specific percentages.

One structural claim is worth keeping, because it is directionally consistent
across sources *and* consistent with the four measured uploads:

> Distribution is driven by watch-through rate **relative to the video's
> length**, not absolute watch time.

That claim is the entire basis of rule 1. If it is ever falsified, rule 1 goes
with it.

---

## Pre-record checklist

Run against the script, before any animation code exists.

- [ ] Runtime target is 40–50s at 3.1 words/sec. Three ideas, not four.
- [ ] Beat 1 has something **arriving** in the first second. Not a freeze, not
      already-running footage.
- [ ] A physical event lands somewhere in 5–8s.
- [ ] No sentence in beat 1 refers to a previous video.
- [ ] Beat 1 states a goal, an actor and an obstacle — or leads with a concrete
      number or an absurd consequence.
- [ ] The topic has a foothold for someone who has never opened the engine.
- [ ] The topic has behaviour you can point at. Architecture opinions fail here.
- [ ] A second loop opens around 25–30s.
- [ ] Description is first person and ends on a question. Hashtags unchecked.
- [ ] Nothing else ships the same day.

## Post-upload

Record views, skip rate, average watch time and the retention checkpoints into
the table at the top, and compute both derived columns. `% of video` needs the
actual runtime from `beats.generated.ts`, not the target in script.md.

A video that moves `12s→60s` above 60% has a body worth reusing even if the
upload flopped — that is a hook to rewrite, not a topic to abandon.

## Sources

Psychology:

- [Jonides & Yantis — abrupt visual onsets and selective attention](https://pubmed.ncbi.nlm.nih.gov/2137514/)
- [Abrams & Christ — Motion Onset Captures Attention](https://journals.sagepub.com/doi/abs/10.1111/1467-9280.01458)
- [Uniqueness of abrupt visual onset in capturing attention](https://link.springer.com/article/10.3758/BF03208805)
- [Golman & Loewenstein — Curiosity, Information Gaps, and the Utility of Knowledge](https://www.cmu.edu/dietrich/sds/docs/golman/golman_loewenstein_curiosity.pdf)
- [Knowledge Gap Illustrations Spark Curiosity — Journal of Cognition](https://journalofcognition.org/articles/10.5334/joc.501)
- [Information gaps compound curiosity yet also feed frustration](https://www.sciencedirect.com/science/article/abs/pii/S0749597823000523)

Platform claims, treat as folklore:

- [Sprout Social — Instagram algorithm](https://sproutsocial.com/insights/instagram-algorithm/)
- [Hootsuite — Instagram algorithm](https://blog.hootsuite.com/instagram-algorithm/)
