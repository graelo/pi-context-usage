# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-01

### Added

- `/context` command: Claude Code-style context usage grid, per-category legend, and MCP tools, memory files and skills sections
- `/context all` to list every tool (costliest first), MCP tool, memory file and skill with its token count
- `/context all` also lists the system prompt's sections by name, with the category each is counted in
- Optional `tokenizer` command for token counts, with a fallback to chars/4
- `categories` config: relabel and recolor categories (theme color names, 256-color indexes, or color strings), move prompt sections between them, and add new ones
- "Unattributed" line: the gap between pi's measured total and the estimates
