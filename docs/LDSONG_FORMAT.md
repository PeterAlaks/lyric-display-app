# LyricDisplay Song Format (.ldsong)

A `.ldsong` file is a plain UTF-8 text song whose structure is written out explicitly. LyricDisplay reads it without any guessing: no line splitting, no automatic grouping, and no bracket detection. The same file therefore produces the same slides on every computer, whatever that computer's parsing preferences are.

Plain `.txt`, `.md`, `.rtf`, `.docx`, and `.lrc` files are unaffected and keep using each user's parsing settings.

The reference implementation is [`shared/lyricsParsing/ldsong.js`](../shared/lyricsParsing/ldsong.js), and [`tests/ldsong-format.test.js`](../tests/ldsong-format.test.js) is the conformance suite. Change both together.

## Example

```text
#LDSONG 1
# Title: Amazing Grace
# Author: John Newton, Edwin Excell
# Copyright: Public Domain
# CCLI Song Number: 22025
# Arrangement: Verse 1, Chorus, Verse 2, Chorus

[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

I once was lost but now am found

[Chorus]
My chains are gone
> Mis cadenas se fueron

// Band: hold the last chord

[Verse 2]
'Twas grace that taught my heart to fear
```

## Rules

### First line

The first non-blank line is `#LDSONG <version>`. The current version is `1`. A reader must refuse a version newer than it understands rather than guess. A file without this line is read as version 1 with a warning.

### Header

Lines directly after the first line in the form `# Key: value` are the header. The header ends at the first line that is not a header line.

| Key | Meaning |
| --- | --- |
| `Title` | Song title |
| `Author` | Writers, separated by commas (`Writer`, `Writers`, `Artist`, and `Songwriter` are also read) |
| `Copyright` | Copyright notice |
| `Administrator` | Rights administrator |
| `CCLI Song Number` | CCLI song number (digits only) |
| `Album`, `Year` | Optional details |
| `Arrangement` | Play order: section names separated by commas |

Unknown keys are kept and written back unchanged, so tools can add their own (LyricDisplay importers write, for example, `# Imported from EasyWorship: 2026-10-28`).

### Body

| Line | Meaning |
| --- | --- |
| Blank line | Ends the current slide. Several blank lines are the same as one. |
| `[Name]` (the whole line) | Starts a section. Any name is allowed. |
| `> text` | Translation of the lyric line above it, in the same slide |
| `// text` | Note shown only on the stage display, as its own cue |
| `\text` | Literal lyric text; the backslash is removed. Use it for a lyric that starts with `[`, `>`, `//`, `\`, or `#`. |
| Anything else | A lyric line in the current slide |

Lines before the first section belong to an unnamed section.

### How songs play

- With an `Arrangement`, sections play in that order. Unnamed leading content plays first, and sections left out of the arrangement are not shown.
- Without one, sections play in the order they are written. A section with no lines repeats the earlier section of the same name. `[Chorus 2]` with no lines falls back to `[Chorus]`.
- A slide with one lyric line and one translation is a translation cue. A slide with several lyric lines and no translations is one cue showing all its lines.
- A slide that mixes translations with several lyric lines is shown as one cue per lyric line, with a warning; LyricDisplay's editor never writes such a slide.
- A stage-only line always becomes its own cue.

### Writing

Writers should produce the canonical form, which round-trips exactly:

- The first line, then header lines in the order Title, Author, Copyright, Administrator, CCLI Song Number, Album, Year, Arrangement, then any other keys.
- One blank line before every section (and before the first body line).
- One blank line between slides.
- A single trailing newline.

## Compatibility

- A `.txt` file whose first line is `#LDSONG 1` is also read strictly, so songs survive being renamed or emailed as text.
- LyricDisplay can export a song as plain text for other software: sections are expanded in play order, translations are wrapped in parentheses, and stage notes keep their `//` prefix.
- Section names that are not in a user's section titles are still sections in the file. The LyricDisplay editor warns about them because older versions and the control panel recognize section headings by those titles.
