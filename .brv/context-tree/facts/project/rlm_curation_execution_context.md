---
title: RLM Curation Execution Context
summary: RLM curation execution context describing single-pass workflow, task variables, and verification expectations for curated inputs.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T22:41:10.094Z'
updatedAt: '2026-05-26T22:41:10.094Z'
---
## Reason
Persist execution guidance and curation context from the provided RLM input

## Raw Concept
**Task:**
Document RLM curation execution instructions for this session

**Changes:**
- Captured single-pass RLM curation requirements
- Recorded task, history, metadata, and task ID variable handling
- Preserved verification expectations for curate results

**Flow:**
receive curated context -> extract facts -> upsert knowledge -> verify applied file paths

**Timestamp:** 2026-05-26T22:41:03.781Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This context defines how to process a compact curation input using the RLM approach with precomputed reconnaissance and single-pass execution.

### Dependencies
Depends on the provided context, history, metadata, and task ID variables, plus tools.curate for persistence.

### Highlights
Suggested mode is single-pass with one chunk; verification should use result.applied[].filePath rather than readFile.

## Facts
- **context_line_1**: The following is a conversation between a user and an AI assistant. [project]
- **context_line_2**: Curate only information with lasting value: facts, decisions, technical details, preferences, or notable outcomes. [project]
- **context_line_3**: Skip trivial messages such as greetings, acknowledgments ("ok", "thanks", "sure", "got it"), one-word replies, anything with no substantive content. [project]
- **context_line_4**: Conversation: [project]
- **context_line_5**: --- [project]
- **context_line_6**: [user]: try using the lsp caplet now that we have these fixes [project]
