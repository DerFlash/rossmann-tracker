# Third-Party Notices

The license in [`LICENSE.md`](LICENSE.md) applies to all code, documentation, data, catalog content, assets, and other materials authored for the Rossmann Store Tracker. Third-party software and materials remain under their respective license terms.

The current application and container build directly use or include, among other components:

- **Microsoft Playwright for Node.js**, licensed under the Apache License 2.0: <https://github.com/microsoft/playwright/blob/main/LICENSE>
- **Node.js**, licensed under the Node.js project license and third-party notices: <https://github.com/nodejs/node/blob/main/LICENSE>
- **Chromium and its bundled third-party components**, under the licenses distributed with Chromium: <https://chromium.googlesource.com/chromium/src/+/main/LICENSE>
- **Ubuntu packages** from the pinned Microsoft Playwright base image, under their respective package licenses.

Installed npm packages retain their license files inside `node_modules`; operating-system and browser components retain the notices supplied by their distributors. This overview is not a replacement for those license texts.

Before the first public container release, the final dependency and container contents must be audited again and the release should include an SBOM or equivalent machine-readable inventory.
