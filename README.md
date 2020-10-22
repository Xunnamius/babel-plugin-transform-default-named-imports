[![Black Lives Matter!](https://api.ergodark.com/badges/blm "Join the movement!")](https://secure.actblue.com/donate/ms_blm_homepage_2019)
[![Maintenance status](https://img.shields.io/maintenance/active/2020 "Is this package maintained?")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)
[![Last commit timestamp](https://img.shields.io/github/last-commit/xunnamius/babel-plugin-transform-mjs-imports/develop "When was the last commit to the official repo?")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)
[![Open issues](https://img.shields.io/github/issues/xunnamius/babel-plugin-transform-mjs-imports "Number of known issues with this package")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)
[![Pull requests](https://img.shields.io/github/issues-pr/xunnamius/babel-plugin-transform-mjs-imports "Number of open pull requests")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)
[![DavidDM dependencies](https://img.shields.io/david/xunnamius/babel-plugin-transform-mjs-imports "Status of this package's dependencies")](https://david-dm.org/xunnamius/babel-plugin-transform-mjs-imports)
[![Source license](https://img.shields.io/npm/l/babel-plugin-transform-mjs-imports "This package's source license")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)
[![NPM version](https://api.ergodark.com/badges/npm-pkg-version/babel-plugin-transform-mjs-imports "Install this package using npm or yarn!")](https://www.npmjs.com/package/babel-plugin-transform-mjs-imports)

# babel-plugin-transform-mjs-imports

This Babel plugin transforms CJS named import declarations (which are allowed in
TypeScript and [modern
Node](https://nodejs.org/api/esm.html#esm_import_statements)) into [default CJS
import declarations with constant destructuring assignments](#motivation) when
emitting `.mjs` files.

The goal of this plugin is to stop Webpack and other bundlers from
[choking](https://github.com/formatjs/formatjs/issues/1395) on `.mjs` files
transpiled from TypeScript (`.ts`) and other sources that contain
technically-invalid CJS named import syntax.

## Installation and Usage

```Bash
npm install --save-dev babel-plugin-transform-mjs-imports webpack-node-module-types
```

And in your `babel.config.js`:

```JavaScript
module.exports = {
    plugins: ['babel-plugin-transform-mjs-imports'],
};
```

And finally, run Babel:

```Bash
babel src --extensions .ts --out-dir dist --out-file-extension .mjs
```

By default, this plugin will transform named imports for Node's built-in
packages (e.g. `http`, `url`, `path`) and any CJS package under `node_modules`
(reported by
[`webpack-node-module-types`](https://www.npmjs.com/package/webpack-node-module-types)).

Hence, the default configuration looks like this:

```JavaScript
const { getModuleTypes } = require('webpack-node-module-types');

module.exports = {
    plugins: [
        ['babel-plugin-transform-mjs-imports', {
            test: [ ...getModuleTypes().cjs ], // ◄ match all CJS modules
            exclude: [], // ◄ never excludes modules by default
            transformBuiltins: true, // ◄ match all built-in modules
            silent: true, // ◄ output results to stdout if silent == false
            verbose: false, // ◄ output more detailed results if silent == false
        }],
    ],
};
```

You can manually specify which import sources are CJS using the `test` and
`exclude` configuration options, which accept an array of strings/RegExp items
to match sources against. If a string begins and ends with a `/` (e.g.
`/^apollo/`), it will be evaluated as a case-insensitive RegExp item. Named
imports with sources that match any item in `test` *and fail to match all items
in `exclude`* will be transformed. You can also skip transforming built-ins by
default (unless they match in `test`) using `transformBuiltins: false`.

For instance, if we want only to transform any imports (bare or deep) of
`apollo-server` and any built-ins like `url` from the above example, my
`babel.config.js` would include:

```JavaScript
module.exports = {
    plugins: [
        ['babel-plugin-transform-mjs-imports', {
            // ▼ regex matches any import that starts with 'apollo-server'
            test: [ /^apollo-server/ ],
        }],
    ],
};
```

> Replacing the `test` array like this also replaces the default list of CJS
> modules from `node_modules`. To append rather than replace, try something like
> `test: [ ...getModuleTypes().cjs, 'another/source/path.js',
> 'something-special' ]`.

Note that we don't have to match for `url` because it's a built-in and
`transformBuiltins` is `true` by default.


## Motivation

As of Node 14, there are at least two "gotcha" rules when writing JavaScript
using `.mjs` files destined to be published in an NPM package:

1. All import sources that are [not
   bare](https://nodejs.org/api/esm.html#esm_import_specifiers) and not found in
   [the package's `imports`/`exports` key][exports-main-key] **must include a
   file extension**. This includes imports on directories e.g. `import { Button}
   from './component/button'`, which should appear in an `.mjs` file as `import
   { Button } from './component/button/index.mjs'`.

2. CJS modules can only be imported using **default import syntax**. As far as
   Webpack 4 and (so far) Webpack 5 is concerned, this includes built-ins too.
   For example, `import { parse } from 'url'` is illegal because `url` is
   considered a CJS module.

Node 14 is lax with the second rule, going so far as to use [static
analysis](https://nodejs.org/api/esm.html#esm_import_statements) to allow CJS
modules to be imported using the "technically illegal" named import syntax.
However, Webpack and other bundlers are much stricter about this and using named
import syntax on a CJS module will cause bundling to fail outright.

For instance, suppose we use Babel to transpile this TypeScript file into the
ESM entry point **`my-package.mjs`** for a [dual
CJS2/ESM](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages)
package:

```TypeScript
/* my-package.ts */

// ▼ #1: an "illegal" named bare CJS import
import { ApolloServer, gql } from 'apollo-server'
// ▼ #2: a legal named deep ESM import
import { Button } from 'ui-library/es'
// ▼ #3: an "illegal" named built-in import
import { parse as parseUrl } from 'url'
// ▼ #4: a legal default bare CJS import and a legal namespace bare CJS import
import lib, * as libNamespace from 'cjs-component-library'
// ▼ #5: a legal default bare CJS import and an "illegal" named bare CJS import
import lib2, { item1, item2 } from 'cjs2-component2-library2'
// ▼ #6: a legal default bare CJS import
import lib3 from 'cjs3-component3-library3'
// ▼ #7: a legal namespace bare CJS import
import * as lib4 from 'cjs4-component4-library4'
// ▼ #8: a legal named relative ESM import using .mjs (.ts is not allowed here!)
import { util } from '../lib/module-utils.mjs'
// ▼ #9: an "illegal" named deep CJS import
import { default as util2, util as smUtil, cliUtil } from 'some-package/dist/utils.js'

// ...
```

The above syntax, which is all legal in Node 14 and TypeScript, will survive
transpilation when emitting `my-package.mjs`. Running this with `node
my-package.mjs` works. Further, if we run this file as an entry point through
Webpack (with babel-loader) and emit CJS bundle file **`my-package.js`**,
running `node my-package.js` also works. Everything works, and `my-package.mjs`
\+ `my-package.js` can be distributed as a dual CJS2/ESM package!

Just one problem: when Webpack and other bundlers attempt to process this as a
tree-shakable ESM package (using our `.mjs` entry point), they'll [choke and
die](https://github.com/formatjs/formatjs/issues/1395) when they encounter the
"illegal" CJS named imports. This usually manifests as strange errors like
`ERROR in ./my-package.mjs Can't import the named export 'ApolloServer' from non
EcmaScript module (only default export is available)` or `ERROR in
./node_modules/my-package/dist/my-package.mjs Can't import the named export
'parse' from non EcmaScript module (only default export is available)`.

`babel-plugin-transform-mjs-imports` remedies this by transforming each named
import of a CJS module into a default CJS import with a constant destructuring
assignment of the named imports:

```JavaScript
/* my-package.mjs (using babel-plugin-transform-mjs-imports) */

// ▼ #1: named CJS import (transformed)
import _$apollo_server from "apollo-server"; // ◄ default import
const { ApolloServer, gql } = _$apollo_server; // ◄ destructuring assignment
// ▼ #2: named ESM import (preserved)
import { Button } from "ui-library/es";
// ▼ #3: named built-in import (transformed)
import _$url from "url"; // ◄ default import
const { parse: parseUrl } = _$url; // ◄ destructuring assignment
// ▼ #4: default and namespace CJS import (preserved)
import lib, * as libNamespace from "cjs-component-library";
// ▼ #5: default CJS import (preserved); named CJS import (transformed)
import lib2 from "cjs2-component2-library2"; // ◄ default import (preserved)
const { item1, item2 } = lib2; // ◄ destructuring assignment
// ▼ #6: default CJS import (preserved)
import lib3 from "cjs3-component3-library3";
// ▼ #7: namespace CJS import (preserved)
import * as lib4 from "cjs4-component4-library4";
// ▼ #8: named ESM import (preserved) (eliminated by Webpack through bundling)
import { util } from "../lib/module-utils.mjs";
// ▼ #9: named CJS import (default alias is preserved, rest is transformed)
import util2 from "some-package/dist/utils.js";// ◄ default import (preserved)
const { util: smUtil, cliUtil } = util2; // ◄ destructuring assignment
```

Now, having `my-package` as a CJS-importing ESM (`.mjs`) dependency of a project
we're bundling is no longer problematic! 🎉🎉🎉

Hence, this transformation is useful for library authors shipping packages with
ESM entry points as it prevents various bundlers from choking on delicious sugar
like named imports of CJS modules in `.mjs` files. It's a solution to a
different symptom of [this problem](https://github.com/babel/babel/issues/7294).

This plugin is similar to (and inspired by)
[babel-plugin-transform-default-import](https://www.npmjs.com/package/babel-plugin-transform-default-import).

## Contributing

**New issues and pull requests are always welcome and greatly appreciated!** If
you submit a pull request, take care to maintain the existing coding style and
add unit tests for any new or changed functionality. Please lint and test your
code, of course!

This package is published using
[publish-please](https://www.npmjs.com/package/publish-please) via `npx
publish-please`.

## Package Details

> You don't need to read this section to use this package, everything should
"just work"!

This is a simple [CJS2](https://github.com/webpack/webpack/issues/1114) package
with a default export.

[`package.json`](package.json) includes the [`exports` and
`main`][exports-main-key] keys, which point to the CJS2 entry point, the
[`type`][local-pkg] key, which is `commonjs`, and the
[`sideEffects`][side-effects-key] key, which is `false` for [optimal tree
shaking][tree-shaking], and the `types` key, which points to a TypeScript
declarations file.

## Release History

See [CHANGELOG.md](CHANGELOG.md).

[side-effects-key]: https://webpack.js.org/guides/tree-shaking/#mark-the-file-as-side-effect-free
[exports-main-key]: https://github.com/nodejs/node/blob/8d8e06a345043bec787e904edc9a2f5c5e9c275f/doc/api/packages.md#package-entry-points
[tree-shaking]: https://webpack.js.org/guides/tree-shaking
[local-pkg]: https://github.com/nodejs/node/blob/8d8e06a345043bec787e904edc9a2f5c5e9c275f/doc/api/packages.md#type
