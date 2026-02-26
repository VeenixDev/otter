import { Argument, Expression, Statement, Type } from './parser';
import { Position } from './lexer';

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

type CheckedArgument = {
	name: string;
	type: CheckedType;
};

type CheckedType = {
	isPrimitive: boolean;
	isArray: boolean;
	isPointer: boolean;
	hasGeneric: boolean;
	genericType: CheckedType | null;
	typeName: string;
};

type CheckedExpression =
	| {
			type: 'BINARY_EXPRESSION';
			data: {
				left: CheckedExpression;
				right: CheckedExpression;
				operator: string;
			};
			position: Position;
			name: string;
	  }
	| {
			type: 'STRING_LITERAL';
			data: { value: string };
			position: Position;
			name: string;
	  }
	| {
			type: 'NUMERIC_LITERAL';
			data: { value: number };
			position: Position;
			name: string;
	  }
	| {
			type: 'FUNCTION_CALL';
			data: { arguments: CheckedExpression[]; functionName: string };
			position: Position;
	  };

type CheckedStatement =
	| {
			type: 'BLOCK';
			data: { body: CheckedStatement[] };
			position: Position;
	  }
	| {
			type: 'FUNCTION';
			data: {
				name: string;
				arguments: CheckedArgument[];
				body: CheckedStatement;
				returnType: CheckedType;
			};
			position: Position;
			name: string;
	  }
	| {
			type: 'VAR_DECL';
			data: { name: string; type: CheckedType; value: CheckedExpression };
			position: Position;
			name: string;
	  }
	| { type: 'IMPORT'; data: { namespace: string }; position: Position }
	| {
			type: 'EXPRESSION_STATEMENT';
			data: { expression: CheckedExpression };
			position: Position;
	  }
	| {
			type: 'RETURN';
			data: { value: CheckedExpression; returnType: CheckedType };
			position: Position;
	  };

type FunctionSymbol = {
	name: string;
	data: {
		arguments: CheckedArgument[];
		returnType: CheckedType;
	};
};

class Checker {
	private readonly ast: Statement[];
	private checkedAst: CheckedStatement[];
	private varNameGen = getVarGenerator();
	private functionTable: Map<string, FunctionSymbol>;
	private currentTopLevelStatement: Statement | undefined;

	constructor(ast: Statement[]) {
		this.ast = ast;
		this.checkedAst = [];
		this.functionTable = new Map<string, FunctionSymbol>();
		this.currentTopLevelStatement = undefined;

		this.initFunctionTable();
	}

	private initFunctionTable() {
		this.functionTable.set('puts', {
			name: 'puts',
			data: {
				arguments: [
					{
						name: 'text',
						type: {
							typeName: 'string',
							isPointer: true,
							isPrimitive: false,
							genericType: null,
							hasGeneric: false,
							isArray: false,
						},
					},
				],
				returnType: {
					typeName: 'i32',
					isPointer: false,
					isPrimitive: true,
					genericType: null,
					hasGeneric: false,
					isArray: false,
				},
			},
		});
	}

	private getFunctionSymbol(functionName: string): FunctionSymbol | undefined {
		return this.functionTable.get(functionName);
	}

	private checkArgument(argument: Argument): CheckedArgument {
		return {
			type: argument.type,
			name: argument.name,
		};
	}

	private checkType(type: Type): CheckedType {
		return {
			genericType: type.genericType,
			isArray: type.isArray,
			hasGeneric: type.hasGeneric,
			isPointer: type.isPointer,
			typeName: type.typeName,
			isPrimitive: type.isPrimitive,
		};
	}

	private checkExpression(expression: Expression): CheckedExpression {
		throw new Error('Not implemented (checker.ts#checkExpression)')
	}

	private checkStatement(statement: Statement): CheckedStatement {
		switch (statement.type) {
			case 'FUNCTION':
				const functionName = statement.data.name;
				const functionArguments = statement.data.arguments.map((a) =>
					this.checkArgument(a)
				);
				const functionReturnType = this.checkType(statement.data.returnType);

				this.functionTable.set(functionName, {
					name: functionName,
					data: {
						arguments: functionArguments,
						returnType: functionReturnType,
					},
				});

				const functionBody = this.checkStatement(statement.data.body)

				return {
					type: 'FUNCTION',
					name: functionName,
					data: {
						name: functionName,
						arguments: functionArguments,
						returnType: functionReturnType,
						body: functionBody
					},
					position: statement.position,
				};
			case 'BLOCK':
				const blockBody = statement.data.body.map(b => this.checkStatement(b));

				return {
					type: 'BLOCK',
					data: {
						body: blockBody
					},
					position: statement.position,
				}
			case 'RETURN':
				if (this.currentTopLevelStatement?.type !== 'FUNCTION') {
					throw new Error('Unexpected error, found return outside of FUNCTION.');
				}
				const currentFunction = this.getFunctionSymbol(this.currentTopLevelStatement.data.name);

				if (currentFunction === undefined) {
					throw new Error('Unexpected error, found return but no symbol for the function it is inside.');
				}

				return {
					type: 'RETURN',
					data: {
						value: this.checkExpression(statement.data.value),
						returnType: currentFunction.data.returnType,
					},
					position: statement.position,
				}
			default:
				throw new Error(
					`Checks for statement type "${statement.type}" are not supported yet.`
				);
		}
	}

	public checkStatements(): CheckedStatement[] {
		for (const statement of this.ast) {
			this.currentTopLevelStatement = statement;
			const checkedStatement = this.checkStatement(statement);
			this.currentTopLevelStatement = undefined;

			this.checkedAst.push(checkedStatement);
		}

		return this.checkedAst;
	}
}
