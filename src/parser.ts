import { Position, Token, Tokens } from './lexer';
import { randomUUID } from 'node:crypto';

// TODO: Reimplement ASTNode to be typesafe
class ASTNode {
	public type: string;
	public children: ASTNode[];
	public data: { [key: string]: unknown };
	public id: string;

	constructor(
		type: string,
		children: ASTNode[],
		data?: { [key: string]: unknown }
	) {
		this.type = type;
		this.children = children;
		this.id = randomUUID();

		this.data = data ?? {};
	}
}

// TODO: Reimplement Parser to have better separation of layers
// TODO: Clean up ScopeStack and AST management
class Parser {
	private tokens: Token[];
	private index;
	private ast: ASTNode[];
	private scopeStack: ASTNode[];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.index = 0;
		this.scopeStack = [];
		this.ast = [];
	}

	private peek(amount: number = 0): Token | undefined {
		if (this.index + amount > this.tokens.length) {
			return undefined;
		}

		return this.tokens[this.index + amount];
	}

	private advance(amount: number = 1): void {
		if (this.index + amount > this.tokens.length) {
			throw new Error('Could not advance, not enough tokens.');
		}

		this.index++;
	}

	private advanceAndReturnIfTypeMatch(
		type: Tokens,
		throwOnMismatch: boolean = true
	): Token | undefined {
		const nextToken = this.peek();
		if (nextToken && nextToken.type === type) {
			this.advance();
			return nextToken;
		} else if (throwOnMismatch) {
			if (nextToken) {
				throw new Error(
					`Expected ${type} at position ${JSON.stringify(nextToken.start)} but got ${nextToken.type}.`
				);
			} else {
				throw new Error(
					`Expected ${type} after position ${JSON.stringify(this.tokens[this.index].start)} but no token was found.`
				);
			}
		}
	}

	private parseTypeSignature(): ASTNode {
		let genericType: Token | undefined = undefined;
		let hasGeneric = false;
		let isPointer =
			this.advanceAndReturnIfTypeMatch(Tokens.ASTERISK, false) !== undefined;
		let isArray = false;

		const type: Token = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;

		if (
			this.advanceAndReturnIfTypeMatch(Tokens.OPEN_POINTY, false) !== undefined
		) {
			genericType = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;
			void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_POINTY);
			hasGeneric = true;
		}
		if (
			this.advanceAndReturnIfTypeMatch(Tokens.OPEN_SQUARE, false) !== undefined
		) {
			void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_SQUARE);
			isArray = true;
		}

		return new ASTNode('TYPE', [], {
			type,
			genericType,
			hasGeneric,
			isPointer,
			isArray,
		});
	}

	private parseFunctionSignature(): ASTNode {
		if (this.scopeStack.length !== 0) {
			throw new Error(`Function can not be declare inside another function.`);
		}
		this.advance();
		const startPosition = this.tokens[this.index].start;
		const functionArguments: { [key: string]: unknown } = {};

		const identifier = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER);

		void this.advanceAndReturnIfTypeMatch(Tokens.OPEN_PAREN);
		while (true) {
			let nextToken = this.peek();
			if (!nextToken) {
				throw new Error(
					`Failed to parse function signature at position ${JSON.stringify(startPosition)}, tokens ended unexpectedly.`
				);
			}
			if (nextToken.type === Tokens.COMMA) {
				if (Object.keys(functionArguments).length === 0) {
					throw new Error(
						`Expected IDENTIFIER but got COMMA at position ${JSON.stringify(nextToken.start)}, tokens ended unexpectedly.`
					);
				}
				this.advance();
				continue;
			}
			if (nextToken.type === Tokens.CLOSE_PAREN) {
				break;
			}
			const argumentName = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;
			this.advance();
			functionArguments[argumentName.value] = this.parseTypeSignature();
		}

		void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_PAREN);
		void this.advanceAndReturnIfTypeMatch(Tokens.COLON);
		const returnType = this.parseTypeSignature();
		void this.advanceAndReturnIfTypeMatch(Tokens.OPEN_CURLY);

		const functionNode = new ASTNode('FUNCTION', [], {
			identifier,
			arguments: functionArguments,
			returnType,
			hasExplicitReturn: false,
		});
		this.scopeStack.push(functionNode);
		this.ast.push(functionNode);
		return functionNode;
	}

	private parseIdentifier(): ASTNode {
		const identifier = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;
		let peekToken = this.peek();

		if (!peekToken) {
			throw new Error(
				`Unexpected end of Tokens after position ${JSON.stringify(identifier.end)}`
			);
		}

		switch (peekToken.type) {
			case Tokens.OPEN_PAREN:
				this.advance();

				const callArguments: ASTNode[] = [];

				while (true) {
					let nextToken = this.peek();
					if (!nextToken) {
						throw new Error(
							`Failed to parse function call at position ${JSON.stringify(identifier.start)}, tokens ended unexpectedly.`
						);
					}
					if (nextToken.type === Tokens.COMMA) {
						if (Object.keys(callArguments).length === 0) {
							throw new Error(
								`Expected IDENTIFIER but got COMMA at position ${JSON.stringify(nextToken.start)}, tokens ended unexpectedly.`
							);
						}
						this.advance();
						continue;
					}
					if (nextToken.type === Tokens.CLOSE_PAREN) {
						break;
					}
					const argumentToken = this.parseToken(nextToken)!;
					if (!argumentToken) {
						throw new Error(
							`Expected an expression at position ${JSON.stringify(nextToken.start)}.`
						);
					}
					callArguments.push(argumentToken);
				}

				void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_PAREN);
				void this.advanceAndReturnIfTypeMatch(Tokens.SEMI);
				return new ASTNode('FUNCTION_CALL', [], {
					arguments: callArguments,
					functionIdentifier: identifier,
				});
			case Tokens.ASSIGN:
				// TODO: Implement parsing of ASSIGN* tokens.
				throw new Error('Not implemented yet!');
			default:
				throw new Error(
					`Unexpected Token ${peekToken.type} at position ${JSON.stringify(peekToken.start)}`
				);
		}
	}

	private addToCurrentScope(node: ASTNode): void {
		if (this.scopeStack.length === 0) {
			throw new Error(
				'Could not add to current scope, because no scope exists.'
			);
		}

		this.scopeStack[this.scopeStack.length - 1].children.push(node);
	}

	private parseStringLiteral(): ASTNode {
		const currentToken = this.advanceAndReturnIfTypeMatch(Tokens.STRING_LITERAL)!;

		return new ASTNode('STRING_LITERAL', [], {
			value: currentToken.value,
			length: currentToken.value.length,
			positions: this.getPositionFromToken(currentToken),
		});
	}

	private getPositionFromToken(token: Token): { start: Position; end: Position } {
		return { start: token.start, end: token.end };
	}

	private parseNumericLiteral(): ASTNode {
		const currentToken = this.advanceAndReturnIfTypeMatch(Tokens.NUMERIC_LITERAL)!;
		return new ASTNode('NUMBER', [], { value: currentToken.value, position: this.getPositionFromToken(currentToken) });
	}

	private isOperator(token: Token): boolean {
		return [
			Tokens.ADD,
			Tokens.SUBTRACT,
			Tokens.ASTERISK,
			Tokens.DIVIDE,
			Tokens.MODULO,
		].includes(token.type);
	}

	private getPrecedence(token: Token): number {
		switch (token.type) {
			case Tokens.EQUALS:
				return 1;
			case Tokens.OPEN_POINTY:
			case Tokens.CLOSE_POINTY:
				return 2;
			case Tokens.ADD:
			case Tokens.SUBTRACT:
				return 3;
			case Tokens.ASTERISK:
			case Tokens.DIVIDE:
			case Tokens.MODULO:
				return 4;
			default:
				return 0;
		}
	}

	private parseExpression(minPrecedence = 0): ASTNode {
		let left = this.parseNumericLiteral(); // Erstmal die Zahl holen

		while (true) {
			const opToken = this.peek();
			if (!opToken || !this.isOperator(opToken)) break;

			const precedence = this.getPrecedence(opToken);
			if (precedence < minPrecedence) break;

			this.advance(); // Den Operator konsumieren
			const right = this.parseExpression(precedence + 1); // Rekursion für die rechte Seite

			left = new ASTNode('BINARY_EXPRESSION', [left, right], {
				operation: opToken.type,
			});
		}

		return left;
	}

	public parseToken(token: Token): ASTNode | undefined {
		let returnValue: ASTNode | undefined = undefined;
		switch (token.type) {
			case Tokens.NUMERIC_LITERAL:
				returnValue = this.parseExpression();
				this.addToCurrentScope(returnValue);
				break;
			case Tokens.FUNCTION:
				returnValue = this.parseFunctionSignature();
				break;
			case Tokens.CLOSE_CURLY:
				const closedScope = this.scopeStack.pop();

				if (closedScope?.type === Tokens.FUNCTION) {
				}
				this.advance();
				returnValue = undefined;
				break;
			case Tokens.STRING_LITERAL:
				returnValue = this.parseStringLiteral();
				break;
			case Tokens.IDENTIFIER:
				const identifier = this.parseIdentifier();
				this.addToCurrentScope(identifier);
				returnValue = identifier;
				break;
			case Tokens.EOF:
				if (this.scopeStack.length !== 0) {
					throw new Error('Unexpected end of file.');
				}
				returnValue = new ASTNode('EOF', []);
				break;
			default:
				throw new Error(
					`Unexpected token type ${token.type} at position ${JSON.stringify(token.start)}`
				);
		}

		return returnValue;
	}

	public parse(): ASTNode[] {
		while (this.index < this.tokens.length) {
			const node = this.parseToken(this.tokens[this.index]);

			if (node?.type === 'EOF') {
				return this.ast;
			}
		}
		throw new Error('Unexpected end of file, did not encounter Token EOF');
	}
}

export { Parser, ASTNode };
