import { CheckedExpression, CheckedArgument, CheckedStatement, CheckedType } from './checker';

class LLVMGenerator {
	private readonly ast: CheckedStatement[];
	private readonly globalAdditions: string[];

	constructor(ast: CheckedStatement[]) {
		this.ast = ast;
		this.globalAdditions = [];
		this.loadGlobalAdditions();
	}

	private loadGlobalAdditions(): void {
		// this.globalAdditions.push('target triple = "x86_64-pc-linux-gnu"'); // TODO: Dynamically get target triple
		this.globalAdditions.push('declare i32 @puts(ptr)');
	}

	private generateType(node: CheckedType): string {
		// TODO: Implement actual type mapping
		switch (node.typeName) {
			case 'String':
				return 'ptr';
			case 'bool':
				return 'i1';
			case 'i8':
			case 'i16':
			case 'i32':
			case 'i64':
				return node.typeName;
			case 'u8':
			case 'u16':
			case 'u32':
			case 'u64':
				return `i${node.typeName.substring(1)}`;
			case 'f32':
			case 'f64':
				return node.typeName;
			case 'usize':
				return 'u64'; // TODO: return actual architecture word size
			case 'isize':
				return 'i64'; // TODO: return actual architecture word size
			default:
				throw new Error(`Can not map type "${node.typeName}" into LLVM types.`);
		}
	}

	private generateArgument(arg: CheckedArgument): string {
		return `${this.generateType(arg.type)} %${arg.name}`;
	}

	private generateExpression(node: CheckedExpression): string {
		switch (node.type) {
			case 'STRING_LITERAL':
				this.globalAdditions.push(
					`@${node.name} = constant [${node.data.value.length + 1} x i8] c"${node.data.value}\\00"`
				);
				return `ptr @${node.name}`;
			case 'FUNCTION_CALL':
				return `call ${this.generateType(node.data.resultType)} @${node.data.functionName}(${node.data.arguments.map((a) => this.generateExpression(a)).join(', ')})`;
			case 'NUMERIC_LITERAL':
				// TODO: Get type from Checker
				return `i32 ${node.data.value}`;
			case 'BINARY_EXPRESSION':
				throw new Error(
					'LLVM Generator: Binary Expressions are not yet implemented.'
				);
			default:
				throw new Error(
					`LLVM Generator: Unexpected type for expression.` // I would really like to add the wrong type but TypeScript doesn't let me without complaining.
				);
		}
	}

	private generateBlock(node: CheckedStatement): string {
		if (node.type !== 'BLOCK') {
			throw new Error(`LLVM Generator: Expected a block, got ${node.type}.`);
		}

		return `{\n${node.data.body.map((s) => this.generateStatement(s)).join('\n')}\n}`;
	}

	private generateStatement(node: CheckedStatement): string {
		switch (node.type) {
			case 'FUNCTION':
				const functionIdentifier = node.data.name;
				const functionReturnType = this.generateType(node.data.returnType);

				return `define ${functionReturnType} @${functionIdentifier}(${node.data.arguments.map((a) => this.generateArgument(a)).join(', ')}) ${this.generateBlock(node.data.body)}`;
			case 'EXPRESSION_STATEMENT':
				return this.generateExpression(node.data.expression);
			case 'RETURN':
				return `ret ${this.generateExpression(node.data.value)}`;
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
