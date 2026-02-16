# Local Development: License Setup

These rules are intended for Codex (CLI and app).

Ensure proper license configuration (LICENSE file, package.json, README reference). Default: MIT. Overridable in AGENTS.md or CLAUDE.md.

---

# License Setup for Projects

When setting up or working on projects, ensure proper license configuration for legal clarity and reuse.

## Default Behavior

**If no license is specified**, use the **MIT License**. Projects can override this in `AGENTS.md` or `CLAUDE.md` (see Configuration below).

## Your Responsibilities

1. **Create or update `LICENSE`**

   - If the project has no `LICENSE` file, create one.
   - Use the license specified in project docs (`AGENTS.md`, `CLAUDE.md`) if present; otherwise use MIT.
   - For MIT, include the standard MIT License text with the current year and copyright holder (e.g. from `package.json` author or a placeholder).

2. **Update `package.json`**

   - Ensure the `license` field is set (e.g. `"license": "MIT"`).
   - If `package.json` exists but has no `license` field, add it.
   - Use [SPDX identifiers](https://spdx.org/licenses/) (e.g. `MIT`, `Apache-2.0`, `ISC`).

3. **Reference LICENSE in README**
   - Add a "License" section at the end of `README.md` that references the `LICENSE` file.
   - Example: `MIT License - see [LICENSE](LICENSE) file for details.`

## MIT License Template

```
MIT License

Copyright (c) <YEAR> <COPYRIGHT HOLDER>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Replace `<YEAR>` with the current year and `<COPYRIGHT HOLDER>` with the author/org (e.g. from `package.json` author).

## Example README Addition

```markdown
## License

MIT License - see [LICENSE](LICENSE) file for details.
```

## Example package.json Addition

```json
{
  "license": "MIT"
}
```

## Configuration: Override Default License

Projects may specify a non-MIT license in `AGENTS.md` or `CLAUDE.md`:

```markdown
## License

Default license for this project: Apache-2.0 (or ISC, BSD-3-Clause, etc.)
```

When such a section exists, use the specified license instead of MIT. If both files define a license, prefer `AGENTS.md` (it is agent-facing and typically more authoritative for automation).

## Implementation Order

1. Check `AGENTS.md` and `CLAUDE.md` for a license override.
2. If none, use MIT.
3. Check if `LICENSE` exists; if not, create it with the chosen license text.
4. Check `package.json` for the `license` field; add or update if missing.
5. Check `README.md` for a License section at the end; add one if missing, referencing `[LICENSE](LICENSE)`.

## When to Apply

- When creating a new project.
- When a project lacks a `LICENSE` file.
- When `package.json` has no `license` field.
- When `README.md` does not reference the LICENSE file at the end.
