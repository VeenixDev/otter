import { Argument, Expression, Statement, Type } from './parser';

// TODO: Move unique name generation for references into Checker
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
	private readonly ast: Statement[];
	private readonly globalAdditions: string[];
	private readonly varGenerator: () => string;

	constructor(ast: Statement[]) {
		this.ast = ast;
		this.globalAdditions = [];
		this.varGenerator = getVarGenerator();
		this.loadGlobalAdditions();
	}

	private loadGlobalAdditions(): void {
		// this.globalAdditions.push('target triple = "x86_64-pc-linux-gnu"'); // TODO: Dynamically get target triple
		this.globalAdditions.push('declare i32 @puts(ptr)');
	}

	private generateType(node: Type): string {
		// TODO: Implement actual type mapping
		switch (node.typeName) {
			case 'string':
				return 'ptr';
			default:
				return node.typeName;
		}
	}

	private generateArgument(arg: Argument): string {
		return `${this.generateType(arg.type)} %${arg.name}`;
	}

	private generateExpression(node: Expression): string {
		switch (node.type) {
			case 'STRING_LITERAL':
				const strVarName = this.varGenerator();
				this.globalAdditions.push(`@${strVarName} = constant [${node.data.value.length + 1} x i8] c"${node.data.value}\\00"`);
				return `ptr @${strVarName}`;
			case 'FUNCTION_CALL':
				// TODO: 1. Create Function table for return type lookup
				// TODO: 2. Implement Checker to enrich Expression information
				if (node.data.functionName === 'printf') {
					return `call i32 @puts(${node.data.arguments.map(a => this.generateExpression(a)).join(", ")})`;
				} else {
					throw new Error('Unknown function');
				}
			case 'NUMERIC_LITERAL':
				// TODO: Get type from Checker
				return `i32 ${node.data.value}`;
			case 'BINARY_EXPRESSION':
				throw new Error('LLVM Generator: Binary Expressions are not yet implemented.')
			default:
				throw new Error(
					`LLVM Generator: Unexpected type for expression.` // I would really like to add the wrong type but TypeScript doesn't let me without complaining.
				);
		}
	}

	private generateBlock(node: Statement): string {
		if (node.type !== 'BLOCK') {
			throw new Error(`LLVM Generator: Expected a block, got ${node.type}.`);
		}

		return `{\n${node.data.body.map(s => this.generateStatement(s)).join('\n')}\n}`;
	}

	private generateStatement(node: Statement): string {
		switch (node.type) {
			case 'FUNCTION':
				const functionIdentifier = node.data.name;
				const functionReturnType = this.generateType(node.data.returnType);

				return `define ${functionReturnType} @${functionIdentifier}(${node.data.arguments.map((a) => this.generateArgument(a)).join(', ')}) ${this.generateBlock(node.data.body)}`;
			case 'EXPRESSION_STATEMENT':
				return this.generateExpression(node.data.expression);
			case 'RETURN':
				// TODO: 1. Get Return type from current function
				// TODO: 2. Get Return type from Checker
				return `ret ${this.generateExpression(node.data.value)}`
			default:
				throw new Error(
					`LLVM Generator: Unexpected type ${node.type} for statement.`
				);
		}
	}

	public generate(): string {
		let result = '';
		for (const node of this.ast) {
			result += this.generateStatement(node);
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
