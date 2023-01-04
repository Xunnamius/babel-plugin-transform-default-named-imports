[![Black Lives Matter!](https://xunn.at/badge-blm 'Join the movement!')](https://xunn.at/donate-blm)
[![Maintenance status](https://img.shields.io/maintenance/active/2023 'Is this package maintained?')](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)
[![Last commit timestamp](https://img.shields.io/github/last-commit/xunnamius/babel-plugin-transform-default-named-imports 'When was the last commit to the official repo?')](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)
[![Open issues](https://img.shields.io/github/issues/xunnamius/babel-plugin-transform-default-named-imports 'Number of known issues with this package')](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)
[![Pull requests](https://img.shields.io/github/issues-pr/xunnamius/babel-plugin-transform-default-named-imports 'Number of open pull requests')](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)
[![Source license](https://img.shields.io/npm/l/babel-plugin-transform-default-named-imports "This package's source license")](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)
[![NPM version](https://api.ergodark.com/badges/npm-pkg-version/babel-plugin-transform-default-named-imports 'Install this package using npm or yarn!')](https://www.npmjs.com/package/babel-plugin-transform-default-named-imports)

# babel-plugin-transform-default-named-imports

Patterns like the following are commonplace throughout the JavaScript ecosystem:

```typescript
// file: src/index.js
const { name: pkgName } = require('../package.json');
```

With TypeScript and more modern JavaScript, we'd achieve the same with the
following:

```typescript
// file: src/index.ts
import { name as pkgName } from '../package.json';
```

However, running this through Webpack will trigger warnings like
`WARNING in ./src/index.ts 6:30-37 Should not import the named export 'name' (imported as 'pkgName') default-exporting module (only default export is available soon)`.

This simple Babel plugin makes these warnings and errors go away by transforming
named import declarations of CJS and JSON modules into
[default import declarations with constant destructuring assignments](#motivation).
The goal is to make that delicious `const { ... } = require(...)` sugar
_forward-compatible_ by allowing imports of named CJS exports to remain
consistent across CJS and ESM source, and to prevent some versions of Webpack,
Node, browsers, et cetera from
[choking](https://github.com/formatjs/formatjs/issues/1395) when encountering
it.

## Installation

```Bash
npm install --save-dev babel-plugin-transform-default-named-imports
```

And in your `babel.config.js`:

```typescript
module.exports = {
  plugins: ['transform-default-named-imports']
};
```

> Keep in mind
> [plugin order matters with Babel](https://babeljs.io/docs/en/plugins#plugin-ordering)!

And finally, run Babel through your toolchain (Webpack, Jest, etc) or manually.
For example:

```Bash
npx babel src --out-dir dist
```

## Usage

By default, this plugin will transform named imports for Node's built-in
packages (e.g. `http`, `url`, `path`), for sources that end in `.json`, and for
any CJS package under `node_modules` (determined by
[`webpack-node-module-types`](https://www.npmjs.com/package/webpack-node-module-types)).
**All other imports, including local imports, are left untouched.**

### Importing JSON Modules

As of `webpack@5.18`, Webpack does not properly tree-shake constant
destructuring assignments of JSON imports without a little help. Until Webpack's
handling of JSON modules stabilizes,
[externalize all JSON imports as commonjs](https://webpack.js.org/configuration/externals):

```typescript
// file: webpack.config.js
module.exports = {
...
  externals: [
    ...
    ({ request }, cb) =>
      // ? Externalize all .json imports (required as commonjs modules)
      /\.json$/.test(request) ? cb(null, `commonjs ${request}`) : cb()
  ]
};
```

If you do not externalize your JSON imports, you risk bloating your bundle size!

### Custom Configuration

Out of the box with zero configuration, the default settings this plugin uses
look something like the following:

```typescript
const { determineModuleTypes } = require('webpack-node-module-types/sync');

module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        test: [
          // ▼ match all CJS modules, even deep imports: require('pkg/d/e/e/p')
          ...determineModuleTypes().cjs.map(strToOpenEndedRegex),
          // ▼ match JSON modules, including relative imports
          /^(\.(\.)?\/)+(.+)\.json$/
        ],
        include: [], // ◄ these module names are appended to the `test` array
        exclude: [], // ◄ never excludes modules by default
        transformBuiltins: true, // ◄ match all built-in modules
        silent: true, // ◄ output results to stdout if silent == false
        verbose: false, // ◄ output detailed results if silent == false
        monorepo: false // ◄ enable this plugin to work in a monorepo context
      }
    ]
  ]
};
```

You can manually specify which import sources are CJS using the `test` and
`exclude` configuration options, which accept an array of strings/RegExp items
to match sources against. If a string begins and ends with a `/` (e.g.
`/^apollo/`), it will be evaluated as a case-insensitive RegExp item. Named
imports with sources that match any item in `test` _and fail to match all items
in `exclude`_ will be transformed. You can also skip transforming built-ins by
default (unless they match in `test`) using `transformBuiltins: false`.

For instance, to _exclusively_ transform any imports (bare or deep) of
`apollo-server` and any built-ins like `url` from the above example,
`babel.config.js` would include:

```typescript
module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        // ▼ regex matches any import that starts with 'apollo-server'
        test: [/^apollo-server/]
      }
    ]
  ]
};
```

Replacing the `test` array like this also replaces the default list of CJS
modules from `node_modules`. To append rather than replace, you can do something
like:

```Bash
npm install --save-dev webpack-node-module-types
```

```typescript
const { determineModuleTypes } = require('webpack-node-module-types/sync');

module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        // ▼ extend, rather than override, the default settings
        test: [
          // ▼ prevent `next` and any deep import like `next/dist/next-server`
          // ▼ from being misclassified as CJS
          ...determineModuleTypes().cjs.filter(
            (p) => !/^next([/?#].+)?/.test(p)
          ),
          // ▼ add CJS package `something-special` misclassified as ESM
          'something-special'
        ]
      }
    ]
  ]
};
```

#### Monorepo Support

If you're running this babel plugin within a monorepo, consider using the
`monorepo` option. This enables either the
[_upward_](https://github.com/Xunnamius/webpack-node-module-types#monorepo-support)
or
[_relative_](https://github.com/Xunnamius/webpack-node-module-types#monorepo-support)
root mode functionality of the underlying `webpack-node-module-types` package.

When `monorepo` is set to `true`, upward root mode is used. This looks for the
closest `node_modules` directory within any ancestor directory and throws if it
doesn't exist; errors are prevented when a "local" `node_modules` is not found
in the current working directory.

Example:

```typescript
module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        // ▼ enable monorepo support when cwd() === sub-dir within monorepo
        monorepo: true
      }
    ]
  ]
};
```

Inversely, when `monorepo` is set to a relative path string, relative root mode
is used. This looks for a `node_modules` directory at said path, but no error is
thrown if it does not exist. Instead, the current working directory must contain
a "local" `node_modules` directory or an error will be thrown.

Example:

```typescript
module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        // ▼ enable monorepo support when cwd() === monorepo root
        monorepo: './packages/pkg-1/node_modules'
      }
    ]
  ]
};
```

> The leading dot (`./` or `../`) in the relative path version is **required**!

### Troubleshooting

Firstly, this package uses the [`debug`](https://www.npmjs.com/package/debug)
package under the hood, so running babel with the `DEBUG='*:*'` environment
variable set will yield all sorts of useful information to your CLI.

#### _Excluding_ Misclassified Packages

If all you want to do is ignore a misclassified module like `next` in the
previous section, it's easier to just _exclude_ it:

```typescript
module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        exclude: [/^next([/?#].+)?/]
      }
    ]
  ]
};
```

This is useful when
[`webpack-node-module-types`](https://www.npmjs.com/package/webpack-node-module-types)
misclassifies a package or you want to more easily override the defaults.

A clue that a package is being misclassified is when you encounter errors like
`TypeError: Cannot destructure property 'X' of '_X.default' as it is undefined.`
For example, in the case of the following deep `next` import:

```typescript
import { apiResolver } from 'next/dist/next-server/server/api-utils.js';
```

Without adding the `exclude` configuration key above, Webpack `5.20` reports the
following error:
`TypeError: Cannot destructure property 'apiResolver' of '_apiUtils.default' as it is undefined.`
After adding the `exclude` key, this error disappears.

#### _Including_ Special Packages

Similar to `exclude`, you can use `include` to append a module name or regex to
the final list of CJS modules rather than adding `webpack-node-module-types` as
a dependency and necessarily overwriting the entire `test` array.

This:

```typescript
module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        include: ['package']
      }
    ]
  ]
};
```

Instead of this:

```typescript
const { determineModuleTypes } = require('webpack-node-module-types/sync');

module.exports = {
  plugins: [
    [
      'transform-default-named-imports',
      {
        test: [...determineModuleTypes().cjs, 'package']
      }
    ]
  ]
};
```

This is especially useful when using the `monorepo` option, which passes custom
configuration to `determineModuleTypes(...)` that shouldn't be overwritten.

## Motivation

As of Node 14, there are at least two "gotcha" rules when writing ESM modules
(files that end in `.mjs`):

1. All import sources that are
   [not bare](https://nodejs.org/api/esm.html#esm_import_specifiers) and not
   found in [the package's `imports`/`exports` key][exports-main-key] **must
   include a file extension**. This includes imports on directories e.g.
   `import { Button} from './component/button'`, which should appear in an
   `.mjs` file as `import { Button } from './component/button/index.mjs'`.

2. CJS modules can only be imported using **default import syntax**. As far as
   Webpack is concerned, this includes built-ins too. For example,
   `import { parse } from 'url'` is illegal because `url` is considered a CJS
   module.

Node 14 is lax with the second rule, going so far as to use
[static analysis](https://nodejs.org/api/esm.html#esm_import_statements) to
allow CJS modules to be imported using the "technically illegal" named import
syntax. However, Webpack and other bundlers are much stricter about this and
using named import syntax on a CJS module can cause bundling to fail outright.

For instance, suppose one uses Babel to transpile this TypeScript file into the
ESM entry point **`my-package.mjs`** for a
[dual CJS2/ESM](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages)
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
transpilation when emitting `my-package.mjs`. Running this with
`node my-package.mjs` works. Further, after running this file as an entry point
through Webpack (with babel-loader) and emitting CJS bundle file
**`my-package.js`**, running `node my-package.js` also works. Everything works,
and `my-package.mjs` \+ `my-package.js` can be distributed as a dual CJS2/ESM
package!

Problem: when Webpack attempts to process this as a tree-shakable ESM package
(using our `.mjs` entry point), at worst it'll
[choke and die](https://github.com/formatjs/formatjs/issues/1395) encountering
the "illegal" CJS named imports. This manifests as strange errors like
`ERROR in ./my-package.mjs Can't import the named export 'ApolloServer' from non EcmaScript module (only default export is available)`
or
`ERROR in ./node_modules/my-package/dist/my-package.mjs Can't import the named export 'parse' from non EcmaScript module (only default export is available)`.
In more recent versions of Webpack, this can lead to similar warnings when
transpiling TypeScript source.

`babel-plugin-transform-default-named-imports` remedies this and similar issues
by transforming each named import of a CJS module into a default CJS import with
a constant destructuring assignment of the named imports:

```typescript
/* my-package.mjs (using babel-plugin-transform-default-named-imports) */

// ▼ #1: named CJS import (transformed)
import _apolloServer from 'apollo-server'; // ◄ default import
const { ApolloServer, gql } = _apolloServer; // ◄ destructuring assignment
// ▼ #2: named ESM import (preserved)
import { Button } from 'ui-library/es';
// ▼ #3: named built-in import (transformed)
import _url from 'url'; // ◄ default import
const { parse: parseUrl } = _url; // ◄ destructuring assignment
// ▼ #4: default and namespace CJS import (preserved)
import lib, * as libNamespace from 'cjs-component-library';
// ▼ #5: default CJS import (preserved); named CJS import (transformed)
import lib2 from 'cjs2-component2-library2'; // ◄ default import (preserved)
const { item1, item2 } = lib2; // ◄ destructuring assignment
// ▼ #6: default CJS import (preserved)
import lib3 from 'cjs3-component3-library3';
// ▼ #7: namespace CJS import (preserved)
import * as lib4 from 'cjs4-component4-library4';
// ▼ #8: named ESM import (preserved) (eliminated by Webpack through bundling)
import { util } from '../lib/module-utils.mjs';
// ▼ #9: named CJS import (default alias is preserved, rest is transformed)
import util2 from 'some-package/dist/utils.js'; // ◄ default import (preserved)
const { util: smUtil, cliUtil } = util2; // ◄ destructuring assignment
```

Now, having `my-package` import CJS modules as if they were ESM causes no
warnings or errors! 🎉

Hence, this transformation is mainly useful for library authors shipping
packages with ESM entry points as it prevents various bundlers from choking on
delicious sugar like named imports of CJS modules. It's a solution to a
different symptom of [this problem](https://github.com/babel/babel/issues/7294).

This plugin is somewhat similar to
[babel-plugin-transform-default-import](https://www.npmjs.com/package/babel-plugin-transform-default-import)
and
[babel-plugin-transform-named-imports](https://github.com/SectorLabs/babel-plugin-transform-named-imports).
You could say this plugin is the functional intersection of the aforementioned.

## Contributing

**New issues and pull requests are always welcome and greatly appreciated!** If
you submit a pull request, take care to maintain the existing coding style and
add unit tests for any new or changed functionality. Please lint and test your
code, of course!

[side-effects-key]:
  https://webpack.js.org/guides/tree-shaking/#mark-the-file-as-side-effect-free
[exports-main-key]:
  https://github.com/nodejs/node/blob/8d8e06a345043bec787e904edc9a2f5c5e9c275f/doc/api/packages.md#package-entry-points
[tree-shaking]: https://webpack.js.org/guides/tree-shaking
[local-pkg]:
  https://github.com/nodejs/node/blob/8d8e06a345043bec787e904edc9a2f5c5e9c275f/doc/api/packages.md#type
