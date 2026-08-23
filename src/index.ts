import fs from 'node:fs';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { LLVMGenerator } from './generator';
import { Checker } from './checker';

const file = fs.readFileSync('examples/while_loop.otter', 'utf8');

if (!file) {
	throw new Error('Could not find file');
}

if (fs.existsSync('out')) {
	fs.rmSync('out', { recursive: true, force: true });
}

fs.mkdirSync('out');

console.info('Starting Lexer');

const lexer = new Lexer(file);

const tokenList = lexer.lex();

fs.writeFileSync('out/tokenList.json', JSON.stringify(tokenList, null, 2));

console.info('Completed Lexer result can be found in "tokenList.json"');
console.info('Starting Parser');

const parser = new Parser(tokenList);

const ast = parser.parse();

fs.writeFileSync('out/ast.json', JSON.stringify(ast, null, 2));

console.info('Completed Parser result can be found in "ast.json"');

console.info('Starting Checker');
const checker = new Checker(ast);

const checkedAst = checker.checkStatements();

fs.writeFileSync('out/checkedAst.json', JSON.stringify(checkedAst, null, 2));

console.info('Completed Checker result can be found in "checkedAst.json"');
console.info('Starting LLVM Generator');

const generator = new LLVMGenerator(checkedAst);

const output = generator.generate();

fs.writeFileSync('out/output.ll', output);

console.info('Completed LLVM Generator result can be found in "output.ll"');
