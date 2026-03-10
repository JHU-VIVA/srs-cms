---
name: minimal-change-first
description: Anti-over-engineering guard for feature design and implementation. This skill should be used when designing solutions, writing implementation plans, or proposing architectural changes. Triggers on brainstorming sessions, design proposals, new feature planning, or any task where the instinct is to create new files, modules, or commands. Forces a systematic check against existing code before building anything new.
---

# Minimal Change First

Guard against over-engineering by requiring deep understanding of existing code before proposing new code.

## When to Use

- Before designing any new feature, module, or command
- During brainstorming when the urge arises to create new files
- When writing implementation plans
- When proposing architectural changes

## The Rule

**Before creating anything new, prove that existing code cannot be modified to achieve the goal.**

## Pre-Design Checklist

Before proposing any architecture, complete these steps in order:

### 1. Trace the Existing Flow End-to-End

Do not just catalog files. Trace the actual execution path for the closest existing feature:

- What command/endpoint triggers it?
- What classes/functions execute in what order?
- What data flows through?
- Where does it succeed? Where does it fail for the new use case?

### 2. Identify the Exact Gap

Write a single sentence: "The existing code fails because ___."

If this sentence mentions more than one root cause, split them and address each independently. If the sentence is vague (e.g., "it doesn't support this"), dig deeper until the gap is specific (e.g., "line 22 of events_importer.py falls back to objects.first() instead of creating the missing record").

### 3. Propose the Minimal Fix

Ask: "What is the smallest change to existing code that closes this gap?"

- Changing 5 lines in an existing file beats creating a new module
- Adding a parameter to an existing function beats creating a new function
- Improving a fallback strategy beats wrapping the entire pipeline

### 4. Only Then Consider New Code

If and only if the existing code genuinely cannot be modified (wrong abstraction, different responsibility, would break existing behavior), propose new code. Even then, prefer:

- A single helper class over a multi-module architecture
- Adding to an existing directory over creating new directories
- One file over three files

## Anti-Patterns to Catch

| Anti-Pattern | What to Do Instead |
|---|---|
| "New management command that wraps existing command" | Improve the existing command |
| "New module that fetches data" when fetching already exists | Reuse existing fetching, fix the processing |
| "Separate cleaner/validator/reconciler classes" for one-time logic | Add the logic inline where it's needed |
| "Integration test for the new pipeline" | The existing tests should cover it if the change is minimal |
| Designing a 5-step architecture diagram | Find the one step that's broken |

## Red Flags During Design

Stop and reconsider if:

- The plan creates more than 2 new files
- The plan has more than 3 tasks for a single behavioral change
- A new class duplicates method signatures from an existing class
- The words "wrapper", "orchestrator", or "pipeline" appear for something that already has a pipeline
- The design requires "fetching" data that existing code already fetches

## When User Pushes Back

If the user questions the approach, treat it as a signal that the design is too complex. Do not defend — re-examine. The user knows their codebase better than a fresh analysis suggests.
