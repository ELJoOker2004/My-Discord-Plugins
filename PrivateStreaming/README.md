# PrivateStreaming

PrivateStreaming excludes Discord windows from supported Windows captures and provides configurable content masking as a fallback. The root [README](../README.md#privatestreaming) covers settings, shortcuts, and installation.

## Implementation

- `index.tsx` defines settings, reads Discord's sharing and Streamer Mode stores, and controls activation. Native results are checked before clearing local masking. Failed, stale, or timed-out native checks retain the configured masking.
- `surfaces.tsx` patches React's JSX and element factories to insert components around selected host elements. It retains the original HTML element, props, refs, and handlers. CSS modules are resolved with Equicord's `byClassNames` filter and `mapMangledCssClasses`, including modules loaded later. Portal contents receive a fresh privacy scope.
- `privacy.tsx` owns masking and reveal state through Equicord's existing Zustand API. Nested targets use one filter. Content changes revoke reveals, and effects and event listeners are cleaned up. The title hook supplies a generic title to Discord's existing title effect and restores the original title when masking ends.
- `native.ts` applies Electron content protection to main and popout windows, restores their previous settings, and verifies Windows display affinity `0x11`. Renderer arguments are validated. Verification uses a fixed PowerShell executable and an argument array with a timeout and output limit.
- `keybind.ts`, `targets.ts`, and `style.css` define shortcuts, blur options, and the plugin's prefixed mask classes.

The renderer does not query or mutate the DOM. There are no new dependencies, network services, API keys, automated Discord actions, or changes to voice state.

## Validation

Checked on 2026-10-08 against Equicord dev commit `bde62725fd3dbf685eac53a307491ef4ba31e7a1`:

| Check | Result |
| --- | --- |
| TypeScript, plugin ESLint, and stylesheet lint | Passed |
| Patch lint | No errors; 189 existing repository warnings |
| Desktop, Equibop, and web builds | Passed |
| React masking and activation checks | 46 passed |
| Surface and actual Discord factory checks | 54 passed |
| Controller, shortcuts, native failures, and timeout checks | 17 passed |
| Real Electron windows and Windows capture-affinity checks | 13 passed |
| Fresh Discord web startup, enabled and disabled | Passed |

The surface tests use actual Discord React factories and 809 public CSS modules. Missing classes for lazy views use isolated fixtures. Activity stores and native responses are mocked in the React tests; Windows protection is tested separately with real offscreen Electron windows. The opaque-mode check compares real rendered screenshots. These checks do not establish coverage of every logged-in Discord view or capture tool.

The JSX conversion was checked on 2026-10-16 against PR head `95484038d452857d483eda4573cc5704f66561de`. Full TypeScript checking, plugin ESLint, stylesheet lint, patch lint, and desktop, Equibop, and web builds passed. All 54 before-and-after browser checks passed using React 19.1.0 and Equicord's JSX factory. They cover HTML and SVG masks, props, refs, original event handlers, hover reveal, content replacement, titles, settings, and portal scope. Equicord stores and UI components use isolated fixtures in these checks. Native code and patch definitions are unchanged; this run did not repeat a logged-in Discord or live capture test.

Before relying on masking during a real share, test a logged-in session with your capture tool: start and stop sharing, open a popout, change individual blur options, edit or receive a message while peeking, and verify that the visible title and native hover titles restore correctly. A full Discord restart is needed after a native helper update.

## Equicord submission

The raw DOM manipulation and hardcoded Discord class selectors from the previous implementation have been replaced. The native capture feature provides behavior beyond hiding or restyling UI. Maintainers still need to decide whether the combined feature and shared React factory patches are suitable for inclusion.

The contributor reviewed and live-tested the implementation. [PR #1403](https://github.com/Equicord/Equicord/pull/1403) is open. The reviewer requested JSX instead of direct `React.createElement` calls; that update is implemented and tested locally. Equicord's [contribution guide](https://github.com/Equicord/Equicord/blob/main/CONTRIBUTING.md) asks contributors to obtain feedback through its [plugin-request tracker](https://discord.com/channels/1173279886065029291/1419347113745059961). It also requires understanding of the code and disclosure of AI assistance. Codex assisted with the rewrite, documentation, rule audit, and test harnesses. The published PR description still needs an accurate AI disclosure and correction of its AI-authorship checkbox.
