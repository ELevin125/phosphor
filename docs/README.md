# Phosphor docs

Four documents. If you are an agent picking this project up cold, read them in
this order — between them they should answer "what is this, how is it built,
why is it built that way, and what is happening right now" without you needing
to read the source first.

| doc | answers | changes |
|---|---|---|
| [FORMAT.md](FORMAT.md) | What a Phosphor video *is*. Editorial doctrine, video types, the rules a video must satisfy. | rarely |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system is built. Layers, pipeline, data flow, where things live. | with the code |
| [DECISIONS.md](DECISIONS.md) | Why it is built that way. Append-only log with the reasoning and what each decision cost. | append-only |
| [STATUS.md](STATUS.md) | Where we are. What is done, what is in flight, what is next, what is known-broken. | constantly |

The split matters: `FORMAT` is the product, `ARCHITECTURE` is the machine,
`DECISIONS` is the memory, `STATUS` is the present tense. When something changes,
it usually belongs in exactly one of them.

## Maintaining these

**`DECISIONS.md` is append-only.** A decision that gets reversed gets a new
entry that supersedes the old one; the old one stays, because the reasoning that
turned out to be wrong is the most useful part of the record.

**`STATUS.md` is rewritten freely.** It has no historical value. If it disagrees
with reality, reality wins and the doc is wrong.

**Do not put implementation detail in `FORMAT.md`.** If a rule is there because
of how the code works today, it belongs in `ARCHITECTURE.md`.

**Update these in the same change as the code.** A doc that lags the source by
two sessions is worse than no doc, because it is trusted and wrong.
