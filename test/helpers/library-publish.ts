import type { LibraryPublishOptions } from "../../src/cli/library-publish";

/** The options of `library publish` as a test gives them: everything off, the fixed program version. */
export const publishOptions = (o: Partial<LibraryPublishOptions> = {}): LibraryPublishOptions => ({
  on: false,
  off: false,
  withBrief: false,
  noBrief: false,
  uiLang: null,
  fonts: null,
  dryRun: false,
  json: false,
  plain: true,
  program: "1.0.0-test",
  ...o,
});
