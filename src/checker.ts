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
				resultType: CheckedType;
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
			data: {
				arguments: CheckedExpression[];
				functionName: string;
				resultType: CheckedType;
			};
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
		switch (expression.type) {
			case 'FUNCTION_CALL':
				// TODO: Adjust to create Checker-Frame when function is not found to resume checking later.
				const functionSymbol = this.functionTable.get(
					expression.data.functionName
				);

				if (!functionSymbol) {
					throw new Error(
						`Can not verify call of unknown function "${expression.data.functionName}", please make sure this function is included in the build.`
					);
				}

				if (
					expression.data.arguments.length !==
					functionSymbol.data.arguments.length
				) {
					throw new Error(
						`Invalid function call, got ${expression.data.arguments.length} arguments but expected ${functionSymbol.data.arguments.length}.`
					);
				}

				const argumentsExpressions: CheckedExpression[] = [];

				for (let i = 0; i < expression.data.arguments.length; i++) {
					const symbolArgumentType = functionSymbol.data.arguments[i].type;
					const callArgumentExpression = this.checkExpression(
						expression.data.arguments[i]
					);
					const callArgumentType = this.getTypeFromExpression(
						callArgumentExpression
					);

					if (symbolArgumentType !== callArgumentType) {
						throw new Error(
							`Argument in call to function ${functionSymbol.name} at position ${this.positionToString(callArgumentExpression.position)}, expected "${this.typeToString(symbolArgumentType)}" but got "${this.typeToString(callArgumentType)}".`
						);
					}

					argumentsExpressions.push(callArgumentExpression);
				}

				return {
					type: 'FUNCTION_CALL',
					data: {
						arguments: argumentsExpressions,
						functionName: functionSymbol.name,
						resultType: functionSymbol.data.returnType,
					},
					position: expression.position,
				};
			default:
				throw new Error(
					`Checks for expression type "${expression.type}" are not supported yet.`
				);
		}
	}

	private getTypeFromExpression(expression: CheckedExpression): CheckedType {
		if (expression.type === 'STRING_LITERAL') {
			return {
				typeName: 'String',
				isPointer: true,
				genericType: null,
				isArray: true,
				hasGeneric: false,
				isPrimitive: false,
			};
		}
		if (expression.type === 'NUMERIC_LITERAL') {
			return {
				typeName: 'i32', // TODO: Set correct numeric type
				isPointer: false,
				genericType: null,
				isArray: false,
				hasGeneric: false,
				isPrimitive: true,
			};
		}

		return expression.data.resultType;
	}

	private checkStatement(statement: Statement): CheckedStatement {
		switch (statement.type) {
			case 'FUNCTION':
				const functionName = statement.data.name;
				if (this.functionTable.has(functionName)) {
					throw new Error(
						`A function with this name "${functionName}" is already used.`
					);
				}
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

				const functionBody = this.checkStatement(statement.data.body);

				return {
					type: 'FUNCTION',
					name: functionName,
					data: {
						name: functionName,
						arguments: functionArguments,
						returnType: functionReturnType,
						body: functionBody,
					},
					position: statement.position,
				};
			case 'BLOCK':
				const blockBody = statement.data.body.map((b) =>
					this.checkStatement(b)
				);

				return {
					type: 'BLOCK',
					data: {
						body: blockBody,
					},
					position: statement.position,
				};
			case 'RETURN':
				if (this.currentTopLevelStatement?.type !== 'FUNCTION') {
					throw new Error(
						'Unexpected error, found return outside of FUNCTION.'
					);
				}
				const currentFunction = this.getFunctionSymbol(
					this.currentTopLevelStatement.data.name
				);

				if (currentFunction === undefined) {
					throw new Error(
						'Unexpected error, found return but no symbol for the function it is inside.'
					);
				}

				const value = this.checkExpression(statement.data.value);
				const valueType = this.getTypeFromExpression(value);

				if (currentFunction.data.returnType !== valueType) {
					throw new Error(
						`Expected "${this.typeToString(currentFunction.data.returnType)}" but found "${this.typeToString(valueType)}" at ${this.positionToString(statement.position)}`
					);
				}
				return {
					type: 'RETURN',
					data: {
						value,
						returnType: currentFunction.data.returnType,
					},
					position: statement.position,
				};
			default:
				throw new Error(
					`Checks for statement type "${statement.type}" are not supported yet.`
				);
		}
	}

	private typeToString(type: CheckedType): string {
		if (type.hasGeneric) {
			return `${type.isPointer ? '*' : ''}${type.typeName}<${type.genericType}>${type.isArray ? '[]' : ''}`;
		} else {
			return `${type.isPointer ? '*' : ''}${type.typeName}${type.isArray ? '[]' : ''}`;
		}
	}

	private positionToString(position: Position): string {
		return `L${position.line}:${position.column}`;
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

export {
	Checker,
	CheckedStatement,
	CheckedExpression,
	CheckedType,
	CheckedArgument,
};
