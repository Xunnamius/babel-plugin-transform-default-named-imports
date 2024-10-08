import { builtinModules } from 'node:module';
import { determineModuleTypes } from 'webpack-node-module-types/sync';
import * as util from '@babel/types';

import type { PluginObj, PluginPass } from '@babel/core';

export type Options = {
  opts: {
    test?: (string | RegExp)[];
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    transformBuiltins?: boolean;
    silent?: boolean;
    verbose?: boolean;
    monorepo?: boolean | string;
  };
};

type State = PluginPass & Options;

const cache: {
  builtins: RegExp[];
  cjsNodeModules: RegExp[];
} = {
  builtins: [],
  cjsNodeModules: []
};

const _metadata: {
  [path: string]: {
    total: number;
    transformed: string[];
    iTests: RegExp[];
    eTests: RegExp[];
  };
} = {};

const stringToRegex = (str: string | RegExp, openEnded: boolean) => {
  return str instanceof RegExp
    ? str
    : new RegExp(
        str.startsWith('/') && str.endsWith('/')
          ? str.slice(1, -1)
          : // ? https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
            // eslint-disable-next-line unicorn/better-regex
            `^${str.replaceAll(/[.*+\-?^${}()|[\]\\]/g, '\\$&')}${
              openEnded ? '([/?#].+)?' : ''
            }$`,
        'i'
      );
};

const strToRegex = (str: string | RegExp) => stringToRegex(str, false);
const strToOpenEndedRegex = (str: string | RegExp) => stringToRegex(str, true);

const getDefaultInclusionTests = (monorepo: boolean | string) => {
  return (cache.cjsNodeModules = cache.cjsNodeModules.length
    ? cache.cjsNodeModules
    : [
        ...determineModuleTypes({
          rootMode:
            typeof monorepo === 'string' ? monorepo : monorepo ? 'upward' : 'local'
        }).cjs.map((id) => strToOpenEndedRegex(id)),
        /^(\.(\.)?\/)+(.+)\.json$/
      ]);
};

const getBuiltinInclusionTests = () => {
  return (cache.builtins = cache.builtins.length
    ? cache.builtins
    : builtinModules.map((id) => strToOpenEndedRegex(id)));
};

const isCjs = (src: string, state: State) => {
  const { iTests, eTests } = getMetadata(state);
  return iTests.some((r) => r.test(src)) && eTests.every((r) => !r.test(src));
};

const getMetadata = (state: State) => {
  const key = state.filename || '<no path>';

  return (_metadata[key] = _metadata[key] || {
    total: 0,
    transformed: [],
    iTests: [
      ...(state.opts.transformBuiltins !== false ? getBuiltinInclusionTests() : []),
      ...(state.opts.test?.map(strToRegex) ||
        getDefaultInclusionTests(state.opts.monorepo ?? false)),
      ...(state.opts.include?.map(strToRegex) || [])
    ],
    eTests: state.opts.exclude?.map(strToRegex) || []
  });
};

export default function (): PluginObj<State> {
  return {
    name: 'transform-default-named-imports',
    visitor: {
      Program: {
        enter(_, state) {
          // ? Create it if it doesn't exist already, or do it later
          getMetadata(state);
        },
        exit(_, state) {
          if (state.opts.silent === false) {
            const { total, transformed } = getMetadata(state);

            const details =
              `${transformed.length}/${total}` +
              (state.opts.verbose && transformed.length
                ? ` [${transformed.join(', ')}]`
                : '');

            if (state.opts.verbose || transformed.length)
              // eslint-disable-next-line no-console
              console.log(
                `target: ${state.filename}\nimports transformed: ${details}\n---`
              );
          }
        }
      },
      ImportDeclaration(path, state) {
        const source = path.node.source.value;

        getMetadata(state).total++;

        if (!isCjs(source, state)) return;

        const specifiers = {
          explicitDefault: '',
          implicitDefault: '',
          namespace: '',
          named: [] as { actual: string; alias: string | null }[]
        };

        path.node.specifiers.forEach((node) => {
          if (util.isImportSpecifier(node)) {
            const name = util.isStringLiteral(node.imported)
              ? node.imported.value
              : node.imported.name;

            if (name === 'default') specifiers.implicitDefault = node.local.name;

            if (name != 'default' || specifiers.explicitDefault) {
              specifiers.named.push({
                actual: name,
                alias: name != node.local.name ? node.local.name : null
              });
            }
          } else if (util.isImportDefaultSpecifier(node))
            specifiers.explicitDefault = node.local.name;
          else if (util.isImportNamespaceSpecifier(node))
            specifiers.namespace = node.local.name;
        });

        if (!specifiers.named.length) return;

        // eslint-disable-next-line unicorn/no-keyword-prefix
        const newDefaultSpecifier = util.identifier(
          specifiers.explicitDefault ||
            specifiers.implicitDefault ||
            path.scope.generateUid(source)
        );

        // ? Transform the import into a default CJS import
        path.node.specifiers = [util.importDefaultSpecifier(newDefaultSpecifier)];

        // ? Insert a constant destructing assignment after

        const declaration = util.variableDeclaration('const', [
          util.variableDeclarator(
            util.objectPattern(
              specifiers.named.map((s) =>
                util.objectProperty(
                  util.identifier(s.actual),
                  util.identifier(s.alias ?? s.actual),
                  false,
                  !s.alias
                )
              )
            ),
            newDefaultSpecifier
          )
        ]);

        path.insertAfter(declaration);

        getMetadata(state).transformed.push(source);
      }
    }
  };
}
