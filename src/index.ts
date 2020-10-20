import { PluginObj } from '@babel/core'
import { BabelType } from 'babel-plugin-tester'

const outputJson: Record<string, unknown>[] = [];

export default function({ types: t }: BabelType): PluginObj {
    void t;
    let cancel = () => { /* noop */};

    return {
        name: 'babel-plugin-transform-mjs-imports',
        visitor: {
            Program: {
                enter(path, state) {
                    cancel();
                    outputJson.push({ _name: "ENTER-PATH", ...path });
                    outputJson.push({ _name: "ENTER-STATE", ...state });
                },
                exit(path, state) {
                    outputJson.push({ _name: "EXIT-PATH", ...path });
                    outputJson.push({ _name: "EXIT-STATE", ...state });

                    // eslint-disable-next-line no-console
                    cancel = (id => () => clearTimeout(id))(setTimeout(() => console.log(outputJson), 100));
                }
            }
        }
    };
}
