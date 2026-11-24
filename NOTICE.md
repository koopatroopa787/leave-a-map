# Notices

Leave a Map
Copyright 2026 the Leave a Map authors.
Licensed under the Apache License, Version 2.0 (see LICENSE).

## Third-party packages

| Package | Licence |
|---|---|
| firebase | Apache-2.0 |
| postal-mime | MIT-0 |
| tldts | MIT |
| preact | MIT |
| vite, vitest | MIT |
| typescript | Apache-2.0 |

## Move pack data (T28)

`data/pack.generated.json` is built by `tools/build-pack.ts` from a snapshot taken on 21 Nov 2026. Sources, commits and file hashes are in `data/pack-snapshot.json`. The app uses names, categories, passkey support and account-deletion links. It changes the data: categories are mapped to the app's own, and entries with nothing useful are dropped.

| Source | Licence | Copyright |
|---|---|---|
| [2FA Directory](https://github.com/2factorauth/twofactorauth) (`api.2fa.directory/v3/all.json`) | MIT | Copyright © 2021 2factorauth and Contributors. Copyright (c) 2014-2020 Josh Davis |
| [Passkeys directory](https://github.com/2factorauth/passkeys) (`passkeys-api.2fa.directory/v1/all.json`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2factorauth and Contributors |
| [JustDeleteMe](https://github.com/jdm-contrib/jdm) (`_data/sites.json` at commit `ae5d639ea305`) | MIT | Copyright (c) 2013-2020 Robb Lewis, The JDM Contrib Team, & various contributors |

Both MIT sources are under this licence, with the copyright lines in the table above:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

`data/hand-links.json` is ours. Real links in it were opened and read by a person on the date in `checked`. Entries marked `"example": true` belong to the fictional sample mailbox and their links don't resolve.

## Fonts

The scan site bundles these fonts from [Fontsource](https://fontsource.org). All three are under the [SIL Open Font License 1.1](https://openfontlicense.org).

| Font | Copyright |
|---|---|
| Atkinson Hyperlegible Next | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors |
| Atkinson Hyperlegible Mono | Copyright 2020-2024 The Atkinson Hyperlegible Mono Project Authors |
| Plus Jakarta Sans | Copyright 2020 The Plus Jakarta Sans Project Authors |
