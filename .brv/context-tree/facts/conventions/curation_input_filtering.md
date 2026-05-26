---
title: Curation Input Filtering
summary: Curation should only preserve lasting-value content and skip trivial acknowledgments or one-word replies.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T16:25:55.677Z'
updatedAt: '2026-05-26T16:25:55.677Z'
---
## Reason
Capture the durable instruction to ignore trivial conversation turns during curation

## Raw Concept
**Task:**
Document the curation input filtering rule for conversation cleanup

**Changes:**
- Added instruction to curate only lasting-value content
- Added instruction to skip trivial conversation turns

**Flow:**
receive conversation -> filter trivial turns -> preserve only substantive facts/decisions -> curate

**Timestamp:** 2026-05-26T16:25:37.035Z

## Narrative
### Structure
This note captures the curation filter used to decide whether a conversation turn should be preserved.

### Highlights
The provided input contained only a trivial user continuation, so the lasting-value takeaway is the skip-trivial-content rule itself.

### Rules
Curate only information with lasting value: facts, decisions, technical details, preferences, or notable outcomes.
Skip trivial messages such as greetings, acknowledgments ("ok", "thanks", "sure", "got it"), one-word replies, anything with no substantive content.

## Facts
- **curation_filtering**: Only curate information with lasting value. [convention]
- **curation_filtering**: Skip trivial messages such as greetings, acknowledgments, one-word replies, and any content with no substantive value. [convention]
