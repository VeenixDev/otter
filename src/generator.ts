import { ASTNode } from './parser';

type Obj = { [key: string]: unknown };

const getVarGenerator = () => {
	// prettier-ignore
	const viableSymbols = Object.freeze([
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
        'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D',
        'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
        'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    ]);
	let counter = 0;
	const base = viableSymbols.length;

	return () => {
		let n = counter + 1;
		let varName = '';
		while (n > 0) {
			n--;
			const digit = viableSymbols[n % base];
			varName = digit + varName;
			n = Math.floor(n / base);
		}
		counter++;
		return varName;
	};
};

class LLVMGenerator {
	private ast: ASTNode[];
	private globalAdditions: string[];
	private varGenerator: () => string;

	constructor(ast: ASTNode[]) {
		this.ast = ast;
		this.globalAdditions = [];
		this.varGenerator = getVarGenerator();
		this.loadGlobalAdditions();
	}

	private loadGlobalAdditions(): void {
		this.globalAdditions.push('declare i32 @puts(ptr)');
	}

	private mapType(type: string): string {
		switch (type) {
			case 'int':
				return 'i32';
			default:
				throw new Error(`Could not map data type ${type} to a valid LLVM type`);
		}
	}

	private generateNode(node: ASTNode): string {
		switch (node.type) {
			case 'STRING_LITERAL':
				const strVal = node.data.value as string;
				const strLen = strVal.length;
				const strVarName = this.varGenerator();
				this.globalAdditions.push(
					`@${strVarName} = constant [${strLen + 1} x i8] c"${strVal}\\00"`
				);
				return `ptr @${strVarName}`;
			case 'FUNCTION_CALL':
				if ((node.data.functionIdentifier as Obj).value === 'printf') {
					const functionArguments = node.data.arguments as ASTNode[];
					return `call i32 @puts(${this.generateNode(functionArguments[0])})`;
				} else {
					throw new Error('No support yet for general function calling');
				}
			case 'FUNCTION':
				const functionIdentifier = (node.data.identifier as Obj)
					.value as string;
				const functionReturnType = this.mapType(
					(((node.data.returnType as Obj).data as Obj).type as Obj)
						.value as string
				);

				return `define ${functionReturnType} @${functionIdentifier}() { \n${node.children.map((c) => this.generateNode(c)).join('\n')}\n${!node.data.hasExplicitReturn ? 'ret i32 0\n' : ''}}`;
			default:
				throw new Error(`Unknown node type ${node.type}`);
		}
	}

	public generate(): string {
		let result = '';
		for (const node of this.ast) {
			result += this.generateNode(node);
			result += '\n';
		}

		let overhead = '';
		for (const globalAddition of this.globalAdditions) {
			overhead += globalAddition;
			overhead += '\n';
		}

		return `${overhead}\n\n${result}`;
	}
}

export { LLVMGenerator };
