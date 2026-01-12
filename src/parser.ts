import { Position, Token, Tokens } from './lexer';

type Expression =
	| {
			type: 'BINARY_EXPRESSION';
			data: { left: Expression; right: Expression; operator: string };
			position: Position;
	  }
	| { type: 'STRING_LITERAL'; data: { value: string }; position: Position }
	| {
			type: 'FUNCTION_CALL';
			data: { arguments: Expression[]; functionName: string };
			position: Position;
	  };

type Argument = {
	name: string;
	type: Type;
};

type Type = {
	isPrimitive: boolean;
	isArray: boolean;
	isPointer: boolean;
	hasGeneric: boolean;
	genericType: Type | null;
	typeName: string;
};

type Statement =
	| { type: 'BLOCK'; data: { body: Statement[] }; position: Position }
	| {
			type: 'FUNCTION';
			data: {
				name: string;
				arguments: Argument[];
				body: Statement;
				returnType: Type;
			};
			position: Position;
	  }
	| {
			type: 'VAR_DECL';
			data: { name: string; type: Type; value: Expression };
			position: Position;
	  }
	| { type: 'IMPORT'; data: { namespace: string }; position: Position }
	| {
			type: 'EXPRESSION_STATEMENT';
			data: { expression: Expression };
			position: Position;
	  };

class Parser {
	private readonly tokens: Token[];
	private index: number;
	private ast: Statement[];

