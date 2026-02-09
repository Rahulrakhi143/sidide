// @ts-ignore
import prettier from 'prettier/standalone';
// @ts-ignore
import babelParser from 'prettier/plugins/babel';
// @ts-ignore
import estreeParser from 'prettier/plugins/estree';
// @ts-ignore
import htmlParser from 'prettier/plugins/html';
// @ts-ignore
import postcssParser from 'prettier/plugins/postcss';
// @ts-ignore
import typescriptParser from 'prettier/plugins/typescript';
// @ts-ignore
import markdownParser from 'prettier/plugins/markdown';

export const formatCode = async (code: string, filename: string): Promise<string> => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let parser = '';
    let plugins = [babelParser, estreeParser];

    switch (ext) {
        case 'js':
        case 'jsx':
            parser = 'babel';
            break;
        case 'ts':
        case 'tsx':
            parser = 'typescript';
            plugins = [typescriptParser, estreeParser];
            break;
        case 'json':
            parser = 'json';
            break;
        case 'html':
            parser = 'html';
            plugins = [htmlParser];
            break;
        case 'css':
        case 'scss':
            parser = 'css';
            plugins = [postcssParser];
            break;
        case 'md':
        case 'markdown':
            parser = 'markdown';
            plugins = [markdownParser];
            break;
        default:
            return code; // Not supported
    }

    try {
        const formatted = await prettier.format(code, {
            parser,
            plugins,
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            printWidth: 80,
        });
        return formatted;
    } catch (error) {
        console.error('Prettier format error:', error);
        throw error;
    }
};
