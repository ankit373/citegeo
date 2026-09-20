# Prompt demand from an open corpus

How many people actually ask a question like the ones you track. This reads an
openly licensed corpus of real conversations with an assistant. It is not live
volume and the interface never presents it as such.

## What you need

Download one corpus as JSON Lines and point the tool at the file. Neither is
redistributed here.

| Corpus | Dataset | Licence |
| :--- | :--- | :--- |
| WildChat | `allenai/WildChat-1M` | ODC-BY |
| LMSYS-Chat-1M | `lmsys/lmsys-chat-1m` | LMSYS-Chat-1M Dataset License |

Both are published on Hugging Face at `https://huggingface.co/datasets/<dataset>`.
Read the licence before using either commercially. LMSYS requires accepting its
terms before download.

## Building the index

```bash
npm run demand:index -- --source wildchat --path ./wildchat.jsonl
```

Read line by line, so a multi-gigabyte file never has to fit in memory. Only the
opening user turn of each conversation is indexed: later turns are follow-ups to
an answer, not demand. A turn over 300 characters is a pasted document rather
than a question and is skipped, because those would otherwise dominate the
index.

## Reading the numbers

Two counts are reported per prompt and one of them is always the wrong one to
quote on its own.

- **Exact terms.** Corpus questions containing every meaningful word of your
  prompt. The conservative figure.
- **Related terms.** Questions containing most of them. The larger, looser one.

Examples are shown with every count, so a number can be checked against the
questions that produced it rather than taken on trust.

**Uncovered terms** are words the corpus uses often that none of your prompts
contain. That is where a topic set is blind, as opposed to where it is wrong.

## What this is not

Each corpus states its own limits, and they travel with every figure derived
from it.

- It is a **historical sample**, not current demand. Nothing here is live.
- It is a sample of **one population**. People who took free model access in
  exchange for their logs, or who came to compare models side by side, do not
  ask what your buyers ask in the same proportions.
- A share of corpus is a share of **that** corpus. It is not a market share and
  not a search volume.

Zero matches means nobody in that sample asked it, which is not the same as
nobody asking it. An empty corpus reports `null` rather than zero, because zero
over zero is not zero demand.
