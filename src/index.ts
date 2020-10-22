import { PluginObj, PluginPass } from '@babel/core'
import { builtinModules } from 'module'

import * as util from '@babel/types'

export type Options = {
    opts: {
        test?: string[],
        exclude?: string[],
        transformBuiltins?: boolean,
        silent?: boolean,
        verbose?: boolean
    }
};

type State = PluginPass & Options;

const cache: {
    builtins: RegExp[],
    cjsNodeModules: RegExp[],
} = {
    builtins: [],
    cjsNodeModules: [],
};

const _metadata: { [path: string]: {
    total: number,
    transformed: string[],
    iTests: RegExp[],
    eTests: RegExp[],
}} = {};

const stringsToRegexes = (str: string) => {
    return new RegExp(str.startsWith('/') && str.endsWith('/')
        ? str.slice(1, -1)
        // ? https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
        : `^${str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
};

const getDefaultInclusionTests = () => {
    // TODO: webpack-node-module-types
    return cache.cjsNodeModules.length ? cache.cjsNodeModules : ({ cjs: [] as string[] }).cjs.map(stringsToRegexes);
};

const getBuiltinInclusionTests = () => {
    return cache.builtins.length ? cache.builtins : builtinModules.map(stringsToRegexes);
};

/**
 * Return `source` as an alphanumeric string with underscores replacing
 * non-alphanumeric characters
 */
const makeSpecifierFrom = (source: string) => {
    return '_$' + source.split('/').slice(-1)[0].replace(/(\?|#).*$/, '').replace(/[^a-z0-9]/ig, '_');
};

const isCjs = (src: string, state: State) => {
    const { iTests, eTests } = getMetadata(state);
    return iTests.some(r => r.test(src)) && eTests.every(r => !r.test(src));
};

const getMetadata = (state: State) => {
    const key = state.filename || '<no path>';

    return _metadata[key] = _metadata[key] || {
        total: 0,
        transformed: [],
        iTests: [
            ...(state.opts.transformBuiltins !== false ? getBuiltinInclusionTests() : []),
            ...(state.opts.test?.map(stringsToRegexes) || getDefaultInclusionTests())
        ],
        eTests: state.opts.exclude?.map(stringsToRegexes) || []
    };
};

export default function(): PluginObj<State> {
    return {
        name: 'babel-plugin-transform-mjs-imports',
        visitor: {
            Program: {
                enter(_, state) {
                    // ? Create it if it doesn't exist already, or do it later
                    getMetadata(state);
                },
                exit(_, state) {
                    if(state.opts.silent === false) {
                        // eslint-disable-next-line no-console
                        const { total, transformed } = getMetadata(state);
                        const details = state.opts.verbose ? ` [${transformed.join(', ')}]` : '';

                        if(state.opts.verbose || transformed.length)
                            console.log(`target: ${state.filename}\nimports transformed: /${total}${details}\n---`);
                    }
                }
            },
            ImportDeclaration(path, state) {
                const source = path.node.source.value;

                getMetadata(state).total++;

                if(!isCjs(source, state))
                    return;

                const specifiers = {
                    explicitDefault: '',
                    implicitDefault: '',
                    namespace: '',
                    named: [] as { actual: string, alias: string | null }[]
                };

                path.node.specifiers.forEach(node => {
                    if(util.isImportSpecifier(node)) {
                        if(node.imported.name == 'default')
                            specifiers.implicitDefault = node.local.name;

                        if(node.imported.name != 'default' || specifiers.explicitDefault) {
                            specifiers.named.push({
                                actual: node.imported.name,
                                alias: node.imported.name != node.local.name ? node.local.name : null
                            });
                        }
                    }

                    else if(util.isImportDefaultSpecifier(node))
                        specifiers.explicitDefault = node.local.name;

                    else if(util.isImportNamespaceSpecifier(node))
                        specifiers.namespace = node.local.name;
                });

                if(!specifiers.named.length)
                    return;

                const newDefaultSpecifier = util.identifier(specifiers.explicitDefault
                    || specifiers.implicitDefault
                    || makeSpecifierFrom(source));

                // ? Transform the import into a default CJS import
                path.node.specifiers = [ util.importDefaultSpecifier(newDefaultSpecifier) ];

                // ? Insert a constant destructing assignment after

                const declaration = util.variableDeclaration('const', [
                    util.variableDeclarator(
                        util.objectPattern(specifiers.named.map(s =>
                            util.objectProperty(
                                util.identifier(s.actual),
                                util.identifier(s.alias ?? s.actual),
                                false,
                                !s.alias
                            )
                        )),
                        newDefaultSpecifier
                    )
                ]);

                path.insertAfter(declaration);

                getMetadata(state).transformed.push(source);
            }
        }
    };
}
