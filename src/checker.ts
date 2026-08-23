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
	  }
	| {
			type: 'VARIABLE',
			data: {
				varName: string;
				type: CheckedType;
			}
			position: Position;
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
			type: 'WHILE';
			data: {
				condition: CheckedExpression;
				body: CheckedStatement;
			}
			position: Position;
		}
	| {
	type: 'ASSIGN',
	data: {
		variableName: string;
		newValue: CheckedExpression;
	},
	position: Position
}
	| {
			type: 'VAR_DECL';
			data: { name: string; type: CheckedType; value: CheckedExpression, isConstant: boolean };
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

type VariableSymbol = {
	name: string;
	data: {
		type: CheckedType;
	}
}

class Checker {
	private readonly ast: Statement[];
	private checkedAst: CheckedStatement[];
	private varNameGen = getVarGenerator();
	private functionTable: Map<string, FunctionSymbol>;
	private variablesTable: Map<string, VariableSymbol>;
	private currentTopLevelStatement: Statement | undefined;

	constructor(ast: Statement[]) {
		this.ast = ast;
		this.checkedAst = [];
		this.functionTable = new Map<string, FunctionSymbol>();
		this.variablesTable = new Map<string, VariableSymbol>();
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
							typeName: 'String',
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
		this.functionTable.set('printf', this.functionTable.get('puts')!);
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

	private checkExpressionStatement(statement: Statement): CheckedStatement {
		if (statement.type !== 'EXPRESSION_STATEMENT') {
			throw new Error(
				`Expected expression statement but got statement of type "${statement.type}"`
			);
		}

		const expression = this.checkExpression(statement.data.expression);

		return {
			type: 'EXPRESSION_STATEMENT',
			position: statement.position,
			data: { expression },
		};
	}

	private compareTypes(t1: CheckedType, t2: CheckedType): boolean {
		if (t1.hasGeneric && t1.hasGeneric === t2.hasGeneric) {
			return this.compareTypes(t1.genericType!, t2.genericType!);
		}

		return (
			t1.isPrimitive === t2.isPrimitive &&
			t1.isArray === t2.isArray &&
			t1.isPointer === t2.isPointer &&
			t1.typeName === t2.typeName
		);
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

					if (!this.compareTypes(symbolArgumentType, callArgumentType)) {
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
			case 'STRING_LITERAL':
				return {
					type: 'STRING_LITERAL',
					data: {
						value: expression.data.value,
					},
					position: expression.position,
					name: this.varNameGen(),
				};
			case 'NUMERIC_LITERAL':
				return {
					type: 'NUMERIC_LITERAL',
					data: {
						value: expression.data.value,
					},
					position: expression.position,
					name: this.varNameGen(),
				}
			case 'BINARY_EXPRESSION':
				const checkedLeft = this.checkExpression(expression.data.left);
				return {
					type: 'BINARY_EXPRESSION',
					data: {
						left: checkedLeft,
						right: this.checkExpression(expression.data.right),
						operator: expression.data.operator,
						resultType: this.getTypeFromExpression(checkedLeft)
					},
					position: expression.position
				}
			case 'VARIABLE':
				return {
					type: 'VARIABLE',
					data: {
						varName: expression.data.varName,
						type: this.variablesTable.get(expression.data.varName)!.data.type
					},
					position: expression.position
				}
			default:
				throw new Error(
					// @ts-expect-error
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
				isArray: false,
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

		if (expression.type === 'VARIABLE')  {
			return expression.data.type;
		}

		return expression.data.resultType;
	}

	private checkFunction(statement: Statement): CheckedStatement {
		if (statement.type !== 'FUNCTION') {
			throw new Error(
				`Expected a function but got statement of type "${statement.type}"`
			);
		}
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
	}

	private checkBody(statement: Statement): CheckedStatement {
		if (statement.type !== 'BLOCK') {
			throw new Error(
				`Expected a block but got statement of type "${statement.type}"`
			);
		}
		const blockBody = statement.data.body.map((b) => this.checkStatement(b));

		return {
			type: 'BLOCK',
			data: {
				body: blockBody,
			},
			position: statement.position,
		};
	}

	private checkReturn(statement: Statement): CheckedStatement {
		if (statement.type !== 'RETURN') {
			throw new Error(
				`Expected a return but got statement of type "${statement.type}"`
			);
		}
		if (this.currentTopLevelStatement?.type !== 'FUNCTION') {
			throw new Error('Unexpected error, found return outside of FUNCTION.');
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

		if (!this.compareTypes(currentFunction.data.returnType, valueType)) {
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
	}

	private checkStatement(statement: Statement): CheckedStatement {
		switch (statement.type) {
			case 'FUNCTION':
				return this.checkFunction(statement);
			case 'BLOCK':
				return this.checkBody(statement);
			case 'RETURN':
				return this.checkReturn(statement);
			case 'EXPRESSION_STATEMENT':
				return this.checkExpressionStatement(statement);
			case 'VAR_DECL':
				return this.checkVarDeclaration(statement);
			case 'WHILE':
				return this.checkWhile(statement);
			case 'ASSIGN':
				return this.checkAssign(statement);
			default:
				throw new Error(
					`Checks for statement type "${statement.type}" are not supported yet.`
				);
		}
	}

	private checkAssign(statement: Statement): CheckedStatement {
		if (statement.type !== 'ASSIGN') {
			throw new Error(
				`Expected a assign but got statement of type "${statement.type}"`
			);
		}

		const variableSymbol = this.variablesTable.get(statement.data.varName);
		if (!variableSymbol) {
			throw new Error(`Variable "${statement.data.varName}" does not exist and cannot be assigned.`);
		}

		const newValueExpression = this.checkExpression(statement.data.newValue);
		const newValueExpressionType = this.getTypeFromExpression(newValueExpression);

		if (!this.compareTypes(variableSymbol.data.type, newValueExpressionType)) {
			throw new Error(`Type ${this.typeToString(newValueExpressionType)} is not assignable to variable "${statement.data.varName}" with tye ${this.typeToString(variableSymbol.data.type)}.`);
		}

		return {
			type: 'ASSIGN',
			data: {
				variableName: statement.data.varName,
				newValue: newValueExpression
			},
			position: statement.position
		}
	}

	private checkWhile(statement: Statement): CheckedStatement {
		if (statement.type !== 'WHILE') {
			throw new Error(
				`Expected a while but got statement of type "${statement.type}"`
			);
		}

		return {
			type: 'WHILE',
			data: {
				condition: this.checkExpression(statement.data.condition),
				body: this.checkStatement(statement.data.body)
			},
			position: statement.position,
		}
	}

	private checkVarDeclaration(statement: Statement): CheckedStatement {
		if (statement.type !== 'VAR_DECL') {
			throw new Error(
				`Expected a variable declaration but got statement of type "${statement.type}"`
			);
		}

		if (this.variablesTable.has(statement.data.name)) {
			throw new Error(`Duplicate variable name "${statement.data.name}".`);
		}
		this.variablesTable.set(statement.data.name, {
			name: statement.data.name,
			data: {
				type: this.checkType(statement.data.type)
			}
		})
		return {
			type: 'VAR_DECL',
			position: statement.position,
			data: {
				name: statement.data.name,
				type: statement.data.type,
				value: this.checkExpression(statement.data.value),
				isConstant: statement.data.isConstant,
			},
			name: this.varNameGen(),
		};
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