	private readonly primitiveTypes: Set<string> = new Set([
		'i8',
		'i16',
		'i32',
		'i64',
		'u8',
		'u16',
		'u32',
		'u64',
		'f32',
		'f64',
		'bool',
	]);

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.index = 0;
		this.ast = [];
	}

	private peek(): Token | undefined {
		return this.tokens[this.index];
	}

	private consume(type: Tokens): void {
		if (this.index + 1 >= this.tokens.length) {
			throw new Error('Could not consume, no next token.');
		}
		if (this.peek()?.type !== type) {
			throw new Error(
				`Expected ${type} at ${this.positionString()} but got ${this.peek()?.type}`
			);
		}

		this.index++;
	}

	private match(type: Tokens): boolean {
		if (this.peek()?.type === type) {
			this.consume(type);
			return true;
		}
		return false;
	}

	private parseStringLiteral(): Expression {
		if (this.peek()?.type !== Tokens.STRING_LITERAL) {
			throw new Error(
				`Expected string literal at ${this.positionString()} but got ${this.peek()?.type}`
			);
		}
		const expression: Expression = {
			type: 'STRING_LITERAL',
			data: {
				value: this.peek()!.value,
			},
			position: this.currentPosition(),
		};
		this.consume(Tokens.STRING_LITERAL);
		return expression;
	}

	private parseExpression(): Expression {
		switch (this.peek()?.type) {
			case Tokens.STRING_LITERAL:
				return this.parseStringLiteral();
			default:
				throw new Error(
					`Unexpected token ${this.peek()?.type} for expression at ${this.positionString()}`
				);
		}
	}

	private parseBlock(): Statement {
		const startPosition = this.currentPosition();
		this.consume(Tokens.OPEN_CURLY);
		const body: Statement[] = [];

		while (this.peek() && this.peek()!.type !== Tokens.CLOSE_CURLY) {
			body.push(this.parseLocalStatement());
		}

		this.consume(Tokens.CLOSE_CURLY);
		return {
			type: 'BLOCK',
			position: startPosition,
			data: {
				body,
			},
		};
	}

	private parseArgument(): Argument {
		if (this.peek()?.type !== Tokens.IDENTIFIER) {
			throw new Error(
				`Expected IDENTIFIER at ${this.positionString()} but got ${this.peek()?.type}`
			);
		}
		const name = this.peek()!.value;
		this.consume(Tokens.IDENTIFIER);
		this.consume(Tokens.COLON);
		const type = this.parseType();

		return {
			type,
			name,
		};
	}

	private parseType(): Type {
		const isPointer = this.match(Tokens.ASTERISK);
		if (this.peek()?.type !== Tokens.IDENTIFIER) {
			throw new Error(
				`Expected IDENTIFIER at position ${this.positionString()} but got ${this.peek()?.type}`
			);
		}
		const typeName = this.peek()!.value;
		this.consume(Tokens.IDENTIFIER);
		const hasGeneric = this.match(Tokens.OPEN_POINTY);
		let genericType: Type | null = null;
		if (hasGeneric) {
			genericType = this.parseType();
			this.consume(Tokens.CLOSE_POINTY);
		}
		const isArray = this.match(Tokens.OPEN_SQUARE);
		if (isArray) {
			this.consume(Tokens.CLOSE_SQUARE);
		}

		return {
			genericType,
			isArray,
			hasGeneric,
			isPointer,
			typeName,
			isPrimitive: this.primitiveTypes.has(typeName),
		};
	}

	private parseFunction(): Statement {
		const position = this.currentPosition();
		this.consume(Tokens.FUNCTION);
		if (this.peek()?.type !== Tokens.IDENTIFIER) {
			throw new Error(
				`Expected function name at position ${this.positionString()}.`
			);
		}
		const functionName = this.peek()!.value;
		this.consume(Tokens.IDENTIFIER);
		this.consume(Tokens.OPEN_PAREN);
		const args: Argument[] = [];

		if (this.peek()?.type !== Tokens.CLOSE_PAREN) {
			do {
				args.push(this.parseArgument());
			} while (this.match(Tokens.COMMA));
		}
		this.consume(Tokens.CLOSE_PAREN);
		this.consume(Tokens.COLON);
		const returnType = this.parseType();

		return {
			type: 'FUNCTION',
			data: {
				name: functionName,
				arguments: args,
				body: this.parseBlock(),
				returnType,
			},
			position,
		};
	}

	private parseIdentifier(): Statement {
		if (this.peek()?.type !== Tokens.IDENTIFIER) {
			throw new Error(
				`Expected identifier at position ${this.positionString()} but got ${this.peek()?.type}`
			);
		}
		const startPosition = this.currentPosition();
		const identifier = this.peek()!.value;
		this.consume(Tokens.IDENTIFIER);
		if (this.match(Tokens.ASSIGN)) {
			throw new Error('Not implemented yet!');
		}
		if (this.match(Tokens.OPEN_PAREN)) {
			const argExpressions: Expression[] = [];

			if (this.peek()?.type !== Tokens.CLOSE_PAREN) {
				do {
					argExpressions.push(this.parseExpression());
				} while (this.match(Tokens.COMMA));
			}
			this.consume(Tokens.CLOSE_PAREN);
			this.consume(Tokens.SEMI);
			// TODO: Extract EXPRESSION_STATEMENT into own parser
			return {
				type: 'EXPRESSION_STATEMENT',
				data: {
					expression: {
						type: 'FUNCTION_CALL',
						data: { functionName: identifier, arguments: argExpressions },
						position: startPosition,
					},
				},
				position: startPosition,
			};
		}

		throw new Error(`Found unused IDENTIFIER at ${this.positionString()}.`);
	}

	private parseLocalStatement(): Statement {
		switch (this.peek()?.type) {
			case Tokens.IDENTIFIER:
				return this.parseIdentifier();
			default:
				throw new Error(
					`Unexpected token ${this.peek()?.type} for a statement at ${this.positionString()}`
				);
		}
	}

	private parseTopLevelStatement(): Statement {
		switch (this.peek()?.type) {
			case Tokens.FUNCTION:
				return this.parseFunction();
			default:
				throw new Error(
					`Token ${this.peek()?.type} is not allowed at top level at ${this.positionString()}`
				);
		}
	}

	public parse(): Statement[] {
		let next: Token | undefined;
		while ((next = this.peek()) !== undefined && next.type !== Tokens.EOF) {
			const statement = this.parseTopLevelStatement();

			this.ast.push(statement);
		}

		if (this.peek()?.type !== Tokens.EOF) {
			throw new Error(
				'Unexpected end of file during parsing, can not complete parsing.'
			);
		}

		return this.ast;
	}

	// ---------------- Helpers ------------------
	private positionString(): string {
		const currentToken = this.peek();
		if (currentToken === undefined) {
			return '';
		}

		return `line ${currentToken.start.line}:${currentToken.start.column}`;
	}

	private currentPosition(): Position {
		const currentToken = this.peek();

		if (currentToken === undefined) {
			throw new Error(
				'Could not get position for because no token is present.'
			);
		}

		return currentToken.start;
	}
}

export { Parser };
